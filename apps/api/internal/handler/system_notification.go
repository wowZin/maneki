package handler

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/maneki/api/internal/middleware"
	"github.com/maneki/api/internal/model"
	"github.com/maneki/api/internal/repository"
)

// SystemNotificationHandler 系统通知处理器
type SystemNotificationHandler struct {
	repo *repository.SystemNotificationRepository
}

// NewSystemNotificationHandler 创建系统通知处理器
func NewSystemNotificationHandler(repo *repository.SystemNotificationRepository) *SystemNotificationHandler {
	return &SystemNotificationHandler{repo: repo}
}

// ---------- Admin Endpoints ----------

// AdminListResponse 管理端列表响应项
type AdminListResponse struct {
	ID              uint      `json:"id"`
	Title           string    `json:"title"`
	Priority        int       `json:"priority"`
	PriorityLabel   string    `json:"priority_label"`
	StartTime       time.Time `json:"start_time"`
	EndTime         *time.Time `json:"end_time"`
	MinVisibleLevel int       `json:"min_visible_level"`
	Status          string    `json:"status"`
	StatusLabel     string    `json:"status_label"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

// toAdminListResponse 将模型转换为管理端列表响应
func toAdminListResponse(n *model.SystemNotification) AdminListResponse {
	return AdminListResponse{
		ID:              n.ID,
		Title:           n.Title,
		Priority:        n.Priority,
		PriorityLabel:   n.PriorityLabel(),
		StartTime:       n.StartTime,
		EndTime:         n.EndTime,
		MinVisibleLevel: n.MinVisibleLevel,
		Status:          n.Status(),
		StatusLabel:     n.StatusLabel(),
		CreatedAt:       n.CreatedAt,
		UpdatedAt:       n.UpdatedAt,
	}
}

// ListAdmin 管理端获取通知列表
func (h *SystemNotificationHandler) ListAdmin(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 10
	}

	status := c.DefaultQuery("status", "")
	keyword := c.DefaultQuery("keyword", "")

	query := repository.AdminListQuery{
		Page:     page,
		PageSize: pageSize,
		Status:   status,
		Keyword:  keyword,
	}

	result, err := h.repo.AdminList(c.Request.Context(), query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    -1,
			"message": "查询失败: " + err.Error(),
		})
		return
	}

	var list []AdminListResponse
	for i := range result.Data {
		list = append(list, toAdminListResponse(&result.Data[i]))
	}

	c.JSON(http.StatusOK, gin.H{
		"code":     0,
		"message":  "success",
		"data":     list,
		"total":    result.Total,
		"page":     result.Page,
		"page_size": result.PageSize,
	})
}

// GetAdmin 管理端获取通知详情
func (h *SystemNotificationHandler) GetAdmin(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    -1,
			"message": "无效的通知ID",
		})
		return
	}

	notification, err := h.repo.GetByID(c.Request.Context(), uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"code":    -1,
			"message": "通知不存在",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data": gin.H{
			"id":                notification.ID,
			"title":             notification.Title,
			"content":           notification.Content,
			"priority":          notification.Priority,
			"priority_label":    notification.PriorityLabel(),
			"start_time":        notification.StartTime,
			"end_time":          notification.EndTime,
			"min_visible_level": notification.MinVisibleLevel,
			"status":            notification.Status(),
			"status_label":      notification.StatusLabel(),
			"created_at":        notification.CreatedAt,
			"updated_at":        notification.UpdatedAt,
		},
	})
}

// CreateSystemNotificationRequest 创建系统通知请求
type CreateSystemNotificationRequest struct {
	Title           string     `json:"title" binding:"required"`
	Content         string     `json:"content" binding:"required"`
	Priority        int        `json:"priority" binding:"required"`
	StartTime       time.Time  `json:"start_time" binding:"required"`
	EndTime         *time.Time `json:"end_time"`
	MinVisibleLevel int        `json:"min_visible_level" binding:"required"`
}

// Create 创建通知
func (h *SystemNotificationHandler) Create(c *gin.Context) {
	var req CreateSystemNotificationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    -1,
			"message": "请求参数错误: " + err.Error(),
		})
		return
	}

	// 校验时间范围
	if err := repository.ValidateTimeRange(req.StartTime, req.EndTime); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    -1,
			"message": err.Error(),
		})
		return
	}

	notification := &model.SystemNotification{
		Title:           req.Title,
		Content:         req.Content,
		Priority:        req.Priority,
		StartTime:       req.StartTime,
		EndTime:         req.EndTime,
		MinVisibleLevel: req.MinVisibleLevel,
	}

	if err := h.repo.Create(c.Request.Context(), notification); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    -1,
			"message": "创建通知失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data": gin.H{
			"id":                notification.ID,
			"title":             notification.Title,
			"content":           notification.Content,
			"priority":          notification.Priority,
			"start_time":        notification.StartTime,
			"end_time":          notification.EndTime,
			"min_visible_level": notification.MinVisibleLevel,
			"created_at":        notification.CreatedAt,
			"updated_at":        notification.UpdatedAt,
		},
	})
}

// UpdateNotificationRequest 更新通知请求
type UpdateNotificationRequest struct {
	Title           *string    `json:"title" binding:"omitempty,max=200"`
	Content         *string    `json:"content"`
	Priority        *int       `json:"priority" binding:"omitempty,oneof=1 2"`
	StartTime       *time.Time `json:"start_time"`
	EndTime         *time.Time `json:"end_time"`
	MinVisibleLevel *int       `json:"min_visible_level" binding:"omitempty,min=0"`
}

// Update 更新通知
func (h *SystemNotificationHandler) Update(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    -1,
			"message": "无效的通知ID",
		})
		return
	}

	var req UpdateNotificationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    -1,
			"message": "请求参数错误: " + err.Error(),
		})
		return
	}

	// 获取原通知
	notification, err := h.repo.GetByID(c.Request.Context(), uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"code":    -1,
			"message": "通知不存在",
		})
		return
	}

	// 检查是否可以编辑
	if !notification.CanUpdate() {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    -1,
			"message": "已失效的通知不支持编辑",
		})
		return
	}

	// 构建更新字段
	updates := make(map[string]interface{})
	startTime := notification.StartTime
	endTime := notification.EndTime

	if req.Title != nil {
		updates["title"] = *req.Title
	}
	if req.Content != nil {
		updates["content"] = *req.Content
	}
	if req.Priority != nil {
		updates["priority"] = *req.Priority
	}
	if req.StartTime != nil {
		updates["start_time"] = *req.StartTime
		startTime = *req.StartTime
	}
	if req.EndTime != nil {
		updates["end_time"] = *req.EndTime
		endTime = req.EndTime
	}
	if req.MinVisibleLevel != nil {
		updates["min_visible_level"] = *req.MinVisibleLevel
	}

	if len(updates) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    -1,
			"message": "至少提供一个需要更新的字段",
		})
		return
	}

	// 校验时间范围
	if err := repository.ValidateTimeRange(startTime, endTime); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    -1,
			"message": err.Error(),
		})
		return
	}

	if err := h.repo.Update(c.Request.Context(), uint(id), updates); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    -1,
			"message": "更新通知失败: " + err.Error(),
		})
		return
	}

	// 重新获取更新后的数据
	notification, _ = h.repo.GetByID(c.Request.Context(), uint(id))

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data": gin.H{
			"id":                notification.ID,
			"title":             notification.Title,
			"content":           notification.Content,
			"priority":          notification.Priority,
			"start_time":        notification.StartTime,
			"end_time":          notification.EndTime,
			"min_visible_level": notification.MinVisibleLevel,
			"created_at":        notification.CreatedAt,
			"updated_at":        notification.UpdatedAt,
		},
	})
}

// Disable 将通知标记为已失效
func (h *SystemNotificationHandler) Disable(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    -1,
			"message": "无效的通知ID",
		})
		return
	}

	notification, err := h.repo.GetByID(c.Request.Context(), uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"code":    -1,
			"message": "通知不存在",
		})
		return
	}

	if !notification.CanDisable() {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    -1,
			"message": "只有待生效或生效中的通知可以失效",
		})
		return
	}

	if err := h.repo.Disable(c.Request.Context(), uint(id)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    -1,
			"message": "失效操作失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "通知已失效",
	})
}

// Duplicate 复制通知
func (h *SystemNotificationHandler) Duplicate(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    -1,
			"message": "无效的通知ID",
		})
		return
	}

	copy, err := h.repo.Duplicate(c.Request.Context(), uint(id))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    -1,
			"message": "复制通知失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data": gin.H{
			"id":                copy.ID,
			"title":             copy.Title,
			"content":           copy.Content,
			"priority":          copy.Priority,
			"start_time":        copy.StartTime,
			"end_time":          copy.EndTime,
			"min_visible_level": copy.MinVisibleLevel,
			"created_at":        copy.CreatedAt,
			"updated_at":        copy.UpdatedAt,
		},
	})
}

// ---------- User Endpoints ----------

// UserListResponse 用户端列表响应项
type UserListResponse struct {
	ID        uint      `json:"id"`
	Title     string    `json:"title"`
	Content   string    `json:"content"`
	Priority  int       `json:"priority"`
	StartTime time.Time `json:"start_time"`
	CreatedAt time.Time `json:"created_at"`
}

// toUserListResponse 将模型转换为用户端列表响应
func toUserListResponse(n model.SystemNotification) UserListResponse {
	return UserListResponse{
		ID:        n.ID,
		Title:     n.Title,
		Content:   n.Content,
		Priority:  n.Priority,
		StartTime: n.StartTime,
		CreatedAt: n.CreatedAt,
	}
}

// ListUser 用户端获取生效通知列表
func (h *SystemNotificationHandler) ListUser(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 50 {
		pageSize = 10
	}

	vipLevel := middleware.GetCurrentVIPLevel(c)

	query := repository.UserListQuery{
		Page:         page,
		PageSize:     pageSize,
		UserVIPLevel: vipLevel,
	}

	result, err := h.repo.UserListActive(c.Request.Context(), query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    -1,
			"message": "查询失败: " + err.Error(),
		})
		return
	}

	var urgent []UserListResponse
	for _, n := range result.Urgent {
		urgent = append(urgent, toUserListResponse(n))
	}

	var normal []UserListResponse
	for _, n := range result.Normal {
		normal = append(normal, toUserListResponse(n))
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data": gin.H{
			"urgent": urgent,
			"normal": normal,
		},
	})
}

// GetUser 用户端获取通知详情
func (h *SystemNotificationHandler) GetUser(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    -1,
			"message": "无效的通知ID",
		})
		return
	}

	notification, err := h.repo.GetByID(c.Request.Context(), uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"code":    -1,
			"message": "通知不存在",
		})
		return
	}

	// 访问控制检查
	vipLevel := middleware.GetCurrentVIPLevel(c)
	now := time.Now()

	if notification.IsDisabled {
		c.JSON(http.StatusNotFound, gin.H{
			"code":    -1,
			"message": "通知不存在",
		})
		return
	}

	if now.Before(notification.StartTime) {
		c.JSON(http.StatusNotFound, gin.H{
			"code":    -1,
			"message": "通知不存在",
		})
		return
	}

	if notification.EndTime != nil && now.After(*notification.EndTime) {
		c.JSON(http.StatusNotFound, gin.H{
			"code":    -1,
			"message": "通知不存在",
		})
		return
	}

	if vipLevel < notification.MinVisibleLevel {
		c.JSON(http.StatusNotFound, gin.H{
			"code":    -1,
			"message": "通知不存在",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data": gin.H{
			"id":         notification.ID,
			"title":      notification.Title,
			"content":    notification.Content,
			"priority":   notification.Priority,
			"start_time": notification.StartTime,
			"end_time":   notification.EndTime,
			"created_at": notification.CreatedAt,
		},
	})
}
