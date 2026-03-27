package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"gorm.io/gorm"

	"janymda/internal/middleware"
	"janymda/internal/model"
	"janymda/internal/realtime"
)

type ConversationHandler struct {
	db  *gorm.DB
	hub *realtime.Hub
}

func NewConversationHandler(db *gorm.DB, hub *realtime.Hub) *ConversationHandler {
	return &ConversationHandler{db: db, hub: hub}
}

// HandleWithID — /api/v1/conversations/:id/messages (GET list, POST send)
func (h *ConversationHandler) HandleWithID(w http.ResponseWriter, r *http.Request) {
	if strings.HasSuffix(r.URL.Path, "/messages") {
		if r.Method == http.MethodGet {
			h.ListMessages(w, r)
			return
		}
		if r.Method == http.MethodPost {
			h.SendMessage(w, r)
			return
		}
	}
	http.Error(w, "Not found", http.StatusNotFound)
}

// GET /api/v1/conversations/by-appointment/:appointmentId — кездесуге чат (бар болса алу, жоқ болса 404; чат таңдаудан кейін пайда болады)
func (h *ConversationHandler) GetByAppointment(w http.ResponseWriter, r *http.Request) {
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
	idStr := strings.TrimPrefix(r.URL.Path, "/api/v1/conversations/by-appointment/")
	idStr = strings.Trim(idStr, "/")
	aid, _ := strconv.ParseUint(idStr, 10, 32)
	if aid == 0 {
		http.Error(w, "Invalid appointment id", http.StatusBadRequest)
		return
	}
	var ap model.Appointment
	if err := h.db.First(&ap, uint(aid)).Error; err != nil {
		http.Error(w, "Not found", http.StatusNotFound)
		return
	}
	if ap.PatientID != userID && ap.DoctorUserID != userID {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}
	var conv model.Conversation
	if err := h.db.Where("appointment_id = ?", ap.ID).First(&conv).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			http.Error(w, "Чат әзірге жоқ. Алдымен 5 мин ескертуде «Чат» немесе «Видео» таңдаңыз.", http.StatusNotFound)
			return
		}
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}
	_ = json.NewEncoder(w).Encode(map[string]any{
		"id":             conv.ID,
		"appointment_id":  conv.AppointmentID,
		"doctor_user_id": conv.DoctorUserID,
		"patient_id":     conv.PatientID,
	})
}

// GET /api/v1/conversations/:id/messages — хабарламалар тізімі
func (h *ConversationHandler) ListMessages(w http.ResponseWriter, r *http.Request) {
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
	idStr := strings.TrimPrefix(r.URL.Path, "/api/v1/conversations/")
	idStr = strings.TrimSuffix(idStr, "/messages")
	idStr = strings.Trim(idStr, "/")
	cid, _ := strconv.ParseUint(idStr, 10, 32)
	if cid == 0 {
		http.Error(w, "Invalid id", http.StatusBadRequest)
		return
	}
	var conv model.Conversation
	if err := h.db.First(&conv, uint(cid)).Error; err != nil {
		http.Error(w, "Not found", http.StatusNotFound)
		return
	}
	if conv.PatientID != userID && conv.DoctorUserID != userID {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}
	var list []model.Message
	if err := h.db.Preload("Sender").Where("conversation_id = ?", conv.ID).Order("created_at ASC").Find(&list).Error; err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}
	out := make([]map[string]any, 0, len(list))
	for _, m := range list {
		senderName := ""
		if m.Sender.ID != 0 {
			senderName = m.Sender.FullName
		}
		out = append(out, map[string]any{
			"id":        m.ID,
			"sender_id": m.SenderUserID,
			"sender_name": senderName,
			"body":      m.Body,
			"video_link": m.VideoLink,
			"is_system": m.IsSystem,
			"created_at": m.CreatedAt,
		})
	}
	_ = json.NewEncoder(w).Encode(out)
}

// POST /api/v1/conversations/:id/messages — хабар жіберу
func (h *ConversationHandler) SendMessage(w http.ResponseWriter, r *http.Request) {
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
	idStr := strings.TrimPrefix(r.URL.Path, "/api/v1/conversations/")
	idStr = strings.TrimSuffix(idStr, "/messages")
	idStr = strings.Trim(idStr, "/")
	cid, _ := strconv.ParseUint(idStr, 10, 32)
	if cid == 0 {
		http.Error(w, "Invalid id", http.StatusBadRequest)
		return
	}
	var conv model.Conversation
	if err := h.db.First(&conv, uint(cid)).Error; err != nil {
		http.Error(w, "Not found", http.StatusNotFound)
		return
	}
	if conv.PatientID != userID && conv.DoctorUserID != userID {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}
	var req struct {
		Body string `json:"body"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "JSON қате", http.StatusBadRequest)
		return
	}
	req.Body = strings.TrimSpace(req.Body)
	if req.Body == "" {
		http.Error(w, "body бос болмауы керек", http.StatusBadRequest)
		return
	}
	if len(req.Body) > 2000 {
		http.Error(w, "Хабар тым ұзын", http.StatusBadRequest)
		return
	}
	msg := model.Message{ConversationID: conv.ID, SenderUserID: userID, Body: req.Body}
	if err := h.db.Create(&msg).Error; err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}

	// broadcast
	if h.hub != nil {
		senderName := ""
		var u model.User
		if err := h.db.First(&u, userID).Error; err == nil {
			senderName = u.FullName
		}
		h.hub.Broadcast(realtime.RoomKey("conversation", conv.ID), map[string]any{
			"type":    "message:new",
			"channel": "conversation",
			"id":      conv.ID,
			"payload": map[string]any{
				"id":          msg.ID,
				"sender_id":   msg.SenderUserID,
				"sender_name": senderName,
				"body":        msg.Body,
				"video_link":  msg.VideoLink,
				"is_system":   msg.IsSystem,
				"created_at":  msg.CreatedAt,
			},
		})
	}
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(msg)
}
