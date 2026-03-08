package middleware

import (
	"net/http"
	"strings"
)

// SuperAdminOnly allows only role "super_admin" (dashboard, stats, appointments/all).
func SuperAdminOnly(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		role, _ := r.Context().Value(CtxRole).(string)
		if strings.ToLower(strings.TrimSpace(role)) != "super_admin" {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}
