package middleware

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/maneki/api/internal/config"
	"github.com/maneki/api/pkg/jwtutil"
	"github.com/redis/go-redis/v9"
)

// AdminContextKey 管理员上下文键
type AdminContextKey string

const (
	AdminContextID   AdminContextKey = "admin_id"
	AdminContextName AdminContextKey = "admin_name"
	AdminContextRole AdminContextKey = "admin_role"
	AdminContextJTI  AdminContextKey = "admin_jti"
)

// AdminSystemAuthMiddleware 管理员JWT认证中间件
func AdminSystemAuthMiddleware(cfg *config.Config, redisClient *redis.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		var tokenString string

		// 1. 尝试从 Header 获取 token
		authHeader := c.GetHeader("Authorization")
		if authHeader != "" {
			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) == 2 && strings.ToLower(parts[0]) == "bearer" {
				tokenString = parts[1]
			}
		}

		// 2. 如果 Header 没有，从 Cookie 获取
		if tokenString == "" {
			cookie, err := c.Cookie("admin_token")
			if err == nil && cookie != "" {
				tokenString = cookie
			}
		}

		// 3. 还是没有 token，返回未认证
		if tokenString == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"code": 1001, "message": "未登录或登录已过期"})
			return
		}

		// 解析token
		claims, err := jwtutil.ParseAdminToken(tokenString, cfg.SecretKey)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"code": 1001, "message": "登录已过期，请重新登录"})
			return
		}

		// 检查黑名单（基于jti）
		if redisClient != nil && claims.ID != "" {
			key := fmt.Sprintf("jwt:blacklist:%s", claims.ID)
			exists, _ := redisClient.Exists(c.Request.Context(), key).Result()
			if exists > 0 {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"code": 1001, "message": "登录已失效，请重新登录"})
				return
			}
		}

		// 将管理员信息存入context
		c.Set(string(AdminContextID), claims.AdminID)
		c.Set(string(AdminContextName), claims.Name)
		c.Set(string(AdminContextRole), claims.Role)
		c.Set(string(AdminContextJTI), claims.ID)

		c.Next()
	}
}

// SuperAdminRequiredMiddleware 超级管理员权限中间件
func SuperAdminRequiredMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, exists := c.Get(string(AdminContextRole))
		if !exists || role != "super" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"code": 1004, "message": "需要超级管理员权限"})
			return
		}
		c.Next()
	}
}

// AdminRequiredMiddleware 管理员权限中间件（超级和普通管理员都可通过）
func AdminRequiredMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, exists := c.Get(string(AdminContextRole))
		if !exists || (role != "super" && role != "admin") {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"code": 1004, "message": "需要管理员权限"})
			return
		}
		c.Next()
	}
}

// GetCurrentAdminID 获取当前管理员ID
func GetCurrentAdminID(c *gin.Context) (uint64, bool) {
	adminID, exists := c.Get(string(AdminContextID))
	if !exists {
		return 0, false
	}
	id, ok := adminID.(float64)
	if ok {
		return uint64(id), true
	}
	idInt, ok := adminID.(uint64)
	return idInt, ok
}

// GetCurrentAdminName 获取当前管理员名称
func GetCurrentAdminName(c *gin.Context) (string, bool) {
	name, exists := c.Get(string(AdminContextName))
	if !exists {
		return "", false
	}
	s, ok := name.(string)
	return s, ok
}

// GetCurrentAdminRole 获取当前管理员角色
func GetCurrentAdminRole(c *gin.Context) (string, bool) {
	role, exists := c.Get(string(AdminContextRole))
	if !exists {
		return "", false
	}
	r, ok := role.(string)
	return r, ok
}

// GetCurrentAdminJTI 获取当前管理员JTI
func GetCurrentAdminJTI(c *gin.Context) (string, bool) {
	jti, exists := c.Get(string(AdminContextJTI))
	if !exists {
		return "", false
	}
	j, ok := jti.(string)
	return j, ok
}
