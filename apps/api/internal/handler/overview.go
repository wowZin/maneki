package handler

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/maneki/api/internal/middleware"
	"github.com/maneki/api/internal/service"
)

// OverviewHandler 首页概览处理器
type OverviewHandler struct {
	overviewSvc *service.OverviewService
}

// NewOverviewHandler 创建概览处理器
func NewOverviewHandler(overviewSvc *service.OverviewService) *OverviewHandler {
	return &OverviewHandler{overviewSvc: overviewSvc}
}

// ============================================
// 打板预测正确率趋势 (US1)
// ============================================

// GetAccuracyTrend 获取打板预测正确率趋势
func (h *OverviewHandler) GetAccuracyTrend(c *gin.Context) {
	period := c.DefaultQuery("period", "7d")
	validPeriods := map[string]bool{"7d": true, "30d": true, "90d": true, "1y": true}
	if !validPeriods[period] {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{
			"code":    "INVALID_PARAMETER",
			"message": "参数 period 不合法，可选值: 7d, 30d, 90d, 1y",
		}})
		return
	}

	resp, err := h.overviewSvc.GetAccuracyTrend(c.Request.Context(), period)
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
// 用户选中涨停股票趋势 (US2)
// ============================================

// GetUserTrackingTrend 获取用户选中涨停股票趋势
func (h *OverviewHandler) GetUserTrackingTrend(c *gin.Context) {
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

	resp, err := h.overviewSvc.GetUserTrackingTrend(c.Request.Context(), userID, period)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{
			"code":    "INTERNAL_ERROR",
			"message": err.Error(),
		}})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// GetUserTrackingDetail 获取用户选中股票明细
func (h *OverviewHandler) GetUserTrackingDetail(c *gin.Context) {
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

	dateStr := c.Query("date")
	if dateStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{
			"code":    "INVALID_PARAMETER",
			"message": "参数 date 不能为空",
		}})
		return
	}

	date, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{
			"code":    "INVALID_PARAMETER",
			"message": "参数 date 格式错误，应为 YYYY-MM-DD",
		}})
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	resp, err := h.overviewSvc.GetUserTrackingDetail(c.Request.Context(), userID, date, page, pageSize)
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
// Agent 命中率 (US3)
// ============================================

// GetAgentPerformance 获取Agent命中率
func (h *OverviewHandler) GetAgentPerformance(c *gin.Context) {
	period := c.DefaultQuery("period", "7d")
	validPeriods := map[string]bool{"7d": true, "30d": true, "all": true}
	if !validPeriods[period] {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{
			"code":    "INVALID_PARAMETER",
			"message": "参数 period 不合法，可选值: 7d, 30d, all",
		}})
		return
	}

	sortBy := c.DefaultQuery("sort_by", "hit_rate")
	validSorts := map[string]bool{"hit_rate": true, "total_predictions": true}
	if !validSorts[sortBy] {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{
			"code":    "INVALID_PARAMETER",
			"message": "参数 sort_by 不合法，可选值: hit_rate, total_predictions",
		}})
		return
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	resp, err := h.overviewSvc.GetAgentPerformance(c.Request.Context(), period, sortBy, limit)
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
// 热门股票 (US4)
// ============================================

// GetHotStocks 获取热门股票
func (h *OverviewHandler) GetHotStocks(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	resp, err := h.overviewSvc.GetHotStocks(c.Request.Context(), limit)
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
// 实时信号 (US5)
// ============================================

// GetRealtimeSignals 获取实时信号
func (h *OverviewHandler) GetRealtimeSignals(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	afterIDStr := c.Query("after_id")
	var afterID uint64
	if afterIDStr != "" {
		afterID, _ = strconv.ParseUint(afterIDStr, 10, 64)
	}

	resp, err := h.overviewSvc.GetRealtimeSignals(c.Request.Context(), uint(afterID), limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{
			"code":    "INTERNAL_ERROR",
			"message": err.Error(),
		}})
		return
	}

	c.JSON(http.StatusOK, resp)
}
