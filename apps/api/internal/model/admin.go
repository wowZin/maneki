package model

import (
	"regexp"
	"time"

	"gorm.io/gorm"
)

// AdminRole 管理员角色
type AdminRole string

const (
	AdminRoleSuper AdminRole = "super"
	AdminRoleAdmin AdminRole = "admin"
)

// Admin 管理员模型
// 与用户表(users)完全隔离，独立的管理员账号体系
type Admin struct {
	ID                  uint64    `json:"id" gorm:"primaryKey;autoIncrement"`
	Name                string    `json:"name" gorm:"uniqueIndex;size:64;not null"`
	PasswordHash        string    `json:"-" gorm:"column:password_hash;size:255;not null"`
	Role                AdminRole `json:"role" gorm:"size:16;not null;default:'admin'"`
	IsActive            bool      `json:"is_active" gorm:"default:true;not null"`
	ForceChangePassword bool      `json:"force_change_password" gorm:"default:false;not null"`
	CreatedAt           time.Time `json:"created_at"`
	UpdatedAt           time.Time `json:"updated_at"`
	LastLoginAt         *time.Time `json:"last_login_at,omitempty"`
	LastLoginIP         string     `json:"last_login_ip,omitempty" gorm:"size:45"`
}

// TableName 指定表名
func (Admin) TableName() string {
	return "admins"
}

// IsSuper 判断是否为超级管理员
func (a *Admin) IsSuper() bool {
	return a.Role == AdminRoleSuper
}

// ValidateName 验证账户名称
func (a *Admin) ValidateName() bool {
	if len(a.Name) < 3 || len(a.Name) > 64 {
		return false
	}
	// 只允许字母、数字、下划线，不能以数字开头
	matched, _ := regexp.MatchString("^[a-zA-Z_][a-zA-Z0-9_]*$", a.Name)
	return matched
}

// BeforeCreate 创建前钩子
func (a *Admin) BeforeCreate(tx *gorm.DB) error {
	if a.Role == "" {
		a.Role = AdminRoleAdmin
	}
	return nil
}
