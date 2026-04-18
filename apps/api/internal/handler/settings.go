package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/maneki/api/internal/model"
	"github.com/maneki/api/internal/repository"
)

// SettingsHandler 设置管理处理器
type SettingsHandler struct {
	settingsRepo *repository.SettingsRepository
}

// NewSettingsHandler 创建设置管理处理器
func NewSettingsHandler(settingsRepo *repository.SettingsRepository) *SettingsHandler {
	return &SettingsHandler{
		settingsRepo: settingsRepo,
	}
}

// GetNewsSyncSettingsRequest 获取新闻同步设置响应
type GetNewsSyncSettingsResponse struct {
	TimeMode      string   `json:"time_mode"`       // "fixed" | "interval"
	FixedTimes    []string `json:"fixed_times"`     // 固定时间列表
	IntervalHours int      `json:"interval_hours"`  // 间隔小时数
	Sources       []string `json:"sources"`         // 数据源列表
}

// GetNewsSyncSettings 获取新闻同步设置
func (h *SettingsHandler) GetNewsSyncSettings(c *gin.Context) {
	settings, err := h.settingsRepo.GetNewsSyncSettings(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    -1,
			"message": "获取设置失败: " + err.Error(),
		})
		return
	}

	response := GetNewsSyncSettingsResponse{
		TimeMode:      settings.TimeMode,
		FixedTimes:    settings.FixedTimes,
		IntervalHours: settings.IntervalHours,
		Sources:       settings.Sources,
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data":    response,
	})
}

// SaveNewsSyncSettingsRequest 保存新闻同步设置请求
type SaveNewsSyncSettingsRequest struct {
	TimeMode      string   `json:"time_mode" binding:"required,oneof=fixed interval"` // 时间模式
	FixedTimes    []string `json:"fixed_times"`                                        // 固定时间列表
	IntervalHours int      `json:"interval_hours"`                                     // 间隔小时数
	Sources       []string `json:"sources" binding:"required,min=1"`                   // 数据源列表（至少选一个）
}

// SaveNewsSyncSettings 保存新闻同步设置
func (h *SettingsHandler) SaveNewsSyncSettings(c *gin.Context) {
	var req SaveNewsSyncSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    -1,
			"message": "请求参数错误: " + err.Error(),
		})
		return
	}

	// 根据模式验证
	if req.TimeMode == "fixed" {
		if len(req.FixedTimes) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{
				"code":    -1,
				"message": "固定时间模式下必须至少设置一个时间",
			})
			return
		}
	} else if req.TimeMode == "interval" {
		if req.IntervalHours < 1 || req.IntervalHours > 24 {
			c.JSON(http.StatusBadRequest, gin.H{
				"code":    -1,
				"message": "间隔时间必须在 1-24 小时之间",
			})
			return
		}
	}

	// 验证数据源
	validSources := map[string]bool{
		"global_futu": true,
		"global_ths":  true,
		"global_cls":  true,
		"global_sina": true,
	}
	for _, source := range req.Sources {
		if !validSources[source] {
			c.JSON(http.StatusBadRequest, gin.H{
				"code":    -1,
				"message": "无效的数据源: " + source,
			})
			return
		}
	}

	// 保存设置
	settings := &model.NewsSyncSettings{
		TimeMode:      req.TimeMode,
		FixedTimes:    req.FixedTimes,
		IntervalHours: req.IntervalHours,
		Sources:       req.Sources,
	}

	if err := h.settingsRepo.SaveNewsSyncSettings(c.Request.Context(), settings); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    -1,
			"message": "保存设置失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "设置已保存",
	})
}

// GetTopListSyncSettingsResponse 获取龙虎榜同步设置响应
type GetTopListSyncSettingsResponse struct {
	Enabled    bool     `json:"enabled"`     // 是否启用
	FixedTimes []string `json:"fixed_times"` // 固定时间列表
}

// GetTopListSyncSettings 获取龙虎榜同步设置
func (h *SettingsHandler) GetTopListSyncSettings(c *gin.Context) {
	settings, err := h.settingsRepo.GetTopListSyncSettings(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    -1,
			"message": "获取设置失败: " + err.Error(),
		})
		return
	}

	response := GetTopListSyncSettingsResponse{
		Enabled:    settings.Enabled,
		FixedTimes: settings.FixedTimes,
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data":    response,
	})
}

// SaveTopListSyncSettingsRequest 保存龙虎榜同步设置请求
type SaveTopListSyncSettingsRequest struct {
	Enabled    bool     `json:"enabled"`              // 是否启用
	FixedTimes []string `json:"fixed_times" binding:"required,min=1"` // 固定时间列表（至少一个）
}

