package sms

import (
	"crypto/rand"
	"fmt"
	"math/big"
	"strings"
	"sync"
	"time"
)

type smsCode struct {
	Code      string
	ExpiresAt time.Time
	Attempts  int
}

var (
	codes          = make(map[string]*smsCode) // key = phone
	codesMu        sync.Mutex
	verifiedPhones = make(map[string]time.Time)
	verifiedMu     sync.Mutex
)

const (
	codeLength  = 4
	codeTTL     = 5 * time.Minute
	maxAttempts = 5
	verifiedTTL = 30 * time.Minute
)

func GenerateCode() string {
	code := ""
	for i := 0; i < codeLength; i++ {
		n, _ := rand.Int(rand.Reader, big.NewInt(10))
		code += fmt.Sprintf("%d", n.Int64())
	}
	return code
}

func StoreCode(phone, code string) {
	codesMu.Lock()
	defer codesMu.Unlock()
	codes[phone] = &smsCode{
		Code:      code,
		ExpiresAt: time.Now().Add(codeTTL),
		Attempts:  0,
	}
}

func VerifyCode(phone, code string) (bool, string) {
	codesMu.Lock()
	defer codesMu.Unlock()

	entry, ok := codes[phone]
	if !ok {
		return false, "Код жіберілмеген"
	}

	if time.Now().After(entry.ExpiresAt) {
		delete(codes, phone)
		return false, "Код мерзімі аяқталды"
	}

	entry.Attempts++
	if entry.Attempts > maxAttempts {
		delete(codes, phone)
		return false, "Тым көп әрекет. Жаңа код сұраңыз"
	}

	if entry.Code != code {
		return false, "Код дұрыс емес"
	}

	delete(codes, phone)
	return true, ""
}

// CheckCode validates the code without consuming it (for multi-step flows).
func CheckCode(phone, code string) (bool, string) {
	codesMu.Lock()
	defer codesMu.Unlock()

	entry, ok := codes[phone]
	if !ok {
		return false, "Код жіберілмеген"
	}

	if time.Now().After(entry.ExpiresAt) {
		delete(codes, phone)
		return false, "Код мерзімі аяқталды"
	}

	entry.Attempts++
	if entry.Attempts > maxAttempts {
		delete(codes, phone)
		return false, "Тым көп әрекет. Жаңа код сұраңыз"
	}

	if entry.Code != code {
		return false, "Код дұрыс емес"
	}

	return true, ""
}

// MarkPhoneVerified records that the phone passed SMS verification (registration flow).
func MarkPhoneVerified(phone string) {
	phone = strings.TrimSpace(phone)
	if phone == "" {
		return
	}
	verifiedMu.Lock()
	verifiedPhones[phone] = time.Now().Add(verifiedTTL)
	verifiedMu.Unlock()
}

// IsPhoneVerified reports whether the phone was verified recently and not yet consumed.
func IsPhoneVerified(phone string) bool {
	phone = strings.TrimSpace(phone)
	if phone == "" {
		return false
	}
	verifiedMu.Lock()
	defer verifiedMu.Unlock()
	exp, ok := verifiedPhones[phone]
	if !ok {
		return false
	}
	if time.Now().After(exp) {
		delete(verifiedPhones, phone)
		return false
	}
	return true
}

// ConsumePhoneVerified removes the verified flag after successful registration.
func ConsumePhoneVerified(phone string) {
	phone = strings.TrimSpace(phone)
	if phone == "" {
		return
	}
	verifiedMu.Lock()
	delete(verifiedPhones, phone)
	verifiedMu.Unlock()
}

func init() {
	go cleanupExpiredCodes()
}

func cleanupExpiredCodes() {
	for {
		time.Sleep(10 * time.Minute)
		codesMu.Lock()
		now := time.Now()
		for phone, entry := range codes {
			if now.After(entry.ExpiresAt) {
				delete(codes, phone)
			}
		}
		codesMu.Unlock()
	}
}
