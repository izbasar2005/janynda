package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"gorm.io/gorm"

	"janymda/internal/middleware"
	"janymda/internal/model"
)

type PsychCaseHandler struct {
	db *gorm.DB
}

func NewPsychCaseHandler(db *gorm.DB) *PsychCaseHandler {
	return &PsychCaseHandler{db: db}
}

// ---------------------------------------------------------------------------
// GET /api/v1/psych/cases — список кейсов.
//
// Психолог видит:
//   - все yellow-кейсы (анонимные, любой психолог)
//   - red-кейсы только свои (назначенные ему)
//   - + unassigned red-кейсы (чтобы мог "взять")
//
// Admin/super_admin видят все.
// ---------------------------------------------------------------------------
func (h *PsychCaseHandler) List(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodGet {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	role, _ := r.Context().Value(middleware.CtxRole).(string)
	userID, _ := r.Context().Value(middleware.CtxUserID).(uint)
	role = strings.ToLower(strings.TrimSpace(role))

	q := h.db.Model(&model.PsychCase{}).Order("created_at DESC")

	zoneFilter := strings.ToLower(r.URL.Query().Get("zone"))
	if zoneFilter == "yellow" || zoneFilter == "red" {
		q = q.Where("zone = ?", zoneFilter)
	}
	statusFilter := strings.ToLower(r.URL.Query().Get("status"))
	if statusFilter != "" {
		q = q.Where("status = ?", statusFilter)
	}

	if role == "psychologist" {
		// yellow: все видны (анонимно). red: только свои + unassigned.
		q = q.Where(
			"(zone = 'yellow') OR (zone = 'red' AND (psychologist_id IS NULL OR psychologist_id = ?))",
			userID,
		)
	}

	var cases []model.PsychCase
	if err := q.Find(&cases).Error; err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}

	result := make([]map[string]any, 0, len(cases))
	for _, c := range cases {
		result = append(result, formatCaseForRole(c, role, userID))
	}
	_ = json.NewEncoder(w).Encode(result)
}

