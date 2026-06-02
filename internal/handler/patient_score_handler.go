package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"gorm.io/gorm"

	"janymda/internal/middleware"
	"janymda/internal/model"
)

type PatientScoreHandler struct {
	db *gorm.DB
}

func NewPatientScoreHandler(db *gorm.DB) *PatientScoreHandler {
	return &PatientScoreHandler{db: db}
}

// GET /api/v1/psych/patients — пациенты с агрегированной AI-оценкой.
// head_psychologist видит всех (для распределения), psychologist — только закреплённых.
func (h *PatientScoreHandler) ListPatients(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodGet {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	role, _ := r.Context().Value(middleware.CtxRole).(string)
	userID, _ := r.Context().Value(middleware.CtxUserID).(uint)
	role = strings.ToLower(strings.TrimSpace(role))

	var scores []model.PatientAiScore
	q := h.db.Order("score ASC")

	zoneFilter := strings.ToLower(r.URL.Query().Get("zone"))
	if zoneFilter == "green" || zoneFilter == "yellow" || zoneFilter == "red" {
		q = q.Where("zone = ?", zoneFilter)
	}

	if role == "psychologist" {
		ids := model.AssignedPatientIDs(h.db, userID)
		if len(ids) == 0 {
			_ = json.NewEncoder(w).Encode([]map[string]any{})
			return
		}
		q = q.Where("patient_id IN ?", ids)
	}

	// Главный психолог: фильтр по статусу распределения (?assigned=0|1).
	assignedFilter := strings.TrimSpace(r.URL.Query().Get("assigned"))
	if role == "head_psychologist" && (assignedFilter == "0" || assignedFilter == "1") {
		var allAssigned []model.PsychAssignment
		h.db.Select("patient_id").Find(&allAssigned)
		assignedIDs := make([]uint, 0, len(allAssigned))
		for _, a := range allAssigned {
			assignedIDs = append(assignedIDs, a.PatientID)
		}
		if assignedFilter == "1" {
			if len(assignedIDs) == 0 {
				_ = json.NewEncoder(w).Encode([]map[string]any{})
				return
			}
			q = q.Where("patient_id IN ?", assignedIDs)
		} else if len(assignedIDs) > 0 {
			q = q.Where("patient_id NOT IN ?", assignedIDs)
		}
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

	// Закрепление пациентов за психологами (для главного психолога).
	assignMap := make(map[uint]uint)        // patientID -> psychologistID
	psychNameMap := make(map[uint]string)   // psychologistID -> name
	if role == "head_psychologist" && len(patientIDs) > 0 {
		var assigns []model.PsychAssignment
		h.db.Where("patient_id IN ?", patientIDs).Find(&assigns)
		psychIDset := make([]uint, 0, len(assigns))
		for _, a := range assigns {
			assignMap[a.PatientID] = a.PsychologistID
			psychIDset = append(psychIDset, a.PsychologistID)
		}
		if len(psychIDset) > 0 {
			var psychs []model.User
			h.db.Select("id, full_name").Where("id IN ?", psychIDset).Find(&psychs)
			for _, p := range psychs {
				psychNameMap[p.ID] = p.FullName
			}
		}
	}

	result := make([]map[string]any, 0, len(scores))
	for _, s := range scores {
		row := map[string]any{
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
		}
		if role == "head_psychologist" {
			if pid, ok := assignMap[s.PatientID]; ok {
				row["psychologist_id"] = pid
				row["psychologist_name"] = psychNameMap[pid]
			} else {
				row["psychologist_id"] = nil
			}
		}
		result = append(result, row)
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

	role, _ := r.Context().Value(middleware.CtxRole).(string)
	userID, _ := r.Context().Value(middleware.CtxUserID).(uint)
	role = strings.ToLower(strings.TrimSpace(role))
	if role == "psychologist" {
		var cnt int64
		h.db.Model(&model.PsychAssignment{}).
			Where("patient_id = ? AND psychologist_id = ?", uint(patientID), userID).Count(&cnt)
		if cnt == 0 {
			http.Error(w, "Forbidden: пациент закреплён за другим психологом", http.StatusForbidden)
			return
		}
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
