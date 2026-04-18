package middleware

import (
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
)

// InternalTokenMiddleware 内部服务认证中间件
// 通过 X-Internal-Token Header 验证调用方身份
func InternalTokenMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		token := c.GetHeader("X-Internal-Token")
		expected := os.Getenv("INTERNAL_API_KEY")

		// 如果没有配置 INTERNAL_API_KEY，拒绝所有请求（安全默认）
		if expected == "" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error": "internal api key not configured",
			})
			return
		}

		if token != expected {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error": "invalid internal token",
			})
			return
		}

		c.Next()
	}
}
