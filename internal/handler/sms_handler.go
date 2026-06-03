package handler

import (
	"encoding/json"
	"fmt"
	"janymda/internal/sms"
	"net/http"
	"strings"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"janymda/internal/model"
)

type SMSHandler struct {
	db *gorm.DB
}

func NewSMSHandler(db *gorm.DB) *SMSHandler {
	return &SMSHandler{db: db}
}

type SendCodeRequest struct {
	Phone string `json:"phone"`
}

type VerifyCodeRequest struct {
	Phone string `json:"phone"`
	Code  string `json:"code"`
}

type ResetPasswordRequest struct {
	Phone       string `json:"phone"`
	Code        string `json:"code"`
	NewPassword string `json:"new_password"`
}

func (h *SMSHandler) SendCode(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	var req SendCodeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"JSON қате"}`, http.StatusBadRequest)
		return
	}

	req.Phone = strings.TrimSpace(req.Phone)
	if req.Phone == "" {
		http.Error(w, `{"error":"Телефон нөмірін енгізіңіз"}`, http.StatusBadRequest)
		return
	}

	code := sms.GenerateCode()
	sms.StoreCode(req.Phone, code)

	method := "sms"
	message := fmt.Sprintf("Janynda: kod: %s", code)
	err := sms.SendSMS(req.Phone, message)
	if err != nil {
		fmt.Printf("[SMS] sms failed, trying call: %v\n", err)
		err = sms.SendCall(req.Phone, code)
		method = "call"
	}
	if err != nil {
		fmt.Printf("[SMS ERROR] %v\n", err)
		http.Error(w, `{"error":"Код жіберу қатесі"}`, http.StatusInternalServerError)
		return
	}

	msg := "SMS код жіберілді"
	if method == "call" {
		msg = "Сізге қоңырау шалынады. Кодты тыңдаңыз."
	}
	json.NewEncoder(w).Encode(map[string]any{
		"message": msg,
		"method":  method,
	})
}

func (h *SMSHandler) VerifyCode(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	var req VerifyCodeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"JSON қате"}`, http.StatusBadRequest)
		return
	}

	req.Phone = strings.TrimSpace(req.Phone)
	req.Code = strings.TrimSpace(req.Code)

	if req.Phone == "" || req.Code == "" {
		http.Error(w, `{"error":"Телефон мен кодты енгізіңіз"}`, http.StatusBadRequest)
		return
	}

	ok, errMsg := sms.VerifyCode(req.Phone, req.Code)
	if !ok {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": errMsg})
		return
	}

	json.NewEncoder(w).Encode(map[string]any{
		"verified": true,
		"message":  "Нөмір расталды",
	})
}

func (h *SMSHandler) ForgotPasswordSendCode(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	var req SendCodeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"JSON қате"}`, http.StatusBadRequest)
		return
	}

	req.Phone = strings.TrimSpace(req.Phone)
	if req.Phone == "" {
		http.Error(w, `{"error":"Телефон нөмірін енгізіңіз"}`, http.StatusBadRequest)
		return
	}

	var u model.User
	if err := h.db.Where("phone = ?", req.Phone).First(&u).Error; err != nil {
		http.Error(w, `{"error":"Бұл нөмір тіркелмеген"}`, http.StatusNotFound)
		return
	}

	code := sms.GenerateCode()
	sms.StoreCode(req.Phone, code)

	method := "sms"
	message := fmt.Sprintf("Janynda: kod: %s", code)
	smsErr := sms.SendSMS(req.Phone, message)
	if smsErr != nil {
		fmt.Printf("[SMS] sms failed, trying call: %v\n", smsErr)
		smsErr = sms.SendCall(req.Phone, code)
		method = "call"
	}
	if smsErr != nil {
		fmt.Printf("[SMS ERROR] %v\n", smsErr)
		http.Error(w, `{"error":"Код жіберу қатесі"}`, http.StatusInternalServerError)
		return
	}

	msg := "SMS код жіберілді"
	if method == "call" {
		msg = "Сізге қоңырау шалынады. Кодты тыңдаңыз."
	}
	json.NewEncoder(w).Encode(map[string]any{
		"message": msg,
		"method":  method,
	})
}

func (h *SMSHandler) CheckCode(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	var req VerifyCodeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"JSON қате"}`, http.StatusBadRequest)
		return
	}

	req.Phone = strings.TrimSpace(req.Phone)
	req.Code = strings.TrimSpace(req.Code)

	if req.Phone == "" || req.Code == "" {
		http.Error(w, `{"error":"Телефон мен кодты енгізіңіз"}`, http.StatusBadRequest)
		return
	}

	ok, errMsg := sms.CheckCode(req.Phone, req.Code)
	if !ok {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": errMsg})
		return
	}

	json.NewEncoder(w).Encode(map[string]any{
		"valid": true,
	})
}

func (h *SMSHandler) ResetPassword(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	var req ResetPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"JSON қате"}`, http.StatusBadRequest)
		return
	}

	req.Phone = strings.TrimSpace(req.Phone)
	req.Code = strings.TrimSpace(req.Code)
	req.NewPassword = strings.TrimSpace(req.NewPassword)

	if req.Phone == "" || req.Code == "" || req.NewPassword == "" {
		http.Error(w, `{"error":"Барлық өрістерді толтырыңыз"}`, http.StatusBadRequest)
		return
	}

	if len(req.NewPassword) < 4 {
		http.Error(w, `{"error":"Құпия сөз кемінде 4 символ болуы керек"}`, http.StatusBadRequest)
		return
	}

	ok, errMsg := sms.VerifyCode(req.Phone, req.Code)
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

	if err := h.db.Model(&model.User{}).Where("phone = ?", req.Phone).Update("password", string(hash)).Error; err != nil {
		http.Error(w, `{"error":"DB қате"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{
		"message": "Құпия сөз сәтті өзгертілді",
	})
}
