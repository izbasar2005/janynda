package captcha

import (
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

var (
	ErrMissingToken       = errors.New("captcha token required")
	ErrVerificationFailed = errors.New("captcha verification failed")
)

func Enabled() bool {
	return strings.TrimSpace(os.Getenv("TURNSTILE_SECRET_KEY")) != ""
}

func ClientIP(r *http.Request) string {
	if xff := strings.TrimSpace(r.Header.Get("X-Forwarded-For")); xff != "" {
		parts := strings.Split(xff, ",")
		if len(parts) > 0 {
			return strings.TrimSpace(parts[0])
		}
	}
	if xrip := strings.TrimSpace(r.Header.Get("X-Real-IP")); xrip != "" {
		return xrip
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

type siteverifyResponse struct {
	Success    bool     `json:"success"`
	ErrorCodes []string `json:"error-codes"`
}

func Verify(r *http.Request, token string) error {
	token = strings.TrimSpace(token)
	if !Enabled() {
		return nil
	}
	if token == "" {
		return ErrMissingToken
	}

	form := url.Values{
		"secret":   {strings.TrimSpace(os.Getenv("TURNSTILE_SECRET_KEY"))},
		"response": {token},
	}
	if ip := ClientIP(r); ip != "" {
		form.Set("remoteip", ip)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.PostForm("https://challenges.cloudflare.com/turnstile/v0/siteverify", form)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	var out siteverifyResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return err
	}
	if !out.Success {
		return ErrVerificationFailed
	}
	return nil
}
