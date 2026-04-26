package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/maneki/api/internal/middleware"
	"github.com/maneki/api/internal/model"
	"github.com/maneki/api/internal/service"
)

// BacktestHandler 回测处理器
type BacktestHandler struct {
	backtestSvc *service.BacktestService
}

// NewBacktestHandler 创建回测处理器
func NewBacktestHandler(backtestSvc *service.BacktestService) *BacktestHandler {
	return &BacktestHandler{backtestSvc: backtestSvc}
}

// dayResultResp 按天结果响应结构
type dayResultResp struct {
	Date         string                   `json:"date"`
	TotalSignals int                      `json:"total_signals"`
	HitCount     int                      `json:"hit_count"`
	MissCount    int                      `json:"miss_count"`
	HitRate      float64                  `json:"hit_rate"`
	Details      []model.BacktestDetailItem `json:"details"`
}

// backtestJobResp 回测任务响应结构
type backtestJobResp struct {
	ID          uint                   `json:"id"`
	AgentID     uint                   `json:"agent_id"`
	AgentName   string                 `json:"agent_name,omitempty"`
	Status      string                 `json:"status"`
	Progress    int                    `json:"progress"`
	Params      model.JSON             `json:"params"`
	CreatedAt   time.Time              `json:"created_at"`
	StartedAt   *time.Time             `json:"started_at,omitempty"`
	CompletedAt *time.Time             `json:"completed_at,omitempty"`
	ErrorMsg    string                 `json:"error_msg,omitempty"`
}

// ListBacktests 获取用户回测历史
func (h *BacktestHandler) ListBacktests(c *gin.Context) {
	userIDStr, exists := middleware.GetCurrentUser(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未登录"})
		return
	}
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的用户ID"})
		return
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	jobs, total, err := h.backtestSvc.ListUserBacktests(c.Request.Context(), userID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	items := make([]backtestJobResp, 0, len(jobs))
	for _, job := range jobs {
		resp := backtestJobResp{
			ID:          job.ID,
			AgentID:     job.AgentID,
			Status:      job.Status,
			Progress:    job.Progress,
			Params:      job.Params,
			CreatedAt:   job.CreatedAt,
			StartedAt:   job.StartedAt,
			CompletedAt: job.CompletedAt,
			ErrorMsg:    job.ErrorMsg,
		}
		// 尝试获取agent名称
		if name, err := h.backtestSvc.GetAgentName(c.Request.Context(), job.AgentID); err == nil {
			resp.AgentName = name
		}
		items = append(items, resp)
	}

	c.JSON(http.StatusOK, gin.H{
		"items": items,
		"total": total,
	})
}

// CreateBacktest 创建回测任务
func (h *BacktestHandler) CreateBacktest(c *gin.Context) {
	userIDStr, exists := middleware.GetCurrentUser(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未登录"})
		return
	}
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的用户ID"})
		return
	}

	var req service.CreateBacktestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数错误"})
		return
	}

	job, err := h.backtestSvc.CreateBacktest(c.Request.Context(), userID, &req)
	if err != nil {
		switch err.Error() {
		case "VIP_REQUIRED":
			c.JSON(http.StatusForbidden, gin.H{"error": gin.H{"code": "VIP_REQUIRED", "message": "回测功能仅限 VIP 用户使用"}})
		case "SUBSCRIPTION_REQUIRED":
			c.JSON(http.StatusForbidden, gin.H{"error": gin.H{"code": "SUBSCRIPTION_REQUIRED", "message": "您未订阅该 Agent，无法回测"}})
		case "INVALID_DATE_RANGE":
			c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"code": "INVALID_DATE_RANGE", "message": "回测日期范围不能超过14天"}})
		case "JOB_ALREADY_RUNNING":
			c.JSON(http.StatusConflict, gin.H{"error": gin.H{"code": "JOB_ALREADY_RUNNING", "message": "该 Agent 已有正在进行的回测任务"}})
		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		}
		return
	}

	c.JSON(http.StatusCreated, job)
}

// GetBacktest 获取回测任务详情
func (h *BacktestHandler) GetBacktest(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的任务ID"})
		return
	}

	job, result, days, err := h.backtestSvc.GetBacktestWithResult(c.Request.Context(), uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": gin.H{"code": "NOT_FOUND", "message": "回测任务不存在"}})
		return
	}

	resp := backtestJobResp{
		ID:          job.ID,
		AgentID:     job.AgentID,
		Status:      job.Status,
		Progress:    job.Progress,
		Params:      job.Params,
		CreatedAt:   job.CreatedAt,
		StartedAt:   job.StartedAt,
		CompletedAt: job.CompletedAt,
		ErrorMsg:    job.ErrorMsg,
	}
	if name, err := h.backtestSvc.GetAgentName(c.Request.Context(), job.AgentID); err == nil {
		resp.AgentName = name
	}

	if result != nil {
		dayResps := make([]dayResultResp, 0, len(days))
		for _, day := range days {
			var details []model.BacktestDetailItem
			if len(day.Details) > 0 {
				_ = json.Unmarshal(day.Details, &details)
			}
			dayResps = append(dayResps, dayResultResp{
				Date:         day.Date.Format("2006-01-02"),
				TotalSignals: day.TotalSignals,
				HitCount:     day.HitCount,
				MissCount:    day.MissCount,
				HitRate:      day.HitRate,
				Details:      details,
			})
		}

		c.JSON(http.StatusOK, gin.H{
			"id":           resp.ID,
			"agent_id":     resp.AgentID,
			"agent_name":   resp.AgentName,
			"status":       resp.Status,
			"progress":     resp.Progress,
			"params":       resp.Params,
			"created_at":   resp.CreatedAt,
			"started_at":   resp.StartedAt,
			"completed_at": resp.CompletedAt,
			"error_msg":    resp.ErrorMsg,
			"result": gin.H{
				"total_days":       result.TotalDays,
				"total_signals":    result.TotalSignals,
				"total_hit":        result.TotalHit,
				"total_miss":       result.TotalMiss,
				"overall_hit_rate": result.OverallHitRate,
				"days":             dayResps,
			},
		})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// GetBacktestProgress 获取回测进度（轻量端点）
func (h *BacktestHandler) GetBacktestProgress(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的任务ID"})
		return
	}

	job, err := h.backtestSvc.GetBacktest(c.Request.Context(), uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": gin.H{"code": "NOT_FOUND", "message": "回测任务不存在"}})
		return
	}

	message := ""
	switch job.Status {
	case "pending":
		message = "任务排队中..."
	case "running":
		message = "正在计算回测数据..."
	case "completed":
		message = "回测完成"
	case "failed":
		message = "回测失败: " + job.ErrorMsg
	}

	c.JSON(http.StatusOK, gin.H{
		"id":       job.ID,
		"status":   job.Status,
		"progress": job.Progress,
		"message":  message,
	})
}
