package model

import (
	"time"
)

// SettingsType 设置类型
type SettingsType string

const (
	SettingsTypeNewsSync     SettingsType = "news_sync"
	SettingsTypeTopListSync  SettingsType = "top_list_sync"
	SettingsTypeTopInstSync  SettingsType = "top_inst_sync"
	SettingsTypeHotMoneySync SettingsType = "hot_money_sync"
)

// Settings 系统设置模型
type Settings struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	Type      string    `json:"type" gorm:"size:50;index;not null"` // 设置类型
	Key       string    `json:"key" gorm:"size:100;index;not null"`   // 设置键
	Value     string    `json:"value" gorm:"type:text"`               // 设置值（JSON格式）
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (Settings) TableName() string {
	return "settings"
}

// NewsSyncSettings 新闻同步设置结构
type NewsSyncSettings struct {
	// 同步时间模式: "fixed" | "interval"
	TimeMode string `json:"time_mode"`

	// 固定时间模式：多个时段，如 ["08:00", "12:00", "15:30"]
	FixedTimes []string `json:"fixed_times,omitempty"`

	// 间隔时间模式：1-24小时
	IntervalHours int `json:"interval_hours,omitempty"`

	// 数据源: ["global_futu", "global_ths", "global_cls", "global_sina"]
	Sources []string `json:"sources"`
}

// TopListSyncSettings 龙虎榜同步设置结构
// 只能修改固定获取时间
type TopListSyncSettings struct {
	// 是否启用
	Enabled bool `json:"enabled"`
	// 固定时间列表，如 ["15:30"]
	FixedTimes []string `json:"fixed_times"`
}

// TopInstSyncSettings 龙虎榜机构交易名单同步设置结构
// 只能修改固定获取时间
type TopInstSyncSettings struct {
	// 是否启用
	Enabled bool `json:"enabled"`
	// 固定时间列表，如 ["15:30"]
	FixedTimes []string `json:"fixed_times"`
}

// HotMoneySyncSettings 游资名录同步设置结构
// 只能修改固定获取时间
type HotMoneySyncSettings struct {
	// 是否启用
	Enabled bool `json:"enabled"`
	// 固定时间列表，如 ["06:00"]
	FixedTimes []string `json:"fixed_times"`
}
