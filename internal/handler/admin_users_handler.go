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

// GET /api/v1/admin/users (admin or super_admin)
// admin: patient + doctor; super_admin: только doctor + admin (супер админдер тізімде көрінбейді)
func (h *AdminUsersHandler) List(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodGet {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	role, _ := r.Context().Value(middleware.CtxRole).(string)
	role = strings.ToLower(strings.TrimSpace(role))

	var users []model.User
	switch role {
	case "super_admin":
		if err := h.db.Where("role IN ?", []string{"doctor", "admin"}).Order("id asc").Find(&users).Error; err != nil {
			http.Error(w, "DB error", http.StatusInternalServerError)
			return
		}
	case "admin":
		if err := h.db.Where("role IN ?", []string{"patient", "doctor"}).Order("id asc").Find(&users).Error; err != nil {
			http.Error(w, "DB error", http.StatusInternalServerError)
			return
		}
	default:
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	for i := range users {
		users[i].Password = ""
	}
	_ = json.NewEncoder(w).Encode(users)
}

type UpdateRoleRequest struct {
	Role string `json:"role"`
}

// PUT /api/v1/admin/users/{id}/role
// admin: only patient, doctor, admin. super_admin: patient, doctor, admin, super_admin (супер админды юзер/рөлге қайтаруға болады).
func (h *AdminUsersHandler) UpdateRole(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPut {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	callerRole, _ := r.Context().Value(middleware.CtxRole).(string)
	callerRole = strings.ToLower(strings.TrimSpace(callerRole))
	if callerRole != "admin" && callerRole != "super_admin" {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

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

	req.Role = strings.TrimSpace(strings.ToLower(req.Role))

	// admin cannot set super_admin
	if callerRole == "admin" && req.Role == "super_admin" {
		http.Error(w, "Admin cannot set super_admin", http.StatusForbidden)
		return
	}

	// allowed roles per caller
	if callerRole == "super_admin" {
		if req.Role != "patient" && req.Role != "doctor" && req.Role != "admin" && req.Role != "super_admin" {
			http.Error(w, "role қате", http.StatusBadRequest)
			return
		}
	} else {
		if req.Role != "patient" && req.Role != "doctor" && req.Role != "admin" {
			http.Error(w, "role қате", http.StatusBadRequest)
			return
		}
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

	// super_admin can change only doctor or admin (супер админдер тізімде жоқ, өзгертуге болмайды)
	if callerRole == "super_admin" {
		ur := strings.ToLower(strings.TrimSpace(u.Role))
		if ur != "doctor" && ur != "admin" {
			http.Error(w, "super_admin can only change role of doctor or admin", http.StatusForbidden)
			return
		}
	}

	u.Role = req.Role
	if err := h.db.Save(&u).Error; err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}

	u.Password = ""
	_ = json.NewEncoder(w).Encode(u)
}
