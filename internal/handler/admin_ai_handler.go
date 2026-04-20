package handler

import (
	"encoding/json"
	"net/http"
	"strings"

	"gorm.io/gorm"

	"janymda/internal/model"
)

type AdminAiHandler struct {
	db *gorm.DB
}

func NewAdminAiHandler(db *gorm.DB) *AdminAiHandler {
	return &AdminAiHandler{db: db}
}

// GET /api/v1/admin/ai-scores — все AI-баллы (последние записи дневника с оценкой).
func (h *AdminAiHandler) AllScores(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodGet {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	zoneFilter := strings.ToLower(r.URL.Query().Get("zone"))

	q := h.db.Model(&model.DiaryEntry{}).
		Where("ai_status = ?", "ready").
		Order("ai_assessed_at DESC")

	if zoneFilter == "green" || zoneFilter == "yellow" || zoneFilter == "red" {
		q = q.Where("ai_zone = ?", zoneFilter)
	}

	var entries []model.DiaryEntry
	if err := q.Limit(200).Find(&entries).Error; err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}

	userIDs := make([]uint, 0, len(entries))
	for _, e := range entries {
		userIDs = append(userIDs, e.UserID)
	}

	userMap := make(map[uint]string)
	if len(userIDs) > 0 {
		var users []model.User
		h.db.Select("id, full_name").Where("id IN ?", userIDs).Find(&users)
		for _, u := range users {
			userMap[u.ID] = u.FullName
		}
	}

	result := make([]map[string]any, 0, len(entries))
	for _, e := range entries {
		m := map[string]any{
			"diary_entry_id": e.ID,
			"user_id":        e.UserID,
			"user_name":      userMap[e.UserID],
			"mood":           e.Mood,
			"text_preview":   truncate(e.Text, 120),
			"created_at":     e.CreatedAt,
		}
		if e.AiScore != nil {
			m["ai_score"] = *e.AiScore
		}
		if e.AiZone != nil {
			m["ai_zone"] = *e.AiZone
		}
		if e.AiUrgent != nil {
			m["ai_urgent"] = *e.AiUrgent
		}
		if e.AiAssessedAt != nil {
			m["ai_assessed_at"] = *e.AiAssessedAt
		}
		result = append(result, m)
	}

	_ = json.NewEncoder(w).Encode(result)
}

// GET /api/v1/admin/psych-cases — все кейсы психолога для админа.
func (h *AdminAiHandler) AllCases(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodGet {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	q := h.db.Model(&model.PsychCase{}).Order("created_at DESC")

	zoneFilter := strings.ToLower(r.URL.Query().Get("zone"))
	if zoneFilter == "yellow" || zoneFilter == "red" {
		q = q.Where("zone = ?", zoneFilter)
	}
	statusFilter := strings.ToLower(r.URL.Query().Get("status"))
	if statusFilter != "" {
		q = q.Where("status = ?", statusFilter)
	}

	var cases []model.PsychCase
	if err := q.Limit(200).Find(&cases).Error; err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}

	patientIDs := make([]uint, 0, len(cases))
	for _, c := range cases {
		patientIDs = append(patientIDs, c.PatientID)
	}
	patientMap := make(map[uint]string)
	if len(patientIDs) > 0 {
		var users []model.User
		h.db.Select("id, full_name").Where("id IN ?", patientIDs).Find(&users)
		for _, u := range users {
			patientMap[u.ID] = u.FullName
		}
	}

	result := make([]map[string]any, 0, len(cases))
	for _, c := range cases {
		m := map[string]any{
			"id":           c.ID,
			"patient_id":   c.PatientID,
			"patient_name": patientMap[c.PatientID],
			"zone":         c.Zone,
			"status":       c.Status,
			"ai_score":     c.AiScore,
			"ai_zone":      c.AiZone,
			"created_at":   c.CreatedAt,
			"updated_at":   c.UpdatedAt,
		}
		if c.PsychologistID != nil {
			m["psychologist_id"] = *c.PsychologistID
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
		if c.AnonymousText != "" {
			m["anonymous_text"] = truncate(c.AnonymousText, 200)
		}
		result = append(result, m)
	}

	_ = json.NewEncoder(w).Encode(result)
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "…"
}
