package handler

import (
	"encoding/json"
	"net/http"

	"janymda/internal/middleware"
	"janymda/internal/model"

	"gorm.io/gorm"
)

type MeHandler struct {
	db *gorm.DB
}

func NewMeHandler(db *gorm.DB) *MeHandler {
	return &MeHandler{db: db}
}

func (h *MeHandler) Me(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	userID, ok := r.Context().Value(middleware.CtxUserID).(uint)
	if !ok || userID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var u model.User
	if err := h.db.First(&u, userID).Error; err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	u.Password = ""
	_ = json.NewEncoder(w).Encode(u)
}
