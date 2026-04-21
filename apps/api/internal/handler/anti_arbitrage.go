package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/maneki/api/internal/middleware"
	"github.com/maneki/api/internal/model"
	"github.com/maneki/api/internal/service"
)

// AntiArbitrageHandler 防套利规则处理器
type AntiArbitrageHandler struct {
	svc *service.AntiArbitrageService
}

// NewAntiArbitrageHandler 创建防套利规则处理器
func NewAntiArbitrageHandler(svc *service.AntiArbitrageService) *AntiArbitrageHandler {
	return &AntiArbitrageHandler{svc: svc}
}

// ListRules 获取防套利规则列表
func (h *AntiArbitrageHandler) ListRules(c *gin.Context) {
	filters := map[string]interface{}{}
	if status := c.Query("status"); status != "" {
		filters["status"] = status
	}
	if strategyType := c.Query("strategy_type"); strategyType != "" {
		filters["strategy_type"] = strategyType
	}

	rules, err := h.svc.ListRules(c.Request.Context(), filters)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": rules})
}

// GetRule 获取防套利规则详情
func (h *AntiArbitrageHandler) GetRule(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的规则ID"})
		return
	}
	rule, err := h.svc.GetRule(c.Request.Context(), uint(id))
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

// CreateRule 创建防套利规则
func (h *AntiArbitrageHandler) CreateRule(c *gin.Context) {
	var req struct {
		Name         string      `json:"name" binding:"required"`
		StrategyType string      `json:"strategy_type" binding:"required"`
		RuleParams   model.JSON  `json:"rule_params" binding:"required"`
		Action       string      `json:"action" binding:"required"`
		Priority     int         `json:"priority"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	adminID, _ := middleware.GetCurrentAdminID(c)
	rule := &model.AntiArbitrageRule{
		Name:         req.Name,
		StrategyType: model.AntiArbitrageStrategyType(req.StrategyType),
		RuleParams:   req.RuleParams,
		Action:       model.AntiArbitrageAction(req.Action),
		Status:       model.AntiArbitrageStatusActive,
		Priority:     req.Priority,
		CreatedBy:    uint(adminID),
	}

	if err := h.svc.CreateRule(c.Request.Context(), rule); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, rule)
}

// UpdateRule 更新防套利规则
func (h *AntiArbitrageHandler) UpdateRule(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的规则ID"})
		return
	}
	var req struct {
		Name         string     `json:"name"`
		StrategyType string     `json:"strategy_type"`
		RuleParams   model.JSON `json:"rule_params"`
		Action       string     `json:"action"`
		Priority     int        `json:"priority"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := map[string]interface{}{}
	if req.Name != "" { updates["name"] = req.Name }
	if req.StrategyType != "" { updates["strategy_type"] = req.StrategyType }
	if req.Action != "" { updates["action"] = req.Action }
	updates["priority"] = req.Priority

	if err := h.svc.UpdateRule(c.Request.Context(), uint(id), updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "更新成功"})
}

// ToggleStatus 切换状态
func (h *AntiArbitrageHandler) ToggleStatus(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的规则ID"})
		return
	}
	var req struct {
		Status model.AntiArbitrageStatus `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.svc.ToggleStatus(c.Request.Context(), uint(id), req.Status); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "状态更新成功"})
}

// DeleteRule 删除防套利规则
func (h *AntiArbitrageHandler) DeleteRule(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的规则ID"})
		return
	}
	if err := h.svc.DeleteRule(c.Request.Context(), uint(id)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}
