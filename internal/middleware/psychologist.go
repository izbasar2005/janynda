package middleware

import (
	"net/http"
	"strings"
)

func PsychologistOnly(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		role, _ := r.Context().Value(CtxRole).(string)
		if strings.ToLower(strings.TrimSpace(role)) != "psychologist" {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// PsychologistOrHead allows psychologist and head_psychologist (просмотр кабинета).
func PsychologistOrHead(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		role, _ := r.Context().Value(CtxRole).(string)
		r2 := strings.ToLower(strings.TrimSpace(role))
		if r2 != "psychologist" && r2 != "head_psychologist" {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// HeadPsychologistOnly allows only head_psychologist (распределение пациентов).
func HeadPsychologistOnly(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		role, _ := r.Context().Value(CtxRole).(string)
		if strings.ToLower(strings.TrimSpace(role)) != "head_psychologist" {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}
