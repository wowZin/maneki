package model

import (
	"time"
)

// Notification 系统通知模型
type Notification struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	Title     string    `json:"title" gorm:"size:200;not null"`      // 通知标题/概要
	Content   string    `json:"content" gorm:"type:text"`            // 详情内容(JSON)
	Type      string    `json:"type" gorm:"size:50;index"`           // 通知类型: task_success, task_failed
	IsRead    bool      `json:"is_read" gorm:"index;default:false"`  // 是否已读
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (Notification) TableName() string {
	return "notifications"
}
