package jwtutil

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// AdminClaims 管理员JWT声明
type AdminClaims struct {
	AdminID uint64 `json:"admin_id"`
	Name    string `json:"name"`
	Role    string `json:"role"`
	JTI     string `json:"jti"`
	jwt.RegisteredClaims
}

// GenerateAdminToken 生成管理员JWT token，返回 token 和 jti
func GenerateAdminToken(adminID uint64, name, role, secret string, expire time.Duration) (string, string, error) {
	now := time.Now()
	jti := uuid.New().String()

	claims := AdminClaims{
		AdminID: adminID,
		Name:    name,
		Role:    role,
		JTI:     jti,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(expire)),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			Issuer:    "maneki-admin",
			Subject:   fmt.Sprintf("%d", adminID),
			ID:        jti,
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenStr, err := token.SignedString([]byte(secret))
	return tokenStr, jti, err
}

// ParseAdminToken 解析管理员JWT token
func ParseAdminToken(tokenString, secret string) (*AdminClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &AdminClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(secret), nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*AdminClaims); ok && token.Valid {
		return claims, nil
	}

	return nil, fmt.Errorf("invalid token claims")
}

// TokenBlacklist token黑名单接口
type TokenBlacklist interface {
	Add(jti string, ttl time.Duration) error
	IsBlacklisted(jti string) (bool, error)
}
