package handler

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/maneki/api/internal/service"
)

// RebateStatsHandler 返佣统计处理器
type RebateStatsHandler struct {
	svc *service.RebateStatsService
}

// NewRebateStatsHandler 创建返佣统计处理器
func NewRebateStatsHandler(svc *service.RebateStatsService) *RebateStatsHandler {
	return &RebateStatsHandler{svc: svc}
}

// GetDashboardStats 获取看板统计
func (h *RebateStatsHandler) GetDashboardStats(c *gin.Context) {
	startDate := parseDate(c.Query("start_date"), time.Now().AddDate(0, 0, -30))
	endDate := parseDate(c.Query("end_date"), time.Now())

	stats, err := h.svc.GetDashboardStats(c.Request.Context(), startDate, endDate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, stats)
}

// GetTrend 获取趋势数据
func (h *RebateStatsHandler) GetTrend(c *gin.Context) {
	groupBy := c.DefaultQuery("group_by", "day")
	startDate := parseDate(c.Query("start_date"), time.Now().AddDate(0, 0, -30))
	endDate := parseDate(c.Query("end_date"), time.Now())

	var agentID, creatorID uint
	if idStr := c.Query("agent_id"); idStr != "" {
		if id, err := strconv.ParseUint(idStr, 10, 64); err == nil {
			agentID = uint(id)
		}
	}
	if idStr := c.Query("creator_id"); idStr != "" {
		if id, err := strconv.ParseUint(idStr, 10, 64); err == nil {
			creatorID = uint(id)
		}
	}

	data, err := h.svc.GetTrend(c.Request.Context(), groupBy, startDate, endDate, agentID, creatorID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": data})
}

// GetCreatorRanking 获取创作者排名
func (h *RebateStatsHandler) GetCreatorRanking(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	startDate := parseDate(c.Query("start_date"), time.Now().AddDate(0, 0, -30))
	endDate := parseDate(c.Query("end_date"), time.Now())

	data, total, err := h.svc.GetCreatorRanking(c.Request.Context(), startDate, endDate, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": data, "total": total, "page": page, "page_size": pageSize})
}

// GetAgentStats 获取Agent统计
func (h *RebateStatsHandler) GetAgentStats(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	startDate := parseDate(c.Query("start_date"), time.Now().AddDate(0, 0, -30))
	endDate := parseDate(c.Query("end_date"), time.Now())

	var creatorID uint
	if idStr := c.Query("creator_id"); idStr != "" {
		if id, err := strconv.ParseUint(idStr, 10, 64); err == nil {
			creatorID = uint(id)
		}
	}

	data, total, err := h.svc.GetAgentStats(c.Request.Context(), startDate, endDate, creatorID, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": data, "total": total, "page": page, "page_size": pageSize})
}

func parseDate(s string, fallback time.Time) time.Time {
	if s == "" {
		return fallback
	}
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		return fallback
	}
	return t
}
