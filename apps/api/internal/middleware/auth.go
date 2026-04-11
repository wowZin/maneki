package middleware

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/maneki/api/internal/config"
	"github.com/maneki/api/internal/model"
)

// JWTClaims 自定义JWT声明
type JWTClaims struct {
	UserID    string `json:"user_id"`
	Email     string `json:"email"`
	VIPLevel  int    `json:"vip_level"`
	IsSuperuser bool `json:"is_superuser"`
	jwt.RegisteredClaims
}

// AuthMiddleware JWT认证中间件
func AuthMiddleware(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 从Header获取token
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing authorization header"})
			return
		}

		// Bearer token
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid authorization header format"})
			return
		}

		tokenString := parts[1]

		// 解析token
		claims, err := ParseToken(tokenString, cfg.SecretKey)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
			return
		}

		// 将用户信息存入context
		c.Set("user_id", claims.UserID)
		c.Set("user_email", claims.Email)
		c.Set("vip_level", claims.VIPLevel)
		c.Set("is_superuser", claims.IsSuperuser)
		c.Set("claims", claims)

		c.Next()
	}
}

// AdminAuthMiddleware 管理员权限中间件
func AdminAuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		isSuperuser, exists := c.Get("is_superuser")
		if !exists || !isSuperuser.(bool) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "admin access required"})
			return
		}
		c.Next()
	}
}

// VIPAuthMiddleware VIP权限中间件
func VIPAuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		vipLevel, exists := c.Get("vip_level")
		if !exists || vipLevel.(int) < 1 {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "vip access required"})
			return
		}
		c.Next()
	}
}

// GenerateToken 生成JWT token
func GenerateToken(user *model.User, secret string, expire time.Duration) (string, error) {
	now := time.Now()
	claims := JWTClaims{
		UserID:      user.ID.String(),
		Email:       user.Email,
		VIPLevel:    user.VIPLevel,
		IsSuperuser: user.IsSuperuser,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(expire)),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			Issuer:    "maneki-api",
			Subject:   user.ID.String(),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

// ParseToken 解析JWT token
func ParseToken(tokenString string, secret string) (*JWTClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
		return []byte(secret), nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*JWTClaims); ok && token.Valid {
		return claims, nil
	}

	return nil, jwt.ErrInvalidKey
}

// GetCurrentUser 从context获取当前用户ID
func GetCurrentUser(c *gin.Context) (string, bool) {
	userID, exists := c.Get("user_id")
	if !exists {
		return "", false
	}
	return userID.(string), true
}

// GetCurrentVIPLevel 从context获取当前用户VIP等级
func GetCurrentVIPLevel(c *gin.Context) int {
	vipLevel, exists := c.Get("vip_level")
	if !exists {
		return 0
	}
	return vipLevel.(int)
}
