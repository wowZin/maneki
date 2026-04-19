package model

import (
	"time"
)

// AuditAction 操作类型
type AuditAction string

const (
	AuditActionLogin             AuditAction = "login"
	AuditActionLogout            AuditAction = "logout"
	AuditActionCreateAdmin       AuditAction = "create_admin"
	AuditActionDisableAdmin      AuditAction = "disable_admin"
	AuditActionEnableAdmin       AuditAction = "enable_admin"
	AuditActionDisableUser       AuditAction = "disable_user"
	AuditActionEnableUser        AuditAction = "enable_user"
	AuditActionResetUserPassword AuditAction = "reset_user_password"
)

// AuditTargetType 操作对象类型
type AuditTargetType string

const (
	AuditTargetAdmin AuditTargetType = "admin"
	AuditTargetUser  AuditTargetType = "user"
)

// AuditLog 操作日志模型
// 仅支持 INSERT + SELECT，不可 UPDATE/DELETE
type AuditLog struct {
	ID         uint64          `json:"id" gorm:"primaryKey;autoIncrement"`
	AdminID    uint64          `json:"admin_id" gorm:"not null;index"`
	AdminName  string          `json:"admin_name" gorm:"size:64;not null"`
	Action     AuditAction     `json:"action" gorm:"size:32;not null;index"`
	TargetType AuditTargetType `json:"target_type" gorm:"size:32;not null"`
	TargetID   *uint64         `json:"target_id,omitempty"`
	TargetName string          `json:"target_name,omitempty" gorm:"size:64"`
	Detail     string          `json:"detail,omitempty" gorm:"type:jsonb"`
	IPAddr     string          `json:"ip_addr,omitempty" gorm:"size:45"`
	UserAgent  string          `json:"user_agent,omitempty" gorm:"type:text"`
	CreatedAt  time.Time       `json:"created_at"`
}

// TableName 指定表名
func (AuditLog) TableName() string {
	return "audit_logs"
}
