package handler

import (
	"encoding/json"
	"net/http"

	"janymda/internal/middleware"
)

func Profile(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	userID, _ := r.Context().Value(middleware.CtxUserID).(uint)
	role, _ := r.Context().Value(middleware.CtxRole).(string)

	json.NewEncoder(w).Encode(map[string]any{
		"user_id": userID,
		"role":    role,
	})
}