// ---------------------------------------------------------------------------
// GET /api/v1/psych/cases/{id} — детали одного кейса.
//
// Психолог:
//   - yellow → анонимный текст, без пациента
//   - red → полные данные ТОЛЬКО если назначен ему или unassigned
//
// Admin/super_admin → всё видно.
// ---------------------------------------------------------------------------
func (h *PsychCaseHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodGet {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	caseID := extractTrailingID(r.URL.Path)
	if caseID == 0 {
		http.Error(w, "invalid case id", http.StatusBadRequest)
		return
	}

	role, _ := r.Context().Value(middleware.CtxRole).(string)
	userID, _ := r.Context().Value(middleware.CtxUserID).(uint)
	role = strings.ToLower(strings.TrimSpace(role))

	var pc model.PsychCase
	q := h.db.Where("id = ?", caseID)
	q = q.Preload("ChatAssessment")
	if err := q.First(&pc).Error; err != nil {
		http.Error(w, "Case not found", http.StatusNotFound)
		return
	}

	if role == "psychologist" && pc.Zone == "red" {
		if pc.PsychologistID != nil && *pc.PsychologistID != userID {
			http.Error(w, "Forbidden: case assigned to another psychologist", http.StatusForbidden)
			return
		}
	}

	resp := formatCaseForRole(pc, role, userID)

	canSeePatient := false
	if role == "admin" || role == "super_admin" {
		canSeePatient = true
	} else if role == "psychologist" && pc.Zone == "red" {
		if pc.PsychologistID == nil || *pc.PsychologistID == userID {
			canSeePatient = true
		}
	}

	if canSeePatient {
		var patient model.User
		if err := h.db.Select("id, full_name, phone, iin, first_name, last_name, patronymic, gender, created_at").
			Where("id = ?", pc.PatientID).First(&patient).Error; err == nil {
			resp["patient"] = map[string]any{
				"id":         patient.ID,
				"full_name":  patient.FullName,
				"phone":      patient.Phone,
				"iin":        patient.IIN,
				"first_name": patient.FirstName,
				"last_name":  patient.LastName,
				"gender":     patient.Gender,
				"created_at": patient.CreatedAt,
			}
		}

		var diaryEntries []model.DiaryEntry
		h.db.Where("user_id = ?", pc.PatientID).Order("created_at DESC").Limit(30).Find(&diaryEntries)
		diaryList := make([]map[string]any, 0, len(diaryEntries))
		for _, e := range diaryEntries {
			diaryList = append(diaryList, stripAiForRole(e, role))
		}
		resp["diary_entries"] = diaryList
	}

	_ = json.NewEncoder(w).Encode(resp)
}

// ---------------------------------------------------------------------------
// POST /api/v1/psych/cases/{id}/assign — "взять кейс" (самоназначение) или
// админ назначает конкретного психолога.
//
//	body: {} — психолог назначает себя
//	body: {"psychologist_id": 42} — админ назначает конкретного
// ---------------------------------------------------------------------------
func (h *PsychCaseHandler) Assign(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	parts := strings.Split(strings.TrimSuffix(r.URL.Path, "/"), "/")
	if len(parts) < 2 {
		http.Error(w, "invalid path", http.StatusBadRequest)
		return
	}
	caseIDStr := parts[len(parts)-2]
	caseID, _ := strconv.ParseUint(caseIDStr, 10, 64)
	if caseID == 0 {
		http.Error(w, "invalid case id", http.StatusBadRequest)
		return
	}

	userID, _ := r.Context().Value(middleware.CtxUserID).(uint)
	role, _ := r.Context().Value(middleware.CtxRole).(string)
	role = strings.ToLower(strings.TrimSpace(role))

	var pc model.PsychCase
	if err := h.db.Where("id = ?", caseID).First(&pc).Error; err != nil {
		http.Error(w, "Case not found", http.StatusNotFound)
		return
	}

	if pc.PsychologistID != nil {
		http.Error(w, "Case already assigned", http.StatusConflict)
		return
	}

	var req struct {
		PsychologistID *uint `json:"psychologist_id"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)

	assignID := userID
	if (role == "admin" || role == "super_admin") && req.PsychologistID != nil {
		// Verify the target user is actually a psychologist.
		var target model.User
		if err := h.db.Where("id = ? AND role = ?", *req.PsychologistID, "psychologist").First(&target).Error; err != nil {
			http.Error(w, "Target psychologist not found", http.StatusBadRequest)
			return
		}
		assignID = *req.PsychologistID
	}

	pc.PsychologistID = &assignID
	if pc.Status == "open" {
		pc.Status = "in_review"
	}

	if err := h.db.Save(&pc).Error; err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}

	_ = json.NewEncoder(w).Encode(formatCaseForRole(pc, role, userID))
}

// ---------------------------------------------------------------------------
// PATCH /api/v1/psych/cases/{id} — психолог оценивает кейс.
//
// Психолог может оценивать только если назначен на кейс или кейс unassigned
// (в этом случае авто-назначается).
// ---------------------------------------------------------------------------
func (h *PsychCaseHandler) Review(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPatch {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	caseID := extractTrailingID(r.URL.Path)
	if caseID == 0 {
		http.Error(w, "invalid case id", http.StatusBadRequest)
		return
	}

	userID, _ := r.Context().Value(middleware.CtxUserID).(uint)
	role, _ := r.Context().Value(middleware.CtxRole).(string)
	role = strings.ToLower(strings.TrimSpace(role))

	var pc model.PsychCase
	if err := h.db.Where("id = ?", caseID).First(&pc).Error; err != nil {
		http.Error(w, "Case not found", http.StatusNotFound)
		return
	}

	// Психолог: только свои или unassigned.
	if role == "psychologist" && pc.PsychologistID != nil && *pc.PsychologistID != userID {
		http.Error(w, "Forbidden: case assigned to another psychologist", http.StatusForbidden)
		return
	}

	var req struct {
		Score *int   `json:"score"`
		Note  string `json:"note"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	if req.Score == nil {
		http.Error(w, "score is required", http.StatusBadRequest)
		return
	}
	if *req.Score < 0 || *req.Score > 100 {
		http.Error(w, "score must be 0-100", http.StatusBadRequest)
		return
	}

	now := time.Now().UTC()
	pc.PsychScore = req.Score
	pc.PsychNote = strings.TrimSpace(req.Note)

	// Auto-assign if psychologist and unassigned.
	if role == "psychologist" && pc.PsychologistID == nil {
		pc.PsychologistID = &userID
	}

	if pc.Zone == "yellow" {
		if *req.Score >= 80 {
			pc.Status = "resolved"
			pc.ResolvedAt = &now
		} else if *req.Score < 60 {
			pc.Status = "escalated"
			pc.Zone = "red"
		} else {
			pc.Status = "in_review"
		}
	} else {
		if *req.Score >= 80 {
			pc.Status = "resolved"
			pc.ResolvedAt = &now
		} else {
			pc.Status = "in_review"
		}
	}

	if err := h.db.Save(&pc).Error; err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}

	_ = json.NewEncoder(w).Encode(formatCaseForRole(pc, role, userID))
}

// ---------------------------------------------------------------------------
// GET /api/v1/psych/cases/{id}/diary
// ---------------------------------------------------------------------------
func (h *PsychCaseHandler) CaseDiary(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	parts := strings.Split(strings.TrimSuffix(r.URL.Path, "/"), "/")
	if len(parts) < 2 {
		http.Error(w, "invalid path", http.StatusBadRequest)
		return
	}
	caseIDStr := parts[len(parts)-2]
	caseID, _ := strconv.ParseUint(caseIDStr, 10, 64)
	if caseID == 0 {
		http.Error(w, "invalid case id", http.StatusBadRequest)
		return
	}

	userID, _ := r.Context().Value(middleware.CtxUserID).(uint)
	role, _ := r.Context().Value(middleware.CtxRole).(string)
	role = strings.ToLower(strings.TrimSpace(role))

	var pc model.PsychCase
	if err := h.db.Where("id = ?", caseID).First(&pc).Error; err != nil {
		http.Error(w, "Case not found", http.StatusNotFound)
		return
	}

	// Yellow → any psychologist gets anonymous text only.
	if pc.Zone == "yellow" && role == "psychologist" {
		_ = json.NewEncoder(w).Encode([]map[string]any{
			{
				"anonymous_text": pc.AnonymousText,
				"ai_score":      pc.AiScore,
				"ai_zone":       pc.AiZone,
			},
		})
		return
	}

	// Red → only assigned psychologist or admin.
	if role == "psychologist" && pc.Zone == "red" {
		if pc.PsychologistID != nil && *pc.PsychologistID != userID {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}
	}

	var entries []model.DiaryEntry
	h.db.Where("user_id = ?", pc.PatientID).Order("created_at DESC").Limit(60).Find(&entries)

	result := make([]map[string]any, 0, len(entries))
	for _, e := range entries {
		result = append(result, stripAiForRole(e, role))
	}
	_ = json.NewEncoder(w).Encode(result)
}

// ---------------------------------------------------------------------------
// formatCaseForRole — формирует ответ в зависимости от роли и назначения.
// ---------------------------------------------------------------------------
func formatCaseForRole(c model.PsychCase, role string, viewerID uint) map[string]any {
	m := map[string]any{
		"id":          c.ID,
		"zone":        c.Zone,
		"status":      c.Status,
		"ai_score":    c.AiScore,
		"ai_zone":     c.AiZone,
		"source_type": c.SourceType,
		"created_at":  c.CreatedAt,
		"updated_at":  c.UpdatedAt,
	}

	if c.PsychologistID != nil {
		m["psychologist_id"] = *c.PsychologistID
		m["is_mine"] = *c.PsychologistID == viewerID
	} else {
		m["is_mine"] = false
	}

	if c.PsychScore != nil {
		m["psych_score"] = *c.PsychScore
	}
	if c.PsychNote != "" {
		m["psych_note"] = c.PsychNote
	}
	if c.ResolvedAt != nil {
		m["resolved_at"] = *c.ResolvedAt
	}

	isAdmin := role == "admin" || role == "super_admin"

	if c.Zone == "yellow" {
		m["anonymous_text"] = c.AnonymousText
		if isAdmin {
			m["patient_id"] = c.PatientID
			if c.DiaryEntryID != nil {
				m["diary_entry_id"] = *c.DiaryEntryID
			}
			if c.ChatAssessmentID != nil {
				m["chat_assessment_id"] = *c.ChatAssessmentID
			}
		}
	} else if c.Zone == "red" {
		isAssigned := c.PsychologistID != nil && *c.PsychologistID == viewerID
		if isAdmin || (role == "psychologist" && (isAssigned || c.PsychologistID == nil)) {
			m["patient_id"] = c.PatientID
			if c.DiaryEntryID != nil {
				m["diary_entry_id"] = *c.DiaryEntryID
			}
			if c.ChatAssessmentID != nil {
				m["chat_assessment_id"] = *c.ChatAssessmentID
			}
		}
	}

	// Include chat assessment details when available.
	if c.ChatAssessmentID != nil && c.ChatAssessment != nil {
		ca := c.ChatAssessment
		m["chat_assessment"] = map[string]any{
			"id":          ca.ID,
			"score":       ca.Score,
			"zone":        ca.Zone,
			"key_signals": ca.KeySignals,
			"reasoning":   ca.Reasoning,
			"urgent":      ca.Urgent,
			"source_type": ca.SourceType,
			"msg_count":   ca.MsgCount,
			"assessed_at": ca.AssessedAt,
		}
	}

	return m
}

func extractTrailingID(path string) uint {
	parts := strings.Split(strings.TrimSuffix(path, "/"), "/")
	if len(parts) == 0 {
		return 0
	}
	id, _ := strconv.ParseUint(parts[len(parts)-1], 10, 64)
	return uint(id)
}
