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

// PsychologistOrAdmin allows psychologist, admin, and super_admin.
func PsychologistOrAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		role, _ := r.Context().Value(CtxRole).(string)
		r2 := strings.ToLower(strings.TrimSpace(role))
		if r2 != "psychologist" && r2 != "admin" && r2 != "super_admin" {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}
