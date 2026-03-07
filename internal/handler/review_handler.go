package handler

import (
	"encoding/json"
	"net/http"
	"strings"

	"gorm.io/gorm"

	"janymda/internal/middleware"
	"janymda/internal/model"
)

type ReviewHandler struct {
	db *gorm.DB
}

func NewReviewHandler(db *gorm.DB) *ReviewHandler {
	return &ReviewHandler{db: db}
}

// POST /api/v1/reviews — тек пациент, дәрігерге жазылымы болса ғана, бір пациент бір дәрігерге бір пікір
func (h *ReviewHandler) Create(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}
	role, _ := r.Context().Value(middleware.CtxRole).(string)
	if role != "patient" {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}
	patientID, _ := r.Context().Value(middleware.CtxUserID).(uint)
	if patientID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	var req struct {
		DoctorUserID uint   `json:"doctor_user_id"`
		Rating       int    `json:"rating"`
		Text         string `json:"text"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "JSON қате", http.StatusBadRequest)
		return
	}
	if req.DoctorUserID == 0 {
		http.Error(w, "doctor_user_id міндетті", http.StatusBadRequest)
		return
	}
	if req.Rating < 1 || req.Rating > 5 {
		http.Error(w, "rating 1–5 аралығында болуы керек", http.StatusBadRequest)
		return
	}
	req.Text = strings.TrimSpace(req.Text)

	var u model.User
	if err := h.db.First(&u, req.DoctorUserID).Error; err != nil {
		http.Error(w, "Doctor not found", http.StatusNotFound)
		return
	}
	if u.Role != "doctor" {
		http.Error(w, "Бұл user дәрігер емес", http.StatusBadRequest)
		return
	}

	var hasAppointment int64
	if err := h.db.Model(&model.Appointment{}).Where("patient_id = ? AND doctor_user_id = ?", patientID, req.DoctorUserID).Count(&hasAppointment).Error; err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}
	if hasAppointment == 0 {
		http.Error(w, "Осы дәрігерге жазылымыңыз болуы керек", http.StatusForbidden)
		return
	}

	var exists int64
	if err := h.db.Model(&model.Review{}).Where("patient_id = ? AND doctor_user_id = ?", patientID, req.DoctorUserID).Count(&exists).Error; err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}
	if exists > 0 {
		http.Error(w, "Сіз бұл дәрігерге пікір қалдырғансыз", http.StatusConflict)
		return
	}

	rev := model.Review{
		PatientID:    patientID,
		DoctorUserID: req.DoctorUserID,
		Rating:       req.Rating,
		Text:         req.Text,
	}
	if err := h.db.Create(&rev).Error; err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(rev)
}

// GET /api/v1/reviews/my — қай дәрігерлерге пікір қалдырғаным (doctor_user_id тізімі)
func (h *ReviewHandler) My(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodGet {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}
	userID, _ := r.Context().Value(middleware.CtxUserID).(uint)
	if userID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	var ids []uint
	if err := h.db.Model(&model.Review{}).Where("patient_id = ?", userID).Pluck("doctor_user_id", &ids).Error; err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}
	_ = json.NewEncoder(w).Encode(map[string]any{"doctor_user_ids": ids})
}
