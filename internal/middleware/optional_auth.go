package middleware

import (
	"context"
	"net/http"
	"strings"

	"gorm.io/gorm"

	"janymda/internal/auth"
	"janymda/internal/model"
)

// OptionalAuthJWT runs next. If Authorization Bearer is present and valid, sets user_id and role from DB.
func OptionalAuthJWT(db *gorm.DB, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := r.Header.Get("Authorization")
		if h == "" || !strings.HasPrefix(h, "Bearer ") {
			next.ServeHTTP(w, r)
			return
		}
		tokenStr := strings.TrimSpace(strings.TrimPrefix(h, "Bearer "))
		claims, err := auth.ParseToken(tokenStr)
		if err != nil {
			next.ServeHTTP(w, r)
			return
		}

		var user model.User
		if err := db.Select("id", "role").First(&user, claims.UserID).Error; err != nil {
			next.ServeHTTP(w, r)
			return
		}

		ctx := context.WithValue(r.Context(), CtxUserID, user.ID)
		ctx = context.WithValue(ctx, CtxRole, strings.ToLower(strings.TrimSpace(user.Role)))
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
