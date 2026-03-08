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

type AppointmentHandler struct {
	db *gorm.DB
}

func NewAppointmentHandler(db *gorm.DB) *AppointmentHandler {
	return &AppointmentHandler{db: db}
}

type CreateAppointmentRequest struct {
	DoctorUserID uint   `json:"doctor_user_id"`
	StartAt      string `json:"start_at"` // RFC3339: "2026-03-01T10:00:00+05:00"
	Note         string `json:"note"`
}

// POST /api/v1/appointments (patient only)
func (h *AppointmentHandler) Create(w http.ResponseWriter, r *http.Request) {
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

	var req CreateAppointmentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "JSON қате", http.StatusBadRequest)
		return
	}

	req.Note = strings.TrimSpace(req.Note)

	if req.DoctorUserID == 0 || req.StartAt == "" {
		http.Error(w, "doctor_user_id және start_at міндетті", http.StatusBadRequest)
		return
	}

	startAt, err := time.Parse(time.RFC3339, req.StartAt)
	if err != nil {
		http.Error(w, "start_at форматы қате (RFC3339 керек)", http.StatusBadRequest)
		return
	}

	// ---- ТЕКСЕРУ ҮШІН: кез келген уақытқа рұқсат (өткен, толық сағат емес, 9–17 шектеусіз) - кейін қатты ережелерді қайта қосуға болады
	// if startAt.Before(time.Now()) { ... }
	// if startAt.Minute() != 0 ... { ... }
	// if hour < 9 || hour > 16 { ... }

	// doctor user бар ма?
	var u model.User
	if err := h.db.First(&u, req.DoctorUserID).Error; err != nil {
		http.Error(w, "Doctor user not found", http.StatusNotFound)
		return
	}
	if u.Role != "doctor" {
		http.Error(w, "Бұл user doctor емес", http.StatusBadRequest)
		return
	}

	// ---- AVAILABILITY CHECK ----
	// Тек pending және approved бөгеу; canceled/done слоттар бос — сол уақытқа қайта жазылуға болады
	var cnt int64
	err = h.db.Model(&model.Appointment{}).
		Where("doctor_user_id = ? AND start_at = ? AND status IN ?",
			req.DoctorUserID, startAt, []string{model.StatusPending, model.StatusApproved},
		).
		Count(&cnt).Error
	if err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}
	if cnt > 0 {
		http.Error(w, "Орын жоқ (бұл уақыт бос емес)", http.StatusConflict)
		return
	}

	// Сол пациенттің осы дәрігерде, осы уақытта отмена жасалған жазылуы бар болса — оны қайта «Күтуде» етіп жаңартамыз (жаңа қатар қоспаймыз)
	var existing model.Appointment
	if err := h.db.Where("patient_id = ? AND doctor_user_id = ? AND start_at = ? AND status = ?",
		patientID, req.DoctorUserID, startAt, model.StatusCanceled,
	).First(&existing).Error; err == nil {
		existing.Status = model.StatusPending
		existing.Note = req.Note
		if err := h.db.Save(&existing).Error; err != nil {
			http.Error(w, "DB error", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(existing)
		return
	}

	ap := model.Appointment{
		PatientID:    patientID,
		DoctorUserID: req.DoctorUserID,
		StartAt:      startAt,
		Note:         req.Note,
		Status:       model.StatusPending,
	}

	if err := h.db.Create(&ap).Error; err != nil {
		// 🔥 нақты қатені шығарып жіберейік (уақытша debug)
		http.Error(w, err.Error(), http.StatusConflict)
		return
	}

	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(ap)
}

// GET /api/v1/appointments/my
// patient -> өзінікі (patient_id)  (барлығы көрінеді: pending + canceled)
// doctor  -> өзінікі (doctor_user_id) (тек pending көрсетеміз)
func (h *AppointmentHandler) My(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodGet {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	role, _ := r.Context().Value(middleware.CtxRole).(string)
	userID, _ := r.Context().Value(middleware.CtxUserID).(uint)
	if userID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var aps []model.Appointment

	if role == "patient" {
		// Күтуде/Расталды алдымен (жақын уақыт жоғарыда), қалғандары уақыты бойынша (ерте жоғарыда)
		var active, rest []model.Appointment
		h.db.Preload("Doctor").Where("patient_id = ? AND status IN ?", userID, []string{model.StatusPending, model.StatusApproved}).
			Order("start_at desc").Find(&active)
		h.db.Preload("Doctor").Where("patient_id = ? AND status NOT IN ?", userID, []string{model.StatusPending, model.StatusApproved}).
			Order("start_at asc").Find(&rest)
		aps = append(active, rest...)
	} else if role == "doctor" {
		// Дәрігер: барлық жазылулар (Күтуде, Бас тартылды, Өтті) — уақыт бойынша кему
		if err := h.db.Preload("Patient").
			Where("doctor_user_id = ?", userID).
			Order("start_at desc").
			Find(&aps).Error; err != nil {
			http.Error(w, "DB error", http.StatusInternalServerError)
			return
		}
	} else {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	_ = json.NewEncoder(w).Encode(aps)
}

// GET /api/v1/appointments/all (admin only)
func (h *AppointmentHandler) All(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodGet {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	role, _ := r.Context().Value(middleware.CtxRole).(string)
	if strings.ToLower(strings.TrimSpace(role)) != "super_admin" {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	var aps []model.Appointment
	if err := h.db.Preload("Doctor").Preload("Patient").Order("start_at asc").Find(&aps).Error; err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}

	_ = json.NewEncoder(w).Encode(aps)
}

// PATCH /api/v1/appointments/{id}/cancel
// patient only
func (h *AppointmentHandler) Cancel(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPatch {
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

	// URL: /api/v1/appointments/{id}/cancel
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/appointments/")
	// trailing slash болса да жұмыс істесін:
	path = strings.TrimSuffix(path, "/")

	if !strings.HasSuffix(path, "cancel") {
		http.NotFound(w, r)
		return
	}

	// "1/cancel" -> "1"
	idStr := strings.TrimSuffix(path, "cancel")
	idStr = strings.TrimSuffix(idStr, "/")

	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		http.Error(w, "Invalid appointment id", http.StatusBadRequest)
		return
	}

	var ap model.Appointment
	if err := h.db.First(&ap, uint(id)).Error; err != nil {
		http.Error(w, "Appointment not found", http.StatusNotFound)
		return
	}

	if ap.PatientID != patientID {
		http.Error(w, "Бұл жазылу сізге тиесілі емес", http.StatusForbidden)
		return
	}

	if ap.Status == model.StatusCanceled {
		http.Error(w, "Жазылу бұрыннан отмена жасалған", http.StatusBadRequest)
		return
	}
	if ap.Status == model.StatusDone {
		http.Error(w, "Аяқталған жазылуды отмена жасауға болмайды", http.StatusBadRequest)
		return
	}

	// Пациент кездесуге 30 минут қалғанша ғана отмена жасай алады
	loc := time.FixedZone("+05", 5*3600)
	now := time.Now().In(loc)
	startAt := ap.StartAt.In(loc)
	deadline := startAt.Add(-30 * time.Minute)
	if now.After(deadline) || now.Equal(deadline) {
		http.Error(w, "Жазылуды кездесуге 30 минут қалғанша ғана отмена жасауға болады", http.StatusBadRequest)
		return
	}

	ap.Status = model.StatusCanceled

	if err := h.db.Save(&ap).Error; err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}

	_ = json.NewEncoder(w).Encode(map[string]any{
		"message": "Жазылу сәтті отмена жасалды",
		"id":      ap.ID,
		"status":  ap.Status,
	})
}
