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

	// JWT бар қолданушы ғана шақырады (router арқылы).
	uid, ok := r.Context().Value(middleware.CtxUserID).(uint)
	_ = ok
	if uid == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// /api/v1/users/:id
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

	// Password json tag is "-"
	u.Password = ""

	photoURL := ""
	if strings.EqualFold(u.Role, "doctor") {
		var d model.Doctor
		// Doctor profile сақталатын кесте
		if err := h.db.Where("user_id = ?", u.ID).First(&d).Error; err == nil {
			photoURL = d.PhotoURL
		}
	}

	_ = json.NewEncoder(w).Encode(map[string]any{
		"id":         u.ID,
		"full_name":  u.FullName,
		"role":       u.Role,
		"phone":      u.Phone,
		"gender":     u.Gender,
		"created_at": u.CreatedAt,
		"photo_url":  photoURL,
	})
}

