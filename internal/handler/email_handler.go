package handler

import (
	"encoding/json"
	"fmt"
	"janymda/internal/email"
	"janymda/internal/middleware"
	"janymda/internal/model"
	"janymda/internal/sms"
	"net/http"
	"strings"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type EmailHandler struct {
	db *gorm.DB
}

func NewEmailHandler(db *gorm.DB) *EmailHandler {
	return &EmailHandler{db: db}
}

type EmailSendCodeRequest struct {
	Email        string `json:"email"`
	CaptchaToken string `json:"captcha_token"`
}

type EmailVerifyRequest struct {
	Email string `json:"email"`
	Code  string `json:"code"`
}

type EmailResetPasswordRequest struct {
	Email       string `json:"email"`
	Code        string `json:"code"`
	NewPassword string `json:"new_password"`
}

// SendEmailCode sends verification code to user's email (for profile verification).
func (h *EmailHandler) SendEmailCode(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, ok := r.Context().Value(middleware.CtxUserID).(uint)
	if !ok || userID == 0 {
		http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req EmailSendCodeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"JSON қате"}`, http.StatusBadRequest)
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.Email == "" || !strings.Contains(req.Email, "@") {
		http.Error(w, `{"error":"Email енгізіңіз"}`, http.StatusBadRequest)
		return
	}

	code := sms.GenerateCode()
	sms.StoreCode("email:"+req.Email, code)

	if err := email.SendCode(req.Email, code); err != nil {
		fmt.Printf("[EMAIL ERROR] %v\n", err)
		http.Error(w, `{"error":"Email жіберу қатесі"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{
		"message": "Код email-ге жіберілді",
	})
}

// VerifyEmailCode verifies the code and saves email to user profile.
func (h *EmailHandler) VerifyEmailCode(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, ok := r.Context().Value(middleware.CtxUserID).(uint)
	if !ok || userID == 0 {
		http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req EmailVerifyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"JSON қате"}`, http.StatusBadRequest)
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.Code = strings.TrimSpace(req.Code)

	if req.Email == "" || req.Code == "" {
		http.Error(w, `{"error":"Email мен кодты енгізіңіз"}`, http.StatusBadRequest)
		return
	}

	ok2, errMsg := sms.VerifyCode("email:"+req.Email, req.Code)
	if !ok2 {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": errMsg})
		return
	}

	if err := h.db.Model(&model.User{}).Where("id = ?", userID).Update("email", req.Email).Error; err != nil {
		http.Error(w, `{"error":"DB қате"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]any{
		"verified": true,
		"message":  "Email расталды және сақталды",
	})
}

// ForgotPasswordEmailSendCode sends reset code to user's registered email.
func (h *EmailHandler) ForgotPasswordEmailSendCode(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	var req EmailSendCodeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"JSON қате"}`, http.StatusBadRequest)
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.Email == "" {
		http.Error(w, `{"error":"Email енгізіңіз"}`, http.StatusBadRequest)
		return
	}

	var u model.User
	if err := h.db.Where("email = ?", req.Email).First(&u).Error; err != nil {
		http.Error(w, `{"error":"Бұл email тіркелмеген"}`, http.StatusNotFound)
		return
	}

	if !requireCaptcha(w, r, req.CaptchaToken) {
		return
	}

	code := sms.GenerateCode()
	sms.StoreCode("email:"+req.Email, code)

	if err := email.SendCode(req.Email, code); err != nil {
		fmt.Printf("[EMAIL ERROR] %v\n", err)
		http.Error(w, `{"error":"Email жіберу қатесі"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{
		"message": "Код email-ге жіберілді",
	})
}

// CheckEmailCode validates the code without consuming it.
func (h *EmailHandler) CheckEmailCode(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	var req EmailVerifyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"JSON қате"}`, http.StatusBadRequest)
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.Code = strings.TrimSpace(req.Code)

	if req.Email == "" || req.Code == "" {
		http.Error(w, `{"error":"Email мен кодты енгізіңіз"}`, http.StatusBadRequest)
		return
	}

	ok, errMsg := sms.CheckCode("email:"+req.Email, req.Code)
	if !ok {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": errMsg})
		return
	}

	json.NewEncoder(w).Encode(map[string]any{
		"valid": true,
	})
}

// ResetPasswordByEmail resets password using email code.
func (h *EmailHandler) ResetPasswordByEmail(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	var req EmailResetPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"JSON қате"}`, http.StatusBadRequest)
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.Code = strings.TrimSpace(req.Code)
	req.NewPassword = strings.TrimSpace(req.NewPassword)

	if req.Email == "" || req.Code == "" || req.NewPassword == "" {
		http.Error(w, `{"error":"Барлық өрістерді толтырыңыз"}`, http.StatusBadRequest)
		return
	}

	if len(req.NewPassword) < 4 {
		http.Error(w, `{"error":"Құпия сөз кемінде 4 символ болуы керек"}`, http.StatusBadRequest)
		return
	}

	ok, errMsg := sms.VerifyCode("email:"+req.Email, req.Code)
	if !ok {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": errMsg})
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, `{"error":"Қате"}`, http.StatusInternalServerError)
		return
	}

	if err := h.db.Model(&model.User{}).Where("email = ?", req.Email).Update("password", string(hash)).Error; err != nil {
		http.Error(w, `{"error":"DB қате"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{
		"message": "Құпия сөз сәтті өзгертілді",
	})
}
