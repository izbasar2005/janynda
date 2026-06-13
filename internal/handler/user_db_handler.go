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

// UserDBHandler — қауіпсіз ақпаратты: full_name, role, phone т.б. қайтару.
// Мақсат: чаттағы қарсы тараптың "профилін" көрсету.
type UserDBHandler struct {
	db *gorm.DB
}

func NewUserDBHandler(db *gorm.DB) *UserDBHandler {
	return &UserDBHandler{db: db}
}

// GET /api/v1/users/:id
func (h *UserDBHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodGet {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	uid, _ := r.Context().Value(middleware.CtxUserID).(uint)
	if uid == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	idStr := strings.TrimPrefix(r.URL.Path, "/api/v1/users/")
	idStr = strings.Trim(idStr, "/")
	targetID, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil || targetID == 0 {
		http.Error(w, "Invalid user id", http.StatusBadRequest)
		return
	}

	var u model.User
	if err := h.db.First(&u, uint(targetID)).Error; err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	u.Password = ""
	viewerRole, _ := r.Context().Value(middleware.CtxRole).(string)
	photoURL := strings.TrimSpace(u.AvatarURL)

	// Own profile — full access including phone.
	if uid == u.ID {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"id":         u.ID,
			"full_name":  u.FullName,
			"role":       u.Role,
			"phone":      u.Phone,
			"gender":     u.Gender,
			"iin":        u.IIN,
			"first_name": u.FirstName,
			"last_name":  u.LastName,
			"patronymic": u.Patronymic,
			"created_at": u.CreatedAt,
			"photo_url":  photoURL,
		})
		return
	}

	// Doctor may view extended patient profile only with an appointment relationship.
	if strings.EqualFold(viewerRole, "doctor") && strings.EqualFold(u.Role, "patient") {
		var relCount int64
		if err := h.db.Model(&model.Appointment{}).
			Where("doctor_user_id = ? AND patient_id = ?", uid, u.ID).
			Count(&relCount).Error; err != nil || relCount == 0 {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"id":          u.ID,
			"full_name":   u.FullName,
			"role":        u.Role,
			"phone":       u.Phone,
			"gender":      u.Gender,
			"iin":         u.IIN,
			"first_name":  u.FirstName,
			"last_name":   u.LastName,
			"patronymic":  u.Patronymic,
			"created_at":  u.CreatedAt,
			"photo_url":   "",
			"patient_ext": true,
		})
		return
	}

	// Default: public profile card for chat UI — no phone or IIN.
	_ = json.NewEncoder(w).Encode(map[string]any{
		"id":        u.ID,
		"full_name": u.FullName,
		"role":      u.Role,
		"gender":    u.Gender,
		"photo_url": photoURL,
	})
}
