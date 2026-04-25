package middleware

import (
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/maneki/api/internal/config"
)

// CORS 创建 CORS 中间件
func CORS(cfg *config.Config) gin.HandlerFunc {
	allowedOrigins := cfg.CORSOrigins()

	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")

		// 检查 origin 是否允许
		allowOrigin := ""
		if isAllowedOrigin(origin, allowedOrigins) {
			allowOrigin = origin
		}

		if allowOrigin != "" {
			c.Writer.Header().Set("Access-Control-Allow-Origin", allowOrigin)
		}
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, X-Request-Nonce, X-Request-Time")
		c.Writer.Header().Set("Access-Control-Max-Age", "86400")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}

// isAllowedOrigin 检查 origin 是否在允许列表中
func isAllowedOrigin(origin string, allowed []string) bool {
	if origin == "" {
		return true
	}
	for _, a := range allowed {
		if a == "*" || strings.EqualFold(a, origin) {
			return true
		}
		// 支持通配符子域名（兼容带端口的 origin，如 http://dev.maneki.cn:5173）
		if strings.HasPrefix(a, "*.") {
			suffix := a[1:] // .example.com
			// 从 origin 中提取纯域名（去掉协议和端口）
			host := origin
			if idx := strings.Index(host, "://"); idx != -1 {
				host = host[idx+3:]
			}
			if idx := strings.Index(host, ":"); idx != -1 {
				host = host[:idx]
			}
			if strings.HasSuffix(host, suffix) {
				return true
			}
		}
	}
	return false
}
