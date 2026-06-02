package auth

import (
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// HS256 keys should be long and unpredictable; shorter secrets are rejected.
const minJWTSecretLen = 32

type Claims struct {
	UserID      uint   `json:"user_id"`
	Role        string `json:"role"`
	IsTherapist bool   `json:"is_therapist,omitempty"`
	jwt.RegisteredClaims
}

func jwtSigningKey() ([]byte, error) {
	s := strings.TrimSpace(os.Getenv("JWT_SECRET"))
	if s == "" {
		return nil, errors.New("JWT_SECRET is required (no default is allowed)")
	}
	if len(s) < minJWTSecretLen {
		return nil, fmt.Errorf("JWT_SECRET must be at least %d characters", minJWTSecretLen)
	}
	return []byte(s), nil
}

// ValidateJWTSecretFromEnv fails fast at process start if JWT is misconfigured.
func ValidateJWTSecretFromEnv() error {
	_, err := jwtSigningKey()
	return err
}

func GenerateToken(userID uint, role string, isTherapist bool) (string, error) {
	claims := Claims{
		UserID:      userID,
		Role:        role,
		IsTherapist: isTherapist,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "janymda",
		},
	}

	key, err := jwtSigningKey()
	if err != nil {
		return "", err
	}
	t := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return t.SignedString(key)
}

func ParseToken(tokenStr string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (any, error) {
		// алгоритм тексеру (қауіпсіздік)
		if t.Method != jwt.SigningMethodHS256 {
			return nil, errors.New("unexpected signing method")
		}
		return jwtSigningKey()
	})
	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token")
	}
	return claims, nil
}
