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

type PlatformFeedbackHandler struct {
	db *gorm.DB
}

func NewPlatformFeedbackHandler(db *gorm.DB) *PlatformFeedbackHandler {
	return &PlatformFeedbackHandler{db: db}
}

// POST /api/v1/feedback — тек кірген пайдаланушы (шын пікір).
func (h *PlatformFeedbackHandler) Create(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}
	userID, _ := r.Context().Value(middleware.CtxUserID).(uint)
	if userID == 0 {
		http.Error(w, "Пікір қалдыру үшін жүйеге кіріңіз", http.StatusUnauthorized)
		return
	}
	var req struct {
		Text string `json:"text"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "JSON қате", http.StatusBadRequest)
		return
	}
	req.Text = strings.TrimSpace(req.Text)
	if req.Text == "" {
		http.Error(w, "Пікір мәтіні бос болмауы керек", http.StatusBadRequest)
		return
	}
	if len(req.Text) > 2000 {
		http.Error(w, "Пікір тым ұзын", http.StatusBadRequest)
		return
	}
	fb := model.PlatformFeedback{
		UserID: userID,
		Text:   req.Text,
	}
	if err := h.db.Create(&fb).Error; err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(fb)
}

// GET /api/v1/feedback — соңғы пікірлер тізімі. Authorization болса әр элементте is_mine беріледі.
func (h *PlatformFeedbackHandler) List(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodGet {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}
	viewerID, _ := r.Context().Value(middleware.CtxUserID).(uint)
	var list []model.PlatformFeedback
	if err := h.db.Preload("User").Order("created_at DESC").Limit(50).Find(&list).Error; err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}
	out := make([]map[string]any, 0, len(list))
	for _, fb := range list {
		author := "Пациент"
		if fb.User.ID != 0 {
			author = fb.User.FullName
			if author == "" {
				author = "Пациент"
			}
		}
		item := map[string]any{
			"id":         fb.ID,
			"text":       fb.Text,
			"created_at": fb.CreatedAt,
			"author":     author,
		}
		if viewerID != 0 {
			item["is_mine"] = fb.UserID == viewerID
		}
		out = append(out, item)
	}
	_ = json.NewEncoder(w).Encode(out)
}

// DELETE /api/v1/feedback/:id — автор өз пікірін немесе админ кез келген пікірді өшіре алады.
func (h *PlatformFeedbackHandler) Delete(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodDelete {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}
	userID, _ := r.Context().Value(middleware.CtxUserID).(uint)
	if userID == 0 {
		http.Error(w, "Кіріңіз", http.StatusUnauthorized)
		return
	}
	role, _ := r.Context().Value(middleware.CtxRole).(string)
	idStr := strings.TrimPrefix(r.URL.Path, "/api/v1/feedback/")
	idStr = strings.Trim(idStr, "/")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil || id == 0 {
		http.Error(w, "Invalid id", http.StatusBadRequest)
		return
	}
	var fb model.PlatformFeedback
	if err := h.db.First(&fb, uint(id)).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			http.Error(w, "Not found", http.StatusNotFound)
			return
		}
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}
	if role != "admin" && fb.UserID != userID {
		http.Error(w, "Тек өз пікіріңізді немесе админ кез келген пікірді өшіре алады", http.StatusForbidden)
		return
	}
	if err := h.db.Delete(&fb).Error; err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
