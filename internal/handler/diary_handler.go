package handler

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"gorm.io/gorm"

	"janymda/internal/ai"
	"janymda/internal/middleware"
	"janymda/internal/model"
	"janymda/internal/scoring"
)

// DiaryHandler — күнделік жазбалары (пациенттің жеке жазбалары).
type DiaryHandler struct {
	db *gorm.DB
}

func NewDiaryHandler(db *gorm.DB) *DiaryHandler {
	return &DiaryHandler{db: db}
}

// POST /api/v1/diary — жаңа жазба қосу (тек кірген пайдаланушы).
func (h *DiaryHandler) Create(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, _ := r.Context().Value(middleware.CtxUserID).(uint)
	if userID == 0 {
		http.Error(w, "Күнделікке жазу үшін жүйеге кіріңіз", http.StatusUnauthorized)
		return
	}

	var req struct {
		Mood int    `json:"mood"`
		Text string `json:"text"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	if req.Mood < 1 || req.Mood > 5 {
		http.Error(w, "Көңіл-күй 1-ден 5-ке дейін болуы керек", http.StatusBadRequest)
		return
	}

	req.Text = strings.TrimSpace(req.Text)
	if len(req.Text) > 4000 {
		http.Error(w, "Мәтін тым ұзын", http.StatusBadRequest)
		return
	}

	entry := model.DiaryEntry{
		UserID: userID,
		Mood:   req.Mood,
		Text:   req.Text,
	}
	if err := h.db.Create(&entry).Error; err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}

	// Gemini assessment only for entries that include text.
	// We retry inside the same request so frontend doesn't have to "resend".
	if strings.TrimSpace(entry.Text) != "" {
		var assessment ai.DiaryAssessment
		var lastErr error
		for attempt := 1; attempt <= 4; attempt++ {
			a, err := ai.AssessDiaryText(r.Context(), entry.Text)
			if err == nil {
				assessment = a
				lastErr = nil
				break
			}
			lastErr = err
			// small backoff; keep within a single request
			time.Sleep(time.Duration(attempt) * 500 * time.Millisecond)
		}

		now := time.Now().UTC()
		if lastErr == nil {
			zone := assessment.Zone
			status := "ready"
			score := assessment.Score
			urgent := assessment.Urgent

			keySignalsJSON, _ := json.Marshal(assessment.KeySignals)
			keySignalsStr := string(keySignalsJSON)
			entry.AiStatus = &status
			entry.AiScore = &score
			entry.AiZone = &zone
			entry.AiKeySignals = &keySignalsStr
			entry.AiReasoning = &assessment.Reasoning
			entry.AiUrgent = &urgent
			entry.AiAssessedAt = &now
			entry.AiError = nil

			entry.AiAttempts = entry.AiAttempts + 1
			entry.AiLastAttemptAt = &now
			entry.AiRetryAt = nil

			_ = h.db.Save(&entry).Error

			if zone == "yellow" || zone == "red" {
				createPsychCase(h.db, entry, score, zone)
			}
			scoring.RecalcPatientScore(h.db, userID)
		} else {
			status := "error"
			entry.AiStatus = &status
			msg := lastErrMessage(lastErr)
			entry.AiError = &msg

			entry.AiAttempts = entry.AiAttempts + 1
			entry.AiLastAttemptAt = &now
			retryAt := now.Add(24 * time.Hour)
			entry.AiRetryAt = &retryAt
			entry.AiAssessedAt = nil

			_ = h.db.Save(&entry).Error
		}
	}

	role, _ := r.Context().Value(middleware.CtxRole).(string)
	resp := stripAiForRole(entry, role)
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(resp)
}

func lastErrMessage(err error) string {
	if err == nil {
		return ""
	}
	msg := err.Error()
	// Avoid storing very large error strings.
	if len(msg) > 500 {
		msg = msg[:500]
	}
	return msg
}

// GET /api/v1/diary — менің соңғы жазбаларым (жаңадан ескіге).
func (h *DiaryHandler) ListMy(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodGet {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, _ := r.Context().Value(middleware.CtxUserID).(uint)
	if userID == 0 {
		http.Error(w, "Күнделікке кіру үшін жүйеге кіріңіз", http.StatusUnauthorized)
		return
	}

	limit := 60
	if q := r.URL.Query().Get("limit"); q != "" {
		if n, err := strconv.Atoi(q); err == nil && n > 0 && n <= 365 {
			limit = n
		}
	}

	var entries []model.DiaryEntry
	if err := h.db.
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Limit(limit).
		Find(&entries).Error; err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}

	role, _ := r.Context().Value(middleware.CtxRole).(string)
	result := make([]map[string]any, 0, len(entries))
	for _, e := range entries {
		result = append(result, stripAiForRole(e, role))
	}
	_ = json.NewEncoder(w).Encode(result)
}

// stripAiForRole returns diary entry as map, stripping AI fields for non-privileged roles.
// Only psychologist, admin, super_admin can see AI data.
func stripAiForRole(e model.DiaryEntry, role string) map[string]any {
	m := map[string]any{
		"id":         e.ID,
		"user_id":    e.UserID,
		"mood":       e.Mood,
		"text":       e.Text,
		"created_at": e.CreatedAt,
	}
	r := strings.ToLower(strings.TrimSpace(role))
	if r == "psychologist" || r == "admin" || r == "super_admin" {
		if e.AiStatus != nil {
			m["ai_status"] = *e.AiStatus
		}
		if e.AiScore != nil {
			m["ai_score"] = *e.AiScore
		}
		if e.AiZone != nil {
			m["ai_zone"] = *e.AiZone
		}
		if e.AiKeySignals != nil {
			m["ai_key_signals"] = *e.AiKeySignals
		}
		if e.AiReasoning != nil {
			m["ai_reasoning"] = *e.AiReasoning
		}
		if e.AiUrgent != nil {
			m["ai_urgent"] = *e.AiUrgent
		}
		if e.AiAssessedAt != nil {
			m["ai_assessed_at"] = *e.AiAssessedAt
		}
	}
	return m
}

func createPsychCase(db *gorm.DB, entry model.DiaryEntry, score int, zone string) {
	entryID := entry.ID
	pc := model.PsychCase{
		PatientID:    entry.UserID,
		DiaryEntryID: &entryID,
		SourceType:   "diary",
		Zone:         zone,
		Status:       "open",
		AiScore:      score,
		AiZone:       zone,
	}
	if zone == "yellow" {
		pc.AnonymousText = entry.Text
	}
	if err := db.Create(&pc).Error; err != nil {
		log.Printf("[WARN] failed to create psych case for diary=%d: %v", entry.ID, err)
	}
}

// GET /api/v1/diary/summary — соңғы 30 күн бойынша шағын статистика (көңіл-күй орташа, тренд).
func (h *DiaryHandler) Summary(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodGet {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, _ := r.Context().Value(middleware.CtxUserID).(uint)
	if userID == 0 {
		http.Error(w, "Күнделікке кіру үшін жүйеге кіріңіз", http.StatusUnauthorized)
		return
	}

	var entries []model.DiaryEntry
	since := time.Now().AddDate(0, 0, -30)
	if err := h.db.
		Where("user_id = ? AND created_at >= ?", userID, since).
		Order("created_at ASC").
		Find(&entries).Error; err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}

	if len(entries) == 0 {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"count":       0,
			"avg_mood":    0,
			"first_mood":  0,
			"latest_mood": 0,
		})
		return
	}

	sum := 0
	for _, e := range entries {
		sum += e.Mood
	}
	avg := float64(sum) / float64(len(entries))

	_ = json.NewEncoder(w).Encode(map[string]any{
		"count":       len(entries),
		"avg_mood":    avg,
		"first_mood":  entries[0].Mood,
		"latest_mood": entries[len(entries)-1].Mood,
	})
}

