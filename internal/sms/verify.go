package sms

import (
	"crypto/rand"
	"fmt"
	"math/big"
	"sync"
	"time"
)

type smsCode struct {
	Code      string
	ExpiresAt time.Time
	Attempts  int
}

var (
	codes   = make(map[string]*smsCode) // key = phone
	codesMu sync.Mutex
)

const (
	codeLength = 4
	codeTTL    = 5 * time.Minute
	maxAttempts = 5
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

func IsPhoneVerified(phone string) bool {
	codesMu.Lock()
	defer codesMu.Unlock()
	_, exists := codes[phone]
	return !exists
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
