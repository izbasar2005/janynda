package handler

import (
	"encoding/json"
	"net/http"
	"strings"

	"janymda/internal/middleware"
	"janymda/internal/model"

	"golang.org/x/crypto/bcrypt"
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

type UpdateMeRequest struct {
	FullName   *string `json:"full_name"`
	Phone      *string `json:"phone"`
	AvatarURL  *string `json:"avatar_url"`
	IIN        *string `json:"iin"`
	FirstName  *string `json:"first_name"`
	LastName   *string `json:"last_name"`
	Patronymic *string `json:"patronymic"`
	Gender     *string `json:"gender"`
}

func (h *MeHandler) Update(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	userID, ok := r.Context().Value(middleware.CtxUserID).(uint)
	if !ok || userID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req UpdateMeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	var u model.User
	if err := h.db.First(&u, userID).Error; err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	if req.FullName != nil {
		u.FullName = strings.TrimSpace(*req.FullName)
	}
	if req.Phone != nil {
		u.Phone = strings.TrimSpace(*req.Phone)
	}
	if req.AvatarURL != nil {
		u.AvatarURL = strings.TrimSpace(*req.AvatarURL)
	}
	if req.IIN != nil {
		u.IIN = strings.TrimSpace(*req.IIN)
	}
	if req.FirstName != nil {
		u.FirstName = strings.TrimSpace(*req.FirstName)
	}
	if req.LastName != nil {
		u.LastName = strings.TrimSpace(*req.LastName)
	}
	if req.Patronymic != nil {
		u.Patronymic = strings.TrimSpace(*req.Patronymic)
	}
	if req.Gender != nil {
		u.Gender = strings.TrimSpace(*req.Gender)
	}

	// Минимальные проверки
	if strings.TrimSpace(u.FullName) == "" {
		// Егер full_name бос болса, аты/тегі арқылы құрастыруға тырысамыз
		guess := strings.TrimSpace(strings.Join([]string{u.LastName, u.FirstName, u.Patronymic}, " "))
		if guess == "" {
			http.Error(w, "full_name міндетті", http.StatusBadRequest)
			return
		}
		u.FullName = guess
	}
	if strings.TrimSpace(u.Phone) == "" {
		http.Error(w, "phone міндетті", http.StatusBadRequest)
		return
	}

	if err := h.db.Save(&u).Error; err != nil {
		low := strings.ToLower(err.Error())
		if strings.Contains(low, "duplicate") || strings.Contains(low, "unique") {
			http.Error(w, "Бұл телефон тіркелген", http.StatusConflict)
			return
		}
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}

	u.Password = ""
	_ = json.NewEncoder(w).Encode(u)
}

type ChangePasswordRequest struct {
	OldPassword string `json:"old_password"`
	NewPassword string `json:"new_password"`
}

func (h *MeHandler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	userID, ok := r.Context().Value(middleware.CtxUserID).(uint)
	if !ok || userID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req ChangePasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	req.OldPassword = strings.TrimSpace(req.OldPassword)
	req.NewPassword = strings.TrimSpace(req.NewPassword)
	if req.OldPassword == "" || req.NewPassword == "" {
		http.Error(w, "old_password және new_password міндетті", http.StatusBadRequest)
		return
	}
	if len(req.NewPassword) < 6 {
		http.Error(w, "Жаңа пароль кемінде 6 таңба болуы керек", http.StatusBadRequest)
		return
	}
	if req.OldPassword == req.NewPassword {
		http.Error(w, "Жаңа пароль ескі парольмен бірдей болмауы керек", http.StatusBadRequest)
		return
	}

	var u model.User
	if err := h.db.First(&u, userID).Error; err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(req.OldPassword)); err != nil {
		http.Error(w, "Ескі пароль қате", http.StatusUnauthorized)
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "password hash error", http.StatusInternalServerError)
		return
	}

	if err := h.db.Model(&model.User{}).Where("id = ?", userID).Update("password", string(hash)).Error; err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}

	_ = json.NewEncoder(w).Encode(map[string]any{"ok": true})
}