// SaveTopListSyncSettings 保存龙虎榜同步设置
func (h *SettingsHandler) SaveTopListSyncSettings(c *gin.Context) {
	var req SaveTopListSyncSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    -1,
			"message": "请求参数错误: " + err.Error(),
		})
		return
	}

	// 验证时间格式
	for _, timeStr := range req.FixedTimes {
		if len(timeStr) != 5 || timeStr[2] != ':' {
			c.JSON(http.StatusBadRequest, gin.H{
				"code":    -1,
				"message": "时间格式错误，应为 HH:MM: " + timeStr,
			})
			return
		}
	}

	// 保存设置
	settings := &model.TopListSyncSettings{
		Enabled:    req.Enabled,
		FixedTimes: req.FixedTimes,
	}

	if err := h.settingsRepo.SaveTopListSyncSettings(c.Request.Context(), settings); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    -1,
			"message": "保存设置失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "设置已保存",
	})
}

// GetTopInstSyncSettingsResponse 获取龙虎榜机构交易名单同步设置响应
type GetTopInstSyncSettingsResponse struct {
	Enabled    bool     `json:"enabled"`     // 是否启用
	FixedTimes []string `json:"fixed_times"` // 固定时间列表
}

// GetTopInstSyncSettings 获取龙虎榜机构交易名单同步设置
func (h *SettingsHandler) GetTopInstSyncSettings(c *gin.Context) {
	settings, err := h.settingsRepo.GetTopInstSyncSettings(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    -1,
			"message": "获取设置失败: " + err.Error(),
		})
		return
	}

	response := GetTopInstSyncSettingsResponse{
		Enabled:    settings.Enabled,
		FixedTimes: settings.FixedTimes,
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data":    response,
	})
}

// SaveTopInstSyncSettingsRequest 保存龙虎榜机构交易名单同步设置请求
type SaveTopInstSyncSettingsRequest struct {
	Enabled    bool     `json:"enabled"`                              // 是否启用
	FixedTimes []string `json:"fixed_times" binding:"required,min=1"` // 固定时间列表（至少一个）
}

// SaveTopInstSyncSettings 保存龙虎榜机构交易名单同步设置
func (h *SettingsHandler) SaveTopInstSyncSettings(c *gin.Context) {
	var req SaveTopInstSyncSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    -1,
			"message": "请求参数错误: " + err.Error(),
		})
		return
	}

	// 验证时间格式
	for _, timeStr := range req.FixedTimes {
		if len(timeStr) != 5 || timeStr[2] != ':' {
			c.JSON(http.StatusBadRequest, gin.H{
				"code":    -1,
				"message": "时间格式错误，应为 HH:MM: " + timeStr,
			})
			return
		}
	}

	// 保存设置
	settings := &model.TopInstSyncSettings{
		Enabled:    req.Enabled,
		FixedTimes: req.FixedTimes,
	}

	if err := h.settingsRepo.SaveTopInstSyncSettings(c.Request.Context(), settings); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    -1,
			"message": "保存设置失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "设置已保存",
	})
}

// GetHotMoneySyncSettingsResponse 获取游资名录同步设置响应
type GetHotMoneySyncSettingsResponse struct {
	Enabled    bool     `json:"enabled"`     // 是否启用
	FixedTimes []string `json:"fixed_times"` // 固定时间列表
}

// GetHotMoneySyncSettings 获取游资名录同步设置
func (h *SettingsHandler) GetHotMoneySyncSettings(c *gin.Context) {
	settings, err := h.settingsRepo.GetHotMoneySyncSettings(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    -1,
			"message": "获取设置失败: " + err.Error(),
		})
		return
	}

	response := GetHotMoneySyncSettingsResponse{
		Enabled:    settings.Enabled,
		FixedTimes: settings.FixedTimes,
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data":    response,
	})
}

// SaveHotMoneySyncSettingsRequest 保存游资名录同步设置请求
type SaveHotMoneySyncSettingsRequest struct {
	Enabled    bool     `json:"enabled"`                              // 是否启用
	FixedTimes []string `json:"fixed_times" binding:"required,min=1"` // 固定时间列表（至少一个）
}

// SaveHotMoneySyncSettings 保存游资名录同步设置
func (h *SettingsHandler) SaveHotMoneySyncSettings(c *gin.Context) {
	var req SaveHotMoneySyncSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    -1,
			"message": "请求参数错误: " + err.Error(),
		})
		return
	}

	// 验证时间格式
	for _, timeStr := range req.FixedTimes {
		if len(timeStr) != 5 || timeStr[2] != ':' {
			c.JSON(http.StatusBadRequest, gin.H{
				"code":    -1,
				"message": "时间格式错误，应为 HH:MM: " + timeStr,
			})
			return
		}
	}

	// 保存设置
	settings := &model.HotMoneySyncSettings{
		Enabled:    req.Enabled,
		FixedTimes: req.FixedTimes,
	}

	if err := h.settingsRepo.SaveHotMoneySyncSettings(c.Request.Context(), settings); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    -1,
			"message": "保存设置失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "设置已保存",
	})
}
