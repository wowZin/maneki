package model

import (
	"time"
)

// SettingsType 设置类型
type SettingsType string

const (
	SettingsTypeNewsSync SettingsType = "news_sync"
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
