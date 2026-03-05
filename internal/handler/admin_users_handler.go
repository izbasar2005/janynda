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

type AdminUsersHandler struct {
	db *gorm.DB
}

func NewAdminUsersHandler(db *gorm.DB) *AdminUsersHandler {
	return &AdminUsersHandler{db: db}
}

// GET /api/v1/admin/users (admin only)
func (h *AdminUsersHandler) List(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodGet {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	role, _ := r.Context().Value(middleware.CtxRole).(string)
	if role != "admin" {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	var users []model.User
	if err := h.db.Order("id asc").Find(&users).Error; err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}

	// password шықпасын
	for i := range users {
		users[i].Password = ""
	}

	_ = json.NewEncoder(w).Encode(users)
}

type UpdateRoleRequest struct {
	Role string `json:"role"`
}

// PUT /api/v1/admin/users/{id}/role (admin only)
func (h *AdminUsersHandler) UpdateRole(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPut {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	role, _ := r.Context().Value(middleware.CtxRole).(string)
	if role != "admin" {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	// path: /api/v1/admin/users/{id}/role
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/admin/users/")
	path = strings.TrimSuffix(path, "/role")
	id, err := strconv.Atoi(strings.Trim(path, "/"))
	if err != nil || id <= 0 {
		http.Error(w, "Invalid id", http.StatusBadRequest)
		return
	}

	var req UpdateRoleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "JSON қате", http.StatusBadRequest)
		return
	}

	req.Role = strings.TrimSpace(req.Role)
	if req.Role != "patient" && req.Role != "doctor" && req.Role != "admin" {
		http.Error(w, "role қате", http.StatusBadRequest)
		return
	}

	var u model.User
	if err := h.db.First(&u, uint(id)).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			http.Error(w, "Not found", http.StatusNotFound)
			return
		}
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}

	u.Role = req.Role
	if err := h.db.Save(&u).Error; err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}

	u.Password = ""
	_ = json.NewEncoder(w).Encode(u)
}
