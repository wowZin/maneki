package model

import (
	"time"
)

// SystemNotification 系统通知（管理员发布）
type SystemNotification struct {
	ID              uint      `json:"id" gorm:"primaryKey"`
	Title           string    `json:"title" gorm:"size:200;not null"`
	Content         string    `json:"content" gorm:"type:text;not null"`
	Priority        int       `json:"priority" gorm:"not null;default:1;index:idx_system_notifications_priority,priority:desc"`
	StartTime       time.Time `json:"start_time" gorm:"not null;index:idx_system_notifications_time_range"`
	EndTime         *time.Time `json:"end_time" gorm:"index:idx_system_notifications_time_range"`
	MinVisibleLevel int       `json:"min_visible_level" gorm:"not null;default:1"`
	IsDisabled      bool      `json:"is_disabled" gorm:"not null;default:false;index:idx_system_notifications_disabled"`
	CreatedAt       time.Time `json:"created_at" gorm:"index:idx_system_notifications_created_at,priority:desc"`
	UpdatedAt       time.Time `json:"updated_at"`
}

func (SystemNotification) TableName() string {
	return "system_notifications"
}

// Status 运行时推导通知状态
func (n *SystemNotification) Status() string {
	if n.IsDisabled {
		return "disabled"
	}
	now := time.Now()
	if now.Before(n.StartTime) {
		return "pending"
	}
	if n.EndTime == nil {
		return "active"
	}
	if now.After(*n.EndTime) {
		return "expired"
	}
	return "active"
}

// StatusLabel 返回状态中文标签
func (n *SystemNotification) StatusLabel() string {
	switch n.Status() {
	case "pending":
		return "待生效"
	case "active":
		return "生效中"
	case "expired":
		return "已过期"
	case "disabled":
		return "已失效"
	default:
		return "未知"
	}
}

// PriorityLabel 返回优先级中文标签
func (n *SystemNotification) PriorityLabel() string {
	if n.Priority == 2 {
		return "紧急"
	}
	return "普通"
}

// CanDisable 判断通知是否可以被失效（待生效或生效中）
func (n *SystemNotification) CanDisable() bool {
	status := n.Status()
	return status == "pending" || status == "active"
}

// CanUpdate 判断通知是否可以被编辑（未失效）
func (n *SystemNotification) CanUpdate() bool {
	return n.Status() != "disabled"
}
