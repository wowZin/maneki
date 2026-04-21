package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// ErrorResponse 统一错误响应格式
type ErrorResponse struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

// ErrorHandler 全局错误处理中间件
func ErrorHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if err := recover(); err != nil {
				// 已 panic，由 gin.Recovery 处理，这里只补充统一响应格式
				c.JSON(http.StatusInternalServerError, ErrorResponse{
					Code:    1005,
					Message: "服务器内部错误",
				})
				c.Abort()
			}
		}()

		c.Next()

		// 如果已经有响应写入，跳过
		if c.Writer.Written() {
			return
		}

		// 处理 gin 的错误
		if len(c.Errors) > 0 {
			// 只取第一个错误
			err := c.Errors[0]
			c.JSON(http.StatusInternalServerError, ErrorResponse{
				Code:    1005,
				Message: err.Error(),
			})
			c.Abort()
		}
	}
}

// NoRouteHandler 404 统一处理
func NoRouteHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Code:    1005,
			Message: "接口不存在",
		})
	}
}

// NoMethodHandler 405 统一处理
func NoMethodHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusMethodNotAllowed, ErrorResponse{
			Code:    1005,
			Message: "请求方法不允许",
		})
	}
}
