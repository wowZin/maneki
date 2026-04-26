package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/maneki/api/internal/middleware"
	"github.com/maneki/api/internal/service"
)

// SignalHandler 信号中心处理器
type SignalHandler struct {
	signalSvc *service.SignalService
}

// NewSignalHandler 创建信号中心处理器
func NewSignalHandler(signalSvc *service.SignalService) *SignalHandler {
	return &SignalHandler{signalSvc: signalSvc}
}

// ============================================
// 信号列表 (US1)
// ============================================

// GetSignals 获取信号列表
func (h *SignalHandler) GetSignals(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	afterIDStr := c.Query("after_id")
	var afterID uint64
	if afterIDStr != "" {
		afterID, _ = strconv.ParseUint(afterIDStr, 10, 64)
	}

	// 尝试获取当前用户（可选认证）
	var userID *uuid.UUID
	if userIDStr, exists := middleware.GetCurrentUser(c); exists {
		if id, err := uuid.Parse(userIDStr); err == nil {
			userID = &id
		}
	}

	resp, err := h.signalSvc.GetSignals(c.Request.Context(), userID, uint(afterID), limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{
			"code":    "INTERNAL_ERROR",
			"message": err.Error(),
		}})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// ============================================
// 关注/取消关注 (US2)
// ============================================

// FollowSignal 关注信号
func (h *SignalHandler) FollowSignal(c *gin.Context) {
	userIDStr, exists := middleware.GetCurrentUser(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": gin.H{
			"code":    "UNAUTHORIZED",
			"message": "请先登录",
		}})
		return
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": gin.H{
			"code":    "UNAUTHORIZED",
			"message": "无效的用户身份",
		}})
		return
	}

	signalIDStr := c.Param("id")
	signalID, err := strconv.ParseUint(signalIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{
			"code":    "INVALID_PARAMETER",
			"message": "无效的信号ID",
		}})
		return
	}

	resp, err := h.signalSvc.FollowSignal(c.Request.Context(), userID, uint(signalID))
	if err != nil {
		if err.Error() == "ALREADY_FOLLOWED" {
			c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{
				"code":    "ALREADY_FOLLOWED",
				"message": "今日已关注该股票",
			}})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{
			"code":    "INTERNAL_ERROR",
			"message": err.Error(),
		}})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// UnfollowSignal 取消关注
func (h *SignalHandler) UnfollowSignal(c *gin.Context) {
	userIDStr, exists := middleware.GetCurrentUser(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": gin.H{
			"code":    "UNAUTHORIZED",
			"message": "请先登录",
		}})
		return
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": gin.H{
			"code":    "UNAUTHORIZED",
			"message": "无效的用户身份",
		}})
		return
	}

	signalIDStr := c.Param("id")
	signalID, err := strconv.ParseUint(signalIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{
			"code":    "INVALID_PARAMETER",
			"message": "无效的信号ID",
		}})
		return
	}

	if err := h.signalSvc.UnfollowSignal(c.Request.Context(), userID, uint(signalID)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{
			"code":    "INTERNAL_ERROR",
			"message": err.Error(),
		}})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// ============================================
// 我的关注与统计 (US3)
// ============================================

// GetMyFollows 获取我的今日关注
func (h *SignalHandler) GetMyFollows(c *gin.Context) {
	userIDStr, exists := middleware.GetCurrentUser(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": gin.H{
			"code":    "UNAUTHORIZED",
			"message": "请先登录",
		}})
		return
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": gin.H{
			"code":    "UNAUTHORIZED",
			"message": "无效的用户身份",
		}})
		return
	}

	resp, err := h.signalSvc.GetMyFollows(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{
			"code":    "INTERNAL_ERROR",
			"message": err.Error(),
		}})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// GetMyStats 获取我的统计
func (h *SignalHandler) GetMyStats(c *gin.Context) {
	userIDStr, exists := middleware.GetCurrentUser(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": gin.H{
			"code":    "UNAUTHORIZED",
			"message": "请先登录",
		}})
		return
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": gin.H{
			"code":    "UNAUTHORIZED",
			"message": "无效的用户身份",
		}})
		return
	}

	period := c.DefaultQuery("period", "7d")
	validPeriods := map[string]bool{"7d": true, "30d": true, "90d": true}
	if !validPeriods[period] {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{
			"code":    "INVALID_PARAMETER",
			"message": "参数 period 不合法，可选值: 7d, 30d, 90d",
		}})
		return
	}

	resp, err := h.signalSvc.GetMyStats(c.Request.Context(), userID, period)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{
			"code":    "INTERNAL_ERROR",
			"message": err.Error(),
		}})
		return
	}

	c.JSON(http.StatusOK, resp)
}
