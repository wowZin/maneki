package handler

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/maneki/api/internal/middleware"
	"github.com/maneki/api/internal/service"
)

// RebateRecordHandler 返佣记录处理器
type RebateRecordHandler struct {
	svc *service.RebateRecordService
}

// NewRebateRecordHandler 创建返佣记录处理器
func NewRebateRecordHandler(svc *service.RebateRecordService) *RebateRecordHandler {
	return &RebateRecordHandler{svc: svc}
}

// CalculateRebate 内部接口：订阅时触发返佣计算
func (h *RebateRecordHandler) CalculateRebate(c *gin.Context) {
	var req struct {
		SubscriptionID uint   `json:"subscription_id" binding:"required"`
		AgentID        uint   `json:"agent_id" binding:"required"`
		CreatorID      uint   `json:"creator_id" binding:"required"`
		UserID         uint   `json:"user_id" binding:"required"`
		Quantity       int    `json:"quantity" binding:"required,min=1"`
		IP             string `json:"ip"`
		DeviceID       string `json:"device_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	record, err := h.svc.CalculateRebate(c.Request.Context(), req.SubscriptionID, req.AgentID, req.CreatorID, req.UserID, req.Quantity, req.IP, req.DeviceID)
	if err != nil {
		if err.Error() == "未找到生效的返佣规则" {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"rebate_record_id": record.ID,
		"amount":           record.Amount,
		"status":           record.Status,
		"arbitrage_tags":   record.ArbitrageTags,
	})
}

// ListRecords 获取返佣记录列表
func (h *RebateRecordHandler) ListRecords(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 { page = 1 }
	if pageSize < 1 || pageSize > 100 { pageSize = 20 }

	filters := map[string]interface{}{}
	if status := c.Query("status"); status != "" {
		filters["status"] = status
	}
	if agentIDStr := c.Query("agent_id"); agentIDStr != "" {
		if id, err := strconv.ParseUint(agentIDStr, 10, 64); err == nil {
			filters["agent_id"] = uint(id)
		}
	}
	if creatorIDStr := c.Query("creator_id"); creatorIDStr != "" {
		if id, err := strconv.ParseUint(creatorIDStr, 10, 64); err == nil {
			filters["creator_id"] = uint(id)
		}
	}
	if startDate := c.Query("start_date"); startDate != "" {
		if t, err := time.Parse("2006-01-02", startDate); err == nil {
			filters["start_date"] = t
		}
	}
	if endDate := c.Query("end_date"); endDate != "" {
		if t, err := time.Parse("2006-01-02", endDate); err == nil {
			filters["end_date"] = t
		}
	}

	records, total, err := h.svc.ListRecords(c.Request.Context(), filters, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": records, "total": total, "page": page, "page_size": pageSize})
}

// GetRecord 获取返佣记录详情
func (h *RebateRecordHandler) GetRecord(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的记录ID"})
		return
	}
	record, err := h.svc.GetRecord(c.Request.Context(), uint(id))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if record == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "记录不存在"})
		return
	}
	c.JSON(http.StatusOK, record)
}

// ReviewRecord 审核返佣记录
func (h *RebateRecordHandler) ReviewRecord(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的记录ID"})
		return
	}
	var req struct {
		Conclusion string `json:"conclusion" binding:"required"`
		Remark     string `json:"remark"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	adminID, _ := middleware.GetCurrentAdminID(c)
	if err := h.svc.ReviewRecord(c.Request.Context(), uint(id), req.Conclusion, req.Remark, uint(adminID)); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "审核完成"})
}
