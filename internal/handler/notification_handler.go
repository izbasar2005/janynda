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

type NotificationHandler struct {
	db *gorm.DB
}

func NewNotificationHandler(db *gorm.DB) *NotificationHandler {
	return &NotificationHandler{db: db}
}

// HandleWithID — /api/v1/notifications/:id/read немесе .../:id/choice
func (h *NotificationHandler) HandleWithID(w http.ResponseWriter, r *http.Request) {
	p := strings.TrimPrefix(r.URL.Path, "/api/v1/notifications/")
	p = strings.Trim(p, "/")
	parts := strings.Split(p, "/")
	if len(parts) < 2 {
		http.Error(w, "Not found", http.StatusNotFound)
		return
	}
	idStr, suffix := parts[0], parts[1]
	if suffix == "read" && r.Method == http.MethodPost {
		r.URL.Path = "/api/v1/notifications/" + idStr + "/read"
		h.MarkRead(w, r)
		return
	}
	if suffix == "choice" && r.Method == http.MethodPost {
		r.URL.Path = "/api/v1/notifications/" + idStr + "/choice"
		h.SetChoice(w, r)
		return
	}
	http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
}

// GET /api/v1/notifications — менің ескертулерім
func (h *NotificationHandler) List(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodGet {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}
	userID, _ := r.Context().Value(middleware.CtxUserID).(uint)
	if userID == 0 {
		http.Error(w, "Кіріңіз", http.StatusUnauthorized)
		return
	}
	var list []model.Notification
	if err := h.db.Preload("Appointment").Preload("Appointment.Doctor").Preload("Appointment.Patient").
		Where("user_id = ?", userID).Order("created_at DESC").Limit(100).Find(&list).Error; err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}
	out := make([]map[string]any, 0, len(list))
	for _, n := range list {
		ap := n.Appointment
		doctorName := ""
		patientName := ""
		if ap.ID != 0 {
			if ap.Doctor.ID != 0 {
				doctorName = ap.Doctor.FullName
			}
			if ap.Patient.ID != 0 {
				patientName = ap.Patient.FullName
			}
		}
		item := map[string]any{
			"id":              n.ID,
			"type":            n.Type,
			"choice":          n.Choice,
			"read_at":         n.ReadAt,
			"created_at":      n.CreatedAt,
			"appointment_id":  n.AppointmentID,
			"start_at":        ap.StartAt,
			"doctor_name":     doctorName,
			"patient_name":    patientName,
		}
		// Дәрігер үшін: 5мин ескертуде әрқашан patient_choice беру (дәрігерге таңдау батырмасы көрсетілмесін)
		if n.Type == model.NotificationType5Min && ap.ID != 0 && ap.DoctorUserID == userID {
			patientChoice := ""
			var patientNotif model.Notification
			if err := h.db.Where("user_id = ? AND appointment_id = ? AND type = ?", ap.PatientID, n.AppointmentID, model.NotificationType5Min).First(&patientNotif).Error; err == nil {
				patientChoice = patientNotif.Choice
			}
			item["patient_choice"] = patientChoice
		}
		out = append(out, item)
	}
	_ = json.NewEncoder(w).Encode(out)
}

// POST /api/v1/notifications/:id/read — оқылды деп белгілеу
func (h *NotificationHandler) MarkRead(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}
	userID, _ := r.Context().Value(middleware.CtxUserID).(uint)
	if userID == 0 {
		http.Error(w, "Кіріңіз", http.StatusUnauthorized)
		return
	}
	idStr := strings.TrimPrefix(r.URL.Path, "/api/v1/notifications/")
	idStr = strings.TrimSuffix(idStr, "/read")
	id, _ := strconv.ParseUint(idStr, 10, 32)
	if id == 0 {
		http.Error(w, "Invalid id", http.StatusBadRequest)
		return
	}
	var n model.Notification
	if err := h.db.First(&n, uint(id)).Error; err != nil || n.UserID != userID {
		http.Error(w, "Not found", http.StatusNotFound)
		return
	}
	now := time.Now()
	n.ReadAt = &now
	if err := h.db.Save(&n).Error; err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]any{"ok": true})
}

// POST /api/v1/notifications/:id/choice — 5мин таңдау: in_person | chat | video
func (h *NotificationHandler) SetChoice(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}
	userID, _ := r.Context().Value(middleware.CtxUserID).(uint)
	if userID == 0 {
		http.Error(w, "Кіріңіз", http.StatusUnauthorized)
		return
	}
	idStr := strings.TrimPrefix(r.URL.Path, "/api/v1/notifications/")
	idStr = strings.TrimSuffix(idStr, "/choice")
	id, _ := strconv.ParseUint(idStr, 10, 32)
	if id == 0 {
		http.Error(w, "Invalid id", http.StatusBadRequest)
		return
	}
	var req struct {
		Choice string `json:"choice"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "JSON қате", http.StatusBadRequest)
		return
	}
	req.Choice = strings.TrimSpace(req.Choice)
	if req.Choice != model.ChoiceInPerson && req.Choice != model.ChoiceChat && req.Choice != model.ChoiceVideo {
		http.Error(w, "choice: in_person, chat немесе video", http.StatusBadRequest)
		return
	}
	var n model.Notification
	if err := h.db.Preload("Appointment").First(&n, uint(id)).Error; err != nil || n.UserID != userID {
		http.Error(w, "Not found", http.StatusNotFound)
		return
	}
	if n.Type != model.NotificationType5Min {
		http.Error(w, "Тек 5мин ескертуде таңдау беріледі", http.StatusBadRequest)
		return
	}
	// Тек пациент таңдай алады; дәрігерге таңдау мүмкіндігі жоқ
	if n.Appointment.ID != 0 && n.Appointment.DoctorUserID == userID {
		http.Error(w, "Таңдау тек пациентке беріледі. Дәрігер тек пациенттің таңдауын көреді.", http.StatusForbidden)
		return
	}
	n.Choice = req.Choice
	now := time.Now()
	n.ReadAt = &now
	if err := h.db.Save(&n).Error; err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}
	ap := n.Appointment
	if ap.ID == 0 {
		var app model.Appointment
		if h.db.First(&app, n.AppointmentID).Error != nil {
			_ = json.NewEncoder(w).Encode(map[string]any{"ok": true, "choice": req.Choice})
			return
		}
		ap = app
	}
	if req.Choice == model.ChoiceChat || req.Choice == model.ChoiceVideo {
		var conv model.Conversation
		err := h.db.Where("appointment_id = ?", ap.ID).First(&conv).Error
		if err != nil && err == gorm.ErrRecordNotFound {
			conv = model.Conversation{AppointmentID: ap.ID, DoctorUserID: ap.DoctorUserID, PatientID: ap.PatientID}
			if h.db.Create(&conv).Error != nil {
				_ = json.NewEncoder(w).Encode(map[string]any{"ok": true, "choice": req.Choice})
				return
			}
		}
		if req.Choice == model.ChoiceVideo {
			videoURL := "https://meet.jit.si/Janymda-" + strconv.FormatUint(uint64(ap.ID), 10)
			msg := model.Message{ConversationID: conv.ID, SenderUserID: ap.DoctorUserID, Body: "Видеоконсультация сілтемесі", VideoLink: videoURL, IsSystem: true}
			h.db.Create(&msg)
		}
	}
	_ = json.NewEncoder(w).Encode(map[string]any{"ok": true, "choice": req.Choice})
}
