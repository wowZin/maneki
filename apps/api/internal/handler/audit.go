package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/maneki/api/internal/model"
	"github.com/maneki/api/internal/service"
)

// AuditHandler 审计日志处理器
type AuditHandler struct {
	auditSvc *service.AuditService
}

// NewAuditHandler 创建审计日志处理器
func NewAuditHandler(auditSvc *service.AuditService) *AuditHandler {
	return &AuditHandler{auditSvc: auditSvc}
}

// ListAuditLogs 获取审计日志列表
func (h *AuditHandler) ListAuditLogs(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")
	adminName := c.Query("admin_name")
	action := model.AuditAction(c.Query("action"))

	result, err := h.auditSvc.ListAuditLogs(c.Request.Context(), startDate, endDate, adminName, action, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1005, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": result,
	})
}

// ExportAuditLogs 导出审计日志
func (h *AuditHandler) ExportAuditLogs(c *gin.Context) {
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")
	adminName := c.Query("admin_name")
	action := model.AuditAction(c.Query("action"))

	csvData, err := h.auditSvc.ExportAuditLogs(c.Request.Context(), startDate, endDate, adminName, action)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1005, "message": err.Error()})
		return
	}

	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", "attachment; filename=audit-logs-"+startDate+".csv")
	c.String(http.StatusOK, csvData)
}
