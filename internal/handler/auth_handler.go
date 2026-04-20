package handler

import (
	"encoding/json"
	"janymda/internal/auth"
	"net/http"
	"strings"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"janymda/internal/model"
)

type AuthHandler struct {
	db *gorm.DB
}

func NewAuthHandler(db *gorm.DB) *AuthHandler {
	return &AuthHandler{db: db}
}

type RegisterRequest struct {
	FullName string `json:"full_name"`
	Phone    string `json:"phone"`
	Password string `json:"password"`
	Role     string `json:"role"`

	IIN        string `json:"iin"`
	FirstName  string `json:"first_name"`
	LastName   string `json:"last_name"`
	Patronymic string `json:"patronymic"`
	Gender     string `json:"gender"`
}

func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "JSON қате", http.StatusBadRequest)
		return
	}

	req.FullName = strings.TrimSpace(req.FullName)
	req.Phone = strings.TrimSpace(req.Phone)
	req.Role = strings.ToLower(strings.TrimSpace(req.Role))

	if req.FullName == "" || req.Phone == "" || req.Password == "" {
		http.Error(w, "full_name, phone, password міндетті", http.StatusBadRequest)
		return
	}

	if req.Role == "" {
		req.Role = "patient"
	}
	if req.Role != "patient" && req.Role != "volunteer" {
		http.Error(w, "role тек patient немесе volunteer болуы керек", http.StatusBadRequest)
		return
	}

	// парольді hash
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "password hash error", http.StatusInternalServerError)
		return
	}

	u := model.User{
		FullName: req.FullName,
		Phone:    req.Phone,
		Password: string(hash),
		Role:     req.Role,

		IIN:        strings.TrimSpace(req.IIN),
		FirstName:  strings.TrimSpace(req.FirstName),
		LastName:   strings.TrimSpace(req.LastName),
		Patronymic: strings.TrimSpace(req.Patronymic),
		Gender:     strings.TrimSpace(req.Gender),
	}
	if u.FullName == "" {
		u.FullName = strings.TrimSpace(strings.Join([]string{u.LastName, u.FirstName, u.Patronymic}, " "))
	}

	// phone unique тексеріс (gorm error шығарады)
	if err := h.db.Create(&u).Error; err != nil {
		// phone қайталанса
		if strings.Contains(strings.ToLower(err.Error()), "duplicate") ||
			strings.Contains(strings.ToLower(err.Error()), "unique") {
			http.Error(w, "Бұл телефон тіркелген", http.StatusConflict)
			return
		}
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}

	// парольді қайтармаймыз
	u.Password = ""
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(u)
}

type LoginRequest struct {
	Phone    string `json:"phone"`
	Password string `json:"password"`
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "JSON қате", http.StatusBadRequest)
		return
	}

	req.Phone = strings.TrimSpace(req.Phone)

	var u model.User
	if err := h.db.Where("phone = ?", req.Phone).First(&u).Error; err != nil {
		http.Error(w, "Телефон немесе пароль қате", http.StatusUnauthorized)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(req.Password)); err != nil {
		http.Error(w, "Телефон немесе пароль қате", http.StatusUnauthorized)
		return
	}

	var isTherapist bool
	if strings.EqualFold(u.Role, "doctor") {
		var doc model.Doctor
		if err := h.db.Where("user_id = ? AND is_therapist = true", u.ID).First(&doc).Error; err == nil {
			isTherapist = true
		}
	}

	token, err := auth.GenerateToken(u.ID, u.Role, isTherapist)
	if err != nil {
		http.Error(w, "Token error", http.StatusInternalServerError)
		return
	}

	u.Password = ""

	// 🔥 ТЕК ОСЫ БІР JSON
	json.NewEncoder(w).Encode(map[string]any{
		"token": token,
		"user":  u,
	})
}
