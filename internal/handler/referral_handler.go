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

type ReferralHandler struct {
	db *gorm.DB
}

func NewReferralHandler(db *gorm.DB) *ReferralHandler {
	return &ReferralHandler{db: db}
}

func (h *ReferralHandler) isTherapist(userID uint) bool {
	var c int64
	h.db.Model(&model.Doctor{}).Where("user_id = ? AND is_therapist = true", userID).Count(&c)
	return c > 0
}

type createReferralRequest struct {
	PatientID     uint   `json:"patient_id"`
	ToSpecialty   string `json:"to_specialty"`
	ToDoctorID    *uint  `json:"to_doctor_id"`
	AppointmentID *uint  `json:"appointment_id"`
	StartAt       string `json:"start_at"`
	Diagnosis     string `json:"diagnosis"`
	Notes         string `json:"notes"`
}

// POST /api/v1/referrals
func (h *ReferralHandler) Create(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, _ := r.Context().Value(middleware.CtxUserID).(uint)
	role, _ := r.Context().Value(middleware.CtxRole).(string)
	if userID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	if !strings.EqualFold(role, "doctor") || !h.isTherapist(userID) {
		http.Error(w, "Тек терапевт бағыт бере алады", http.StatusForbidden)
		return
	}

	var req createReferralRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "JSON қате", http.StatusBadRequest)
		return
	}

	if req.PatientID == 0 || strings.TrimSpace(req.ToSpecialty) == "" {
		http.Error(w, "patient_id және to_specialty міндетті", http.StatusBadRequest)
		return
	}

	var patient model.User
	if err := h.db.First(&patient, req.PatientID).Error; err != nil {
		http.Error(w, "Пациент табылмады", http.StatusNotFound)
		return
	}

	ref := model.Referral{
		PatientID:    req.PatientID,
		FromDoctorID: userID,
		ToDoctorID:   req.ToDoctorID,
		ToSpecialty:  strings.TrimSpace(req.ToSpecialty),
		Diagnosis:    strings.TrimSpace(req.Diagnosis),
		Notes:        strings.TrimSpace(req.Notes),
		Status:       model.ReferralPending,
	}
	if req.AppointmentID != nil && *req.AppointmentID > 0 {
		ref.AppointmentID = req.AppointmentID
	}

	if ref.Diagnosis != "" {
		h.db.Model(&model.User{}).Where("id = ?", req.PatientID).Update("diagnosis", ref.Diagnosis)
	}

	if req.ToDoctorID != nil && *req.ToDoctorID > 0 && strings.TrimSpace(req.StartAt) != "" {
		startAt, err := time.Parse(time.RFC3339, strings.TrimSpace(req.StartAt))
		if err != nil {
			http.Error(w, "start_at форматы қате (RFC3339)", http.StatusBadRequest)
			return
		}

		var docUser model.User
		if err := h.db.First(&docUser, *req.ToDoctorID).Error; err != nil {
			http.Error(w, "Маман табылмады", http.StatusNotFound)
			return
		}

		var cnt int64
		h.db.Model(&model.Appointment{}).
			Where("doctor_user_id = ? AND start_at = ? AND status IN ?",
				*req.ToDoctorID, startAt, []string{model.StatusPending, model.StatusApproved}).
			Count(&cnt)
		if cnt > 0 {
			http.Error(w, "Бұл уақыт бос емес", http.StatusConflict)
			return
		}

		ap := model.Appointment{
			PatientID:    req.PatientID,
			DoctorUserID: *req.ToDoctorID,
			StartAt:      startAt,
			Note:         "Терапевт бағыты: " + ref.ToSpecialty,
			Status:       model.StatusApproved,
		}
		if err := h.db.Create(&ap).Error; err != nil {
			http.Error(w, "Жазылу құру қатесі", http.StatusInternalServerError)
			return
		}
		ref.CreatedAppointmentID = &ap.ID
		ref.Status = model.ReferralBooked
	}

	if err := h.db.Create(&ref).Error; err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}

	h.db.Preload("Patient").Preload("ToDoctor").First(&ref, ref.ID)

	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(ref)
}

// GET /api/v1/referrals/my
func (h *ReferralHandler) ListMy(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodGet {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, _ := r.Context().Value(middleware.CtxUserID).(uint)
	role, _ := r.Context().Value(middleware.CtxRole).(string)
	if userID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var refs []model.Referral
	q := h.db.Preload("Patient").Preload("FromDoctor").Preload("ToDoctor").Preload("BookedAppointment").Order("created_at DESC")

	switch strings.ToLower(role) {
	case "patient":
		q = q.Where("patient_id = ?", userID)
	case "doctor":
		q = q.Where("from_doctor_id = ?", userID)
	case "admin", "super_admin":
		// all
	default:
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	if err := q.Find(&refs).Error; err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}

	_ = json.NewEncoder(w).Encode(refs)
}

// GET /api/v1/referrals/:id
func (h *ReferralHandler) GetByID(w http.ResponseWriter, r *http.Request) {
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

	path := strings.TrimPrefix(r.URL.Path, "/api/v1/referrals/")
	path = strings.Trim(path, "/")
	id, err := strconv.ParseUint(path, 10, 32)
	if err != nil || id == 0 {
		http.Error(w, "Invalid referral id", http.StatusBadRequest)
		return
	}

	var ref model.Referral
	if err := h.db.Preload("Patient").Preload("FromDoctor").Preload("ToDoctor").Preload("BookedAppointment").First(&ref, uint(id)).Error; err != nil {
		http.Error(w, "Not found", http.StatusNotFound)
		return
	}

	role, _ := r.Context().Value(middleware.CtxRole).(string)
	switch strings.ToLower(role) {
	case "patient":
		if ref.PatientID != userID {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}
	case "doctor":
		if ref.FromDoctorID != userID {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}
	case "admin", "super_admin":
		// ok
	default:
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	_ = json.NewEncoder(w).Encode(ref)
}
