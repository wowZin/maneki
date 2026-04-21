package handler

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/maneki/api/internal/middleware"
	"github.com/maneki/api/internal/model"
	"github.com/maneki/api/internal/service"
)

// RebateRuleHandler 返佣规则处理器
type RebateRuleHandler struct {
	svc *service.RebateRuleService
}

// NewRebateRuleHandler 创建返佣规则处理器
func NewRebateRuleHandler(svc *service.RebateRuleService) *RebateRuleHandler {
	return &RebateRuleHandler{svc: svc}
}

// ListRebateRules 获取返佣规则列表
func (h *RebateRuleHandler) ListRebateRules(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	filters := map[string]interface{}{}
	if status := c.Query("status"); status != "" {
		filters["status"] = status
	}
	if agentIDStr := c.Query("agent_id"); agentIDStr != "" {
		if agentID, err := strconv.ParseUint(agentIDStr, 10, 64); err == nil {
			filters["agent_id"] = uint(agentID)
		}
	}

	rules, total, err := h.svc.ListRebateRules(c.Request.Context(), filters, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":      rules,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

// GetRebateRule 获取返佣规则详情
func (h *RebateRuleHandler) GetRebateRule(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的规则ID"})
		return
	}

	rule, err := h.svc.GetRebateRule(c.Request.Context(), uint(id))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if rule == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "规则不存在"})
		return
	}

	c.JSON(http.StatusOK, rule)
}

// createRebateRuleRequest 创建返佣规则请求
type createRebateRuleRequest struct {
	Name           string                   `json:"name" binding:"required,max=128"`
	UnitPrice      float64                  `json:"unit_price" binding:"required,min=0"`
	AgentID        *uint                    `json:"agent_id"`
	StartAt        time.Time                `json:"start_at" binding:"required"`
	EndAt          time.Time                `json:"end_at" binding:"required"`
	IncentiveRules []incentiveRuleRequest   `json:"incentive_rules"`
}

type incentiveRuleRequest struct {
	RangeStart  int      `json:"range_start" binding:"required,min=1"`
	RangeEnd    *int     `json:"range_end"`
	Coefficient float64  `json:"coefficient" binding:"required,min=0"`
}

// CreateRebateRule 创建返佣规则
func (h *RebateRuleHandler) CreateRebateRule(c *gin.Context) {
	var req createRebateRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if !req.EndAt.After(req.StartAt) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "结束时间必须晚于开始时间"})
		return
	}

	adminID, _ := middleware.GetCurrentAdminID(c)

	rule := &model.RebateRule{
		Name:      req.Name,
		UnitPrice: req.UnitPrice,
		AgentID:   req.AgentID,
		StartAt:   req.StartAt,
		EndAt:     req.EndAt,
		Status:    model.RebateStatusActive,
		CreatedBy: uint(adminID),
	}

	var incentives []model.IncentiveRule
	for _, ir := range req.IncentiveRules {
		incentives = append(incentives, model.IncentiveRule{
			RangeStart:  ir.RangeStart,
			RangeEnd:    ir.RangeEnd,
			Coefficient: ir.Coefficient,
		})
	}

	if err := h.svc.CreateRebateRule(c.Request.Context(), rule, incentives); err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, rule)
}

// UpdateRebateRule 更新返佣规则
func (h *RebateRuleHandler) UpdateRebateRule(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的规则ID"})
		return
	}

	var req struct {
		Name           string                 `json:"name"`
		UnitPrice      *float64               `json:"unit_price"`
		StartAt        *time.Time             `json:"start_at"`
		EndAt          *time.Time             `json:"end_at"`
		IncentiveRules []incentiveRuleRequest `json:"incentive_rules"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := map[string]interface{}{}
	if req.Name != "" {
		updates["name"] = req.Name
	}
	if req.UnitPrice != nil {
		updates["unit_price"] = *req.UnitPrice
	}
	if req.StartAt != nil {
		updates["start_at"] = *req.StartAt
	}
	if req.EndAt != nil {
		updates["end_at"] = *req.EndAt
	}

	var incentives []model.IncentiveRule
	if len(req.IncentiveRules) > 0 {
		for _, ir := range req.IncentiveRules {
			incentives = append(incentives, model.IncentiveRule{
				RangeStart:  ir.RangeStart,
				RangeEnd:    ir.RangeEnd,
				Coefficient: ir.Coefficient,
			})
		}
	}

	if err := h.svc.UpdateRebateRule(c.Request.Context(), uint(id), updates, incentives); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "更新成功"})
}

// ToggleRebateRuleStatus 切换返佣规则状态
func (h *RebateRuleHandler) ToggleRebateRuleStatus(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的规则ID"})
		return
	}

	var req struct {
		Status model.RebateStatus `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.svc.ToggleRebateRuleStatus(c.Request.Context(), uint(id), req.Status); err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "状态更新成功"})
}

// DeleteRebateRule 删除返佣规则
func (h *RebateRuleHandler) DeleteRebateRule(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的规则ID"})
		return
	}

	if err := h.svc.DeleteRebateRule(c.Request.Context(), uint(id)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}
