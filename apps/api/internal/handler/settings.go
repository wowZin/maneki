package handler

import (
	"fmt"
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

// SystemSettingsResponse 系统设置响应
type SystemSettingsResponse struct {
	System model.SystemSettings `json:"system"`
}

// GetSettings 获取系统元信息配置
func (h *SettingsHandler) GetSettings(c *gin.Context) {
	settings, err := h.settingsRepo.GetSystemSettings(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    -1,
			"message": "获取设置失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data": SystemSettingsResponse{
			System: *settings,
		},
	})
}

// UpdateSettingsRequest 更新系统设置请求
type UpdateSettingsRequest struct {
	System model.SystemSettings `json:"system" binding:"required"`
}

// UpdateSettings 更新系统元信息配置
func (h *SettingsHandler) UpdateSettings(c *gin.Context) {
	var req UpdateSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    -1,
			"message": "请求参数错误: " + err.Error(),
		})
		return
	}

	// 校验字段范围
	if req.System.MonitorStockCount < 10 || req.System.MonitorStockCount > 1000 {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    -1,
			"message": "监控股票数量必须在 10-1000 之间",
		})
		return
	}
	if req.System.SignalThreshold < 0 || req.System.SignalThreshold > 1 {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    -1,
			"message": "信号置信度阈值必须在 0-1 之间",
		})
		return
	}
	if req.System.DataRetentionDays < 1 || req.System.DataRetentionDays > 365 {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    -1,
			"message": "数据保留天数必须在 1-365 之间",
		})
		return
	}
	if req.System.AgentDiscussionTimeout < 1 || req.System.AgentDiscussionTimeout > 60 {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    -1,
			"message": "Agent 讨论超时时间必须在 1-60 分钟之间",
		})
		return
	}
	if req.System.MaxAgents < 1 || req.System.MaxAgents > 50 {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    -1,
			"message": "最大 Agent 数量必须在 1-50 之间",
		})
		return
	}

	if err := h.settingsRepo.SaveSystemSettings(c.Request.Context(), &req.System); err != nil {
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

// GetPricingSettings 获取定价配置
func (h *SettingsHandler) GetPricingSettings(c *gin.Context) {
	settings, err := h.settingsRepo.GetPricingSettings(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    -1,
			"message": "获取定价配置失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data":    settings,
	})
}

// SavePricingSettingsRequest 保存定价配置请求
type SavePricingSettingsRequest struct {
	VIP  model.TierPricing `json:"vip" binding:"required"`
	SVIP model.TierPricing `json:"svip" binding:"required"`
}

func validatePricingItem(item model.PricingItem, name string) error {
	if item.Price < 0 {
		return fmt.Errorf("%s 价格不能为负数", name)
	}
	if item.Discount < 0.1 || item.Discount > 1 {
		return fmt.Errorf("%s 折扣必须在 0.1-1.0 之间", name)
	}
	return nil
}

// SavePricingSettings 保存定价配置
func (h *SettingsHandler) SavePricingSettings(c *gin.Context) {
	var req SavePricingSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    -1,
			"message": "请求参数错误: " + err.Error(),
		})
		return
	}

	// 校验 VIP
	if err := validatePricingItem(req.VIP.Monthly, "VIP 月付"); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": -1, "message": err.Error()})
		return
	}
	if err := validatePricingItem(req.VIP.Quarterly, "VIP 季付"); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": -1, "message": err.Error()})
		return
	}
	if err := validatePricingItem(req.VIP.Yearly, "VIP 年付"); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": -1, "message": err.Error()})
		return
	}

	// 校验 SVIP
	if err := validatePricingItem(req.SVIP.Monthly, "SVIP 月付"); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": -1, "message": err.Error()})
		return
	}
	if err := validatePricingItem(req.SVIP.Quarterly, "SVIP 季付"); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": -1, "message": err.Error()})
		return
	}
	if err := validatePricingItem(req.SVIP.Yearly, "SVIP 年付"); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": -1, "message": err.Error()})
		return
	}

	settings := &model.PricingSettings{
		VIP:  req.VIP,
		SVIP: req.SVIP,
	}

	if err := h.settingsRepo.SavePricingSettings(c.Request.Context(), settings); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    -1,
			"message": "保存定价配置失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "定价配置已保存",
	})
}
