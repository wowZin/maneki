package model

import (
	"time"
)

// User 用户模型
type User struct {
	ID           uint      `json:"id" gorm:"primaryKey"`
	Phone        string    `json:"phone" gorm:"uniqueIndex;size:20"`
	Nickname     string    `json:"nickname" gorm:"size:50"`
	Avatar       string    `json:"avatar" gorm:"size:255"`
	VIPLevel     int       `json:"vip_level" gorm:"default:0"`      // 0=免费, 1=VIP, 2=SVIP
	VIPExpireAt  time.Time `json:"vip_expire_at"`                   // VIP过期时间
	IsSuperuser  bool      `json:"is_superuser" gorm:"default:false"`
	Status       int       `json:"status" gorm:"default:1"`         // 1=正常, 0=禁用
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

func (User) TableName() string {
	return "users"
}

// IsVIP 检查是否是VIP用户
func (u *User) IsVIP() bool {
	return u.VIPLevel >= 1 && u.VIPExpireAt.After(time.Now())
}

// IsSVIP 检查是否是SVIP用户
func (u *User) IsSVIP() bool {
	return u.VIPLevel >= 2 && u.VIPExpireAt.After(time.Now())
}

// IsFree 检查是否是免费用户
func (u *User) IsFree() bool {
	return !u.IsVIP() && !u.IsSVIP()
}

// CanUseRealtime 是否可以使用实时数据
func (u *User) CanUseRealtime() bool {
	return u.IsVIP() || u.IsSVIP()
}
