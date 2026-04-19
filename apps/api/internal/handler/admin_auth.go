package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/maneki/api/internal/middleware"
	"github.com/maneki/api/internal/model"
	"github.com/maneki/api/internal/service"
)

// AdminAuthHandler 管理员认证处理器
type AdminAuthHandler struct {
	adminAuthSvc *service.AdminAuthService
	auditSvc     *service.AuditService
}

// NewAdminAuthHandler 创建管理员认证处理器
func NewAdminAuthHandler(adminAuthSvc *service.AdminAuthService, auditSvc *service.AuditService) *AdminAuthHandler {
	return &AdminAuthHandler{adminAuthSvc: adminAuthSvc, auditSvc: auditSvc}
}

// AdminLoginRequest 管理员登录请求
type AdminLoginRequest struct {
	Name     string `json:"name" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// AdminLoginResponse 管理员登录响应
type AdminLoginResponse struct {
	ID                  uint64 `json:"id"`
	Name                string `json:"name"`
	Role                string `json:"role"`
	ForceChangePassword bool   `json:"force_change_password"`
}

// AdminLogin 管理员登录
func (h *AdminAuthHandler) AdminLogin(c *gin.Context) {
	var req AdminLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 1000, "message": "请求参数错误: " + err.Error()})
		return
	}

	result, err := h.adminAuthSvc.Login(c.Request.Context(), req.Name, req.Password)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 1001, "message": "账号或密码错误"})
		return
	}

	// 设置 httpOnly Cookie
	c.SetCookie("admin_token", result.Token, 1800, "/", "", false, true)

	// 记录审计日志
	if h.auditSvc != nil {
		ip := c.ClientIP()
		_ = h.auditSvc.RecordAuditLog(c.Request.Context(), result.Admin.ID, result.Admin.Name, model.AuditActionLogin, "", nil, "", ip)
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": gin.H{
			"token": result.Token,
			"admin": AdminLoginResponse{
				ID:                  result.Admin.ID,
				Name:                result.Admin.Name,
				Role:                string(result.Admin.Role),
				ForceChangePassword: result.ForceChangePassword,
			},
		},
	})
}

// AdminLogout 管理员登出
func (h *AdminAuthHandler) AdminLogout(c *gin.Context) {
	adminID, idExists := middleware.GetCurrentAdminID(c)
	adminName, nameExists := middleware.GetCurrentAdminName(c)
	jti, exists := middleware.GetCurrentAdminJTI(c)
	if exists && jti != "" {
		_ = h.adminAuthSvc.Logout(c.Request.Context(), jti, time.Now().Add(30*time.Minute))
	}

	// 记录审计日志
	if h.auditSvc != nil && idExists && nameExists {
		ip := c.ClientIP()
		_ = h.auditSvc.RecordAuditLog(c.Request.Context(), adminID, adminName, model.AuditActionLogout, "", nil, "", ip)
	}

	// 清除 Cookie
	c.SetCookie("admin_token", "", -1, "/", "", false, true)

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": nil})
}

// AdminChangePasswordRequest 修改密码请求
type AdminChangePasswordRequest struct {
	OldPassword string `json:"old_password" binding:"required"`
	NewPassword string `json:"new_password" binding:"required,min=6"`
}

// AdminChangePassword 管理员修改密码
func (h *AdminAuthHandler) AdminChangePassword(c *gin.Context) {
	var req AdminChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 1000, "message": "请求参数错误: " + err.Error()})
		return
	}

	adminID, exists := middleware.GetCurrentAdminID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 1001, "message": "未登录"})
		return
	}

	if err := h.adminAuthSvc.ChangePassword(c.Request.Context(), adminID, req.OldPassword, req.NewPassword); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 1002, "message": err.Error()})
		return
	}

	// 修改密码后使当前token失效
	jti, exists := middleware.GetCurrentAdminJTI(c)
	if exists && jti != "" {
		_ = h.adminAuthSvc.Logout(c.Request.Context(), jti, time.Now().Add(30*time.Minute))
	}

	// 清除 Cookie
	c.SetCookie("admin_token", "", -1, "/", "", false, true)

	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "密码修改成功，请重新登录"})
}

// AdminMe 获取当前管理员信息
func (h *AdminAuthHandler) AdminMe(c *gin.Context) {
	adminID, idExists := middleware.GetCurrentAdminID(c)
	adminName, nameExists := middleware.GetCurrentAdminName(c)
	adminRole, roleExists := middleware.GetCurrentAdminRole(c)

	if !idExists || !nameExists || !roleExists {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 1001, "message": "未登录"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": gin.H{
			"id":   adminID,
			"name": adminName,
			"role": adminRole,
		},
	})
}
