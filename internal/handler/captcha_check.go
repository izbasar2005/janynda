package handler

import (
	"errors"
	"net/http"

	"janymda/internal/captcha"
)

func requireCaptcha(w http.ResponseWriter, r *http.Request, token string) bool {
	if !captcha.Required(r) {
		return true
	}
	if err := captcha.Verify(r, token); err != nil {
		switch {
		case errors.Is(err, captcha.ErrMissingToken):
			http.Error(w, `{"error":"CAPTCHA талап етіледі"}`, http.StatusBadRequest)
		case errors.Is(err, captcha.ErrVerificationFailed):
			http.Error(w, `{"error":"CAPTCHA расталмады"}`, http.StatusForbidden)
		default:
			http.Error(w, `{"error":"CAPTCHA тексеру қатесі"}`, http.StatusBadGateway)
		}
		return false
	}
	return true
}
