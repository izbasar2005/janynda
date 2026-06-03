package sms

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
)

var (
	smscLogin = os.Getenv("SMSC_LOGIN")
	smscPsw   = os.Getenv("SMSC_PASSWORD")
)

func Init() {
	smscLogin = os.Getenv("SMSC_LOGIN")
	smscPsw = os.Getenv("SMSC_PASSWORD")
}

type smscResponse struct {
	ID        json.Number `json:"id"`
	Cnt       json.Number `json:"cnt"`
	Error     string      `json:"error"`
	ErrorCode int         `json:"error_code"`
}

func normalizePhone(phone string) string {
	phone = strings.ReplaceAll(phone, " ", "")
	phone = strings.ReplaceAll(phone, "-", "")
	phone = strings.ReplaceAll(phone, "(", "")
	phone = strings.ReplaceAll(phone, ")", "")
	return phone
}

// SendCall отправляет код подтверждения через звонок.
// Абонент получает входящий звонок, последние N цифр номера = код.
func SendCall(phone, code string) error {
	if smscLogin == "" || smscPsw == "" {
		smscLogin = os.Getenv("SMSC_LOGIN")
		smscPsw = os.Getenv("SMSC_PASSWORD")
	}
	if smscLogin == "" || smscPsw == "" {
		return fmt.Errorf("SMSC_LOGIN or SMSC_PASSWORD not configured")
	}

	phone = normalizePhone(phone)

	params := url.Values{}
	params.Set("login", smscLogin)
	params.Set("psw", smscPsw)
	params.Set("phones", phone)
	params.Set("mes", code)
	params.Set("fmt", "3")
	params.Set("call", "1")

	resp, err := http.Get("https://smsc.kz/sys/send.php?" + params.Encode())
	if err != nil {
		return fmt.Errorf("smsc request failed: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	fmt.Printf("[SMSC CALL] sent to %s, response: %s\n", phone, string(body))

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("smsc HTTP %d: %s", resp.StatusCode, string(body))
	}

	var result smscResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return fmt.Errorf("smsc parse error: %w, body: %s", err, string(body))
	}

	if result.ErrorCode != 0 {
		return fmt.Errorf("smsc error %d: %s", result.ErrorCode, result.Error)
	}

	return nil
}

// SendSMS отправляет обычное SMS (может не работать без зарегистрированного Sender ID).
func SendSMS(phone, message string) error {
	if smscLogin == "" || smscPsw == "" {
		smscLogin = os.Getenv("SMSC_LOGIN")
		smscPsw = os.Getenv("SMSC_PASSWORD")
	}
	if smscLogin == "" || smscPsw == "" {
		return fmt.Errorf("SMSC_LOGIN or SMSC_PASSWORD not configured")
	}

	phone = normalizePhone(phone)

	params := url.Values{}
	params.Set("login", smscLogin)
	params.Set("psw", smscPsw)
	params.Set("phones", phone)
	params.Set("mes", message)
	params.Set("charset", "utf-8")
	params.Set("fmt", "3")
	params.Set("translit", "1")

	resp, err := http.Get("https://smsc.kz/sys/send.php?" + params.Encode())
	if err != nil {
		return fmt.Errorf("smsc request failed: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	fmt.Printf("[SMSC] sent to %s, response: %s\n", phone, string(body))

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("smsc HTTP %d: %s", resp.StatusCode, string(body))
	}

	var result smscResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return fmt.Errorf("smsc parse error: %w, body: %s", err, string(body))
	}

	if result.ErrorCode != 0 {
		return fmt.Errorf("smsc error %d: %s", result.ErrorCode, result.Error)
	}

	return nil
}
