package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/maneki/api/internal/middleware"
	"github.com/maneki/api/internal/model"
	"github.com/maneki/api/internal/service"
)

// AdminMgmtHandler 管理员管理处理器
type AdminMgmtHandler struct {
	adminSvc *service.AdminService
	auditSvc *service.AuditService
}

// NewAdminMgmtHandler 创建管理员管理处理器
func NewAdminMgmtHandler(adminSvc *service.AdminService, auditSvc *service.AuditService) *AdminMgmtHandler {
	return &AdminMgmtHandler{adminSvc: adminSvc, auditSvc: auditSvc}
}

// ListAdmins 获取管理员列表
func (h *AdminMgmtHandler) ListAdmins(c *gin.Context) {
	keyword := c.Query("keyword")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	result, err := h.adminSvc.ListAdmins(c.Request.Context(), keyword, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1005, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": result,
	})
}

// CreateAdminRequest 创建管理员请求
type CreateAdminRequest struct {
	Name     string `json:"name" binding:"required,min=3,max=64"`
	Password string `json:"password" binding:"omitempty,min=6"`
}

// CreateAdmin 创建普通管理员
func (h *AdminMgmtHandler) CreateAdmin(c *gin.Context) {
	var req CreateAdminRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 1000, "message": "请求参数错误: " + err.Error()})
		return
	}

	admin, err := h.adminSvc.CreateAdmin(c.Request.Context(), req.Name, req.Password)
	if err != nil {
		if err.Error() == "admin name already exists" {
			c.JSON(http.StatusConflict, gin.H{"code": 1003, "message": "账户名称已存在"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"code": 1000, "message": err.Error()})
		return
	}

	// 记录审计日志
	if h.auditSvc != nil {
		adminID, _ := middleware.GetCurrentAdminID(c)
		adminName, _ := middleware.GetCurrentAdminName(c)
		_ = h.auditSvc.RecordAuditLog(c.Request.Context(), adminID, adminName, model.AuditActionCreateAdmin, model.AuditTargetAdmin, &admin.ID, admin.Name, "")
	}

	c.JSON(http.StatusCreated, gin.H{
		"code": 0,
		"data": admin,
	})
}

// DisableAdmin 禁用管理员
func (h *AdminMgmtHandler) DisableAdmin(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 1000, "message": "无效的管理员ID"})
		return
	}

	if err := h.adminSvc.DisableAdmin(c.Request.Context(), id); err != nil {
		if err.Error() == "cannot disable the last active super admin" {
			c.JSON(http.StatusForbidden, gin.H{"code": 1004, "message": "不能禁用最后一个启用的超级管理员"})
			return
		}
		if err.Error() == "admin not found" {
			c.JSON(http.StatusNotFound, gin.H{"code": 1005, "message": "管理员不存在"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1005, "message": err.Error()})
		return
	}

	// 记录审计日志
	if h.auditSvc != nil {
		adminID, _ := middleware.GetCurrentAdminID(c)
		adminName, _ := middleware.GetCurrentAdminName(c)
		_ = h.auditSvc.RecordAuditLog(c.Request.Context(), adminID, adminName, model.AuditActionDisableAdmin, model.AuditTargetAdmin, &id, "", "")
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": nil})
}

// EnableAdmin 启用管理员
func (h *AdminMgmtHandler) EnableAdmin(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 1000, "message": "无效的管理员ID"})
		return
	}

	if err := h.adminSvc.EnableAdmin(c.Request.Context(), id); err != nil {
		if err.Error() == "admin not found" {
			c.JSON(http.StatusNotFound, gin.H{"code": 1005, "message": "管理员不存在"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1005, "message": err.Error()})
		return
	}

	// 记录审计日志
	if h.auditSvc != nil {
		adminID, _ := middleware.GetCurrentAdminID(c)
		adminName, _ := middleware.GetCurrentAdminName(c)
		_ = h.auditSvc.RecordAuditLog(c.Request.Context(), adminID, adminName, model.AuditActionEnableAdmin, model.AuditTargetAdmin, &id, "", "")
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": nil})
}
