package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"gorm.io/gorm"

	"janymda/internal/model"
)

type AdminDoctorsHandler struct {
	db *gorm.DB
}

func NewAdminDoctorsHandler(db *gorm.DB) *AdminDoctorsHandler {
	return &AdminDoctorsHandler{db: db}
}

// GET /api/v1/admin/doctor-users
// role=doctor user-лер тізімі + profile бар/жоқ
type DoctorUserItem struct {
	UserID     uint   `json:"user_id"`
	FullName   string `json:"full_name"`
	Phone      string `json:"phone"`
	HasProfile bool   `json:"has_profile"`

	Specialty  string `json:"specialty,omitempty"`
	Experience int    `json:"experience,omitempty"`
	Price      int    `json:"price,omitempty"`

	PhotoURL  string `json:"photo_url,omitempty"` // 🆕
	Education string `json:"education,omitempty"` // 🆕
	Languages string `json:"languages,omitempty"` // 🆕
}

func (h *AdminDoctorsHandler) ListDoctorUsers(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodGet {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	var users []model.User
	if err := h.db.Where("role = ?", "doctor").Order("id asc").Find(&users).Error; err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}

	out := make([]DoctorUserItem, 0, len(users))
	for _, u := range users {
		item := DoctorUserItem{
			UserID:   u.ID,
			FullName: u.FullName,
			Phone:    u.Phone,
		}

		var doc model.Doctor
		err := h.db.Where("user_id = ?", u.ID).First(&doc).Error
		if err == nil {
			item.HasProfile = true
			item.Specialty = doc.Specialty
			item.Experience = doc.Experience
			item.Price = doc.Price

			item.PhotoURL = doc.PhotoURL
			item.Education = doc.Education
			item.Languages = doc.Languages
		} else if err == gorm.ErrRecordNotFound {
			item.HasProfile = false
		} else {
			http.Error(w, "DB error", http.StatusInternalServerError)
			return
		}

		out = append(out, item)
	}

	_ = json.NewEncoder(w).Encode(out)
}

// POST /api/v1/admin/doctors
type CreateDoctorProfileRequest struct {
	UserID     uint   `json:"user_id"`
	Specialty  string `json:"specialty"`
	Experience int    `json:"experience"`
	Price      int    `json:"price"`

	PhotoURL  string `json:"photo_url"` // 🆕
	Education string `json:"education"` // 🆕
	Languages string `json:"languages"` // 🆕
}

func (h *AdminDoctorsHandler) CreateDoctorProfile(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	var req CreateDoctorProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "JSON қате", http.StatusBadRequest)
		return
	}

	req.Specialty = strings.TrimSpace(req.Specialty)
	req.PhotoURL = strings.TrimSpace(req.PhotoURL)
	req.Education = strings.TrimSpace(req.Education)
	req.Languages = strings.TrimSpace(req.Languages)

	if req.UserID == 0 || req.Specialty == "" || req.Experience < 0 || req.Price < 0 {
		http.Error(w, "Деректер қате", http.StatusBadRequest)
		return
	}

	// user бар ма және role doctor ма?
	var u model.User
	if err := h.db.First(&u, req.UserID).Error; err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}
	if u.Role != "doctor" {
		http.Error(w, "User role is not doctor", http.StatusBadRequest)
		return
	}

	// profile бар ма?
	var exists model.Doctor
	err := h.db.Where("user_id = ?", req.UserID).First(&exists).Error
	if err == nil {
		http.Error(w, "Doctor profile already exists", http.StatusBadRequest)
		return
	}
	if err != gorm.ErrRecordNotFound {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}

	doc := model.Doctor{
		UserID:     req.UserID,
		Specialty:  req.Specialty,
		Experience: req.Experience,
		Price:      req.Price,

		PhotoURL:  req.PhotoURL,
		Education: req.Education,
		Languages: req.Languages,
	}

	if err := h.db.Create(&doc).Error; err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(doc)
}

// PUT /api/v1/admin/doctors/{user_id}
type UpdateDoctorProfileRequest struct {
	Specialty  string `json:"specialty"`
	Experience int    `json:"experience"`
	Price      int    `json:"price"`

	PhotoURL  string `json:"photo_url"` // 🆕
	Education string `json:"education"` // 🆕
	Languages string `json:"languages"` // 🆕
}

func (h *AdminDoctorsHandler) UpdateDoctorProfile(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPut {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	// path: /api/v1/admin/doctors/{user_id}
	userIDStr := strings.TrimPrefix(r.URL.Path, "/api/v1/admin/doctors/")
	userID, err := strconv.Atoi(userIDStr)
	if err != nil || userID <= 0 {
		http.Error(w, "Invalid user_id", http.StatusBadRequest)
		return
	}

	var req UpdateDoctorProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "JSON қате", http.StatusBadRequest)
		return
	}

	req.Specialty = strings.TrimSpace(req.Specialty)
	req.PhotoURL = strings.TrimSpace(req.PhotoURL)
	req.Education = strings.TrimSpace(req.Education)
	req.Languages = strings.TrimSpace(req.Languages)

	if req.Specialty == "" || req.Experience < 0 || req.Price < 0 {
		http.Error(w, "Деректер қате", http.StatusBadRequest)
		return
	}

	var doc model.Doctor
	if err := h.db.Where("user_id = ?", uint(userID)).First(&doc).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			http.Error(w, "Doctor profile not found", http.StatusNotFound)
			return
		}
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}

	doc.Specialty = req.Specialty
	doc.Experience = req.Experience
	doc.Price = req.Price

	doc.PhotoURL = req.PhotoURL
	doc.Education = req.Education
	doc.Languages = req.Languages

	if err := h.db.Save(&doc).Error; err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}

	_ = json.NewEncoder(w).Encode(doc)
}
