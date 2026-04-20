package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"gorm.io/gorm"

	"janymda/internal/model"
)

type PatientScoreHandler struct {
	db *gorm.DB
}

func NewPatientScoreHandler(db *gorm.DB) *PatientScoreHandler {
	return &PatientScoreHandler{db: db}
}

// GET /api/v1/psych/patients — all patients with their aggregated AI score.
// Accessible by psychologist, admin, super_admin.
func (h *PatientScoreHandler) ListPatients(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodGet {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	var scores []model.PatientAiScore
	q := h.db.Order("score ASC")

	zoneFilter := strings.ToLower(r.URL.Query().Get("zone"))
	if zoneFilter == "green" || zoneFilter == "yellow" || zoneFilter == "red" {
		q = q.Where("zone = ?", zoneFilter)
	}

	if err := q.Find(&scores).Error; err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}

	patientIDs := make([]uint, 0, len(scores))
	for _, s := range scores {
		patientIDs = append(patientIDs, s.PatientID)
	}

	nameMap := make(map[uint]string)
	if len(patientIDs) > 0 {
		var users []model.User
		h.db.Select("id, full_name").Where("id IN ?", patientIDs).Find(&users)
		for _, u := range users {
			nameMap[u.ID] = u.FullName
		}
	}

	// Count open cases per patient.
	type caseCount struct {
		PatientID uint
		Cnt       int64
	}
	var caseCounts []caseCount
	if len(patientIDs) > 0 {
		h.db.Model(&model.PsychCase{}).
			Select("patient_id, count(*) as cnt").
			Where("patient_id IN ? AND status IN ('open','in_review')", patientIDs).
			Group("patient_id").
			Scan(&caseCounts)
	}
	caseMap := make(map[uint]int64)
	for _, cc := range caseCounts {
		caseMap[cc.PatientID] = cc.Cnt
	}

	result := make([]map[string]any, 0, len(scores))
	for _, s := range scores {
		result = append(result, map[string]any{
			"patient_id":   s.PatientID,
			"patient_name": nameMap[s.PatientID],
			"score":        s.Score,
			"zone":         s.Zone,
			"diary_count":  s.DiaryCount,
			"chat_count":   s.ChatCount,
			"min_score":    s.MinScore,
			"max_score":    s.MaxScore,
			"trend":        s.Trend,
			"open_cases":   caseMap[s.PatientID],
			"updated_at":   s.UpdatedAt,
		})
	}

	_ = json.NewEncoder(w).Encode(result)
}

// GET /api/v1/patients/{id}/ai-score — aggregated score for a single patient.
func (h *PatientScoreHandler) GetPatientScore(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodGet {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	path := strings.TrimPrefix(r.URL.Path, "/api/v1/patients/")
	path = strings.TrimSuffix(path, "/ai-score")
	path = strings.Trim(path, "/")
	patientID, _ := strconv.ParseUint(path, 10, 32)
	if patientID == 0 {
		http.Error(w, "invalid patient id", http.StatusBadRequest)
		return
	}

	var score model.PatientAiScore
	if err := h.db.Where("patient_id = ?", patientID).First(&score).Error; err != nil {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"patient_id":  patientID,
			"score":       nil,
			"zone":        nil,
			"diary_count": 0,
			"chat_count":  0,
			"message":     "Бағалау әлі жоқ",
		})
		return
	}

	var patient model.User
	h.db.Select("id, full_name").Where("id = ?", patientID).First(&patient)

	_ = json.NewEncoder(w).Encode(map[string]any{
		"patient_id":   score.PatientID,
		"patient_name": patient.FullName,
		"score":        score.Score,
		"zone":         score.Zone,
		"diary_count":  score.DiaryCount,
		"chat_count":   score.ChatCount,
		"min_score":    score.MinScore,
		"max_score":    score.MaxScore,
		"trend":        score.Trend,
		"updated_at":   score.UpdatedAt,
	})
}
