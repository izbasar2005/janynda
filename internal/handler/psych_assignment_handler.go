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

type PsychAssignmentHandler struct {
	db *gorm.DB
}

func NewPsychAssignmentHandler(db *gorm.DB) *PsychAssignmentHandler {
	return &PsychAssignmentHandler{db: db}
}

// GET /api/v1/psych/psychologists — список психологов (для главного психолога).
func (h *PsychAssignmentHandler) ListPsychologists(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodGet {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	var users []model.User
	if err := h.db.Select("id, full_name, phone").
		Where("role = ?", "psychologist").Order("full_name asc").Find(&users).Error; err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}

	// Кол-во закреплённых пациентов на психолога.
	type cnt struct {
		PsychologistID uint
		Cnt            int64
	}
	var counts []cnt
	h.db.Model(&model.PsychAssignment{}).
		Select("psychologist_id, count(*) as cnt").
		Group("psychologist_id").Scan(&counts)
	cntMap := make(map[uint]int64)
	for _, c := range counts {
		cntMap[c.PsychologistID] = c.Cnt
	}

	result := make([]map[string]any, 0, len(users))
	for _, u := range users {
		result = append(result, map[string]any{
			"id":             u.ID,
			"full_name":      u.FullName,
			"phone":          u.Phone,
			"patient_count":  cntMap[u.ID],
		})
	}
	_ = json.NewEncoder(w).Encode(result)
}

type assignRequest struct {
	PatientID      uint `json:"patient_id"`
	PsychologistID uint `json:"psychologist_id"` // 0 — снять закрепление
}

// POST /api/v1/psych/assignments — закрепить/переназначить пациента за психологом.
// psychologist_id = 0 снимает закрепление.
func (h *PsychAssignmentHandler) Assign(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	callerID, _ := r.Context().Value(middleware.CtxUserID).(uint)

	var req assignRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "JSON қате", http.StatusBadRequest)
		return
	}
	if req.PatientID == 0 {
		http.Error(w, "patient_id required", http.StatusBadRequest)
		return
	}

	// Снятие закрепления.
	if req.PsychologistID == 0 {
		if err := h.db.Where("patient_id = ?", req.PatientID).Delete(&model.PsychAssignment{}).Error; err != nil {
			http.Error(w, "DB error", http.StatusInternalServerError)
			return
		}
		// Открепляем активные red-кейсы пациента.
		h.db.Model(&model.PsychCase{}).
			Where("patient_id = ? AND zone = 'red' AND status IN ('open','in_review')", req.PatientID).
			Updates(map[string]any{"psychologist_id": nil, "status": "open"})
		_ = json.NewEncoder(w).Encode(map[string]any{"patient_id": req.PatientID, "psychologist_id": nil})
		return
	}

	// Проверяем, что цель — психолог.
	var target model.User
	if err := h.db.Where("id = ? AND role = ?", req.PsychologistID, "psychologist").First(&target).Error; err != nil {
		http.Error(w, "Психолог табылмады", http.StatusBadRequest)
		return
	}

	// Upsert закрепления.
	var a model.PsychAssignment
	err := h.db.Where("patient_id = ?", req.PatientID).First(&a).Error
	switch {
	case err == nil:
		a.PsychologistID = req.PsychologistID
		a.AssignedBy = callerID
		if e := h.db.Save(&a).Error; e != nil {
			http.Error(w, "DB error", http.StatusInternalServerError)
			return
		}
	case err == gorm.ErrRecordNotFound:
		a = model.PsychAssignment{
			PatientID:      req.PatientID,
			PsychologistID: req.PsychologistID,
			AssignedBy:     callerID,
		}
		if e := h.db.Create(&a).Error; e != nil {
			http.Error(w, "DB error", http.StatusInternalServerError)
			return
		}
	default:
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}

	// Активные red-кейсы пациента сразу переводим на нового психолога.
	h.db.Model(&model.PsychCase{}).
		Where("patient_id = ? AND zone = 'red' AND status IN ('open','in_review')", req.PatientID).
		Updates(map[string]any{"psychologist_id": req.PsychologistID, "status": "in_review"})

	_ = json.NewEncoder(w).Encode(map[string]any{
		"patient_id":      a.PatientID,
		"psychologist_id": a.PsychologistID,
	})
}

// extractAssignmentPatientID parses /api/v1/psych/assignments/{patientID}.
func extractAssignmentPatientID(path string) uint {
	p := strings.TrimPrefix(path, "/api/v1/psych/assignments/")
	p = strings.Trim(p, "/")
	id, _ := strconv.ParseUint(p, 10, 32)
	return uint(id)
}

// DELETE /api/v1/psych/assignments/{patientID} — снять закрепление.
func (h *PsychAssignmentHandler) Unassign(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodDelete {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}
	patientID := extractAssignmentPatientID(r.URL.Path)
	if patientID == 0 {
		http.Error(w, "invalid patient id", http.StatusBadRequest)
		return
	}
	if err := h.db.Where("patient_id = ?", patientID).Delete(&model.PsychAssignment{}).Error; err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}
	h.db.Model(&model.PsychCase{}).
		Where("patient_id = ? AND zone = 'red' AND status IN ('open','in_review')", patientID).
		Updates(map[string]any{"psychologist_id": nil, "status": "open"})
	w.WriteHeader(http.StatusNoContent)
}
