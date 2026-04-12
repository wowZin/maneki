package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// User 用户模型
type User struct {
	ID        uuid.UUID `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"deleted_at,omitempty" gorm:"index"`

	// 基础信息
	Email    string `json:"email" gorm:"uniqueIndex;size:255"`
	Username string `json:"username" gorm:"uniqueIndex;size:50"`
	FullName string `json:"full_name" gorm:"size:100"`
	Nickname string `json:"nickname" gorm:"size:100"`
	Phone    string `json:"phone" gorm:"size:20"`
	AvatarURL string `json:"avatar_url" gorm:"size:500"`

	// 安全信息（不暴露给前端）
	HashedPassword string `json:"-" gorm:"column:hashed_password;size:255"`

	// 用户状态
	IsActive    bool `json:"is_active" gorm:"default:true"`
	IsSuperuser bool `json:"is_superuser" gorm:"default:false"`
	IsVerified  bool `json:"is_verified" gorm:"default:false"`

	// 微信生态登录
	WechatUnionid   string `json:"wechat_unionid,omitempty" gorm:"uniqueIndex;size:64"`
	WechatMpOpenid  string `json:"wechat_mp_openid,omitempty" gorm:"uniqueIndex;size:64"`
	WechatMiniOpenid string `json:"wechat_mini_openid,omitempty" gorm:"uniqueIndex;size:64"`
	WechatOpenOpenid string `json:"wechat_open_openid,omitempty" gorm:"uniqueIndex;size:64"`
	WechatSessionKey string `json:"-" gorm:"size:64"`
	WechatAuthType   string `json:"wechat_auth_type,omitempty" gorm:"size:20"`

	// 注册来源
	RegisterSource string `json:"register_source" gorm:"size:20;default:'email'"`

	// VIP体系
	VIPLevel    int        `json:"vip_level" gorm:"default:0"`
	VIPExpireAt *time.Time `json:"vip_expire_at,omitempty"`

	// 关联关系
	Agents []UserAgent `json:"agents,omitempty" gorm:"foreignKey:UserID"`
}

// TableName 指定表名
func (User) TableName() string {
	return "users"
}

// BeforeCreate 创建前钩子
func (u *User) BeforeCreate(tx *gorm.DB) error {
	if u.ID == uuid.Nil {
		u.ID = uuid.New()
	}
	return nil
}

// DisplayName 获取显示名称
func (u *User) DisplayName() string {
	if u.Nickname != "" {
		return u.Nickname
	}
	if u.FullName != "" {
		return u.FullName
	}
	if u.Username != "" {
		return u.Username
	}
	if u.Email != "" {
		return u.Email
	}
	if u.Phone != "" {
		return u.Phone
	}
	return "用户"
}

// IsWechatUser 判断是否微信用户
func (u *User) IsWechatUser() bool {
	return u.WechatUnionid != "" || u.WechatMpOpenid != "" || u.WechatMiniOpenid != ""
}

// NeedBindPhone 判断是否需要绑定手机号
func (u *User) NeedBindPhone() bool {
	return u.Phone == "" && u.IsWechatUser()
}

// IsVIP 判断是否为有效VIP（包含SVIP）
func (u *User) IsVIP() bool {
	if u.VIPLevel < 1 {
		return false
	}
	if u.VIPExpireAt != nil && u.VIPExpireAt.Before(time.Now()) {
		return false
	}
	return true
}

// IsSVIP 判断是否为有效SVIP
func (u *User) IsSVIP() bool {
	if u.VIPLevel < 2 {
		return false
	}
	if u.VIPExpireAt != nil && u.VIPExpireAt.Before(time.Now()) {
		return false
	}
	return true
}

// VIPTier 获取VIP等级名称
func (u *User) VIPTier() string {
	if u.IsSVIP() {
		return "svip"
	}
	if u.IsVIP() {
		return "vip"
	}
	return "free"
}

// CanUseRealtime 是否可以使用实时数据
func (u *User) CanUseRealtime() bool {
	return u.IsVIP() || u.IsSVIP()
}

// UserAgent 用户Agent关联表
type UserAgent struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	UserID uuid.UUID `json:"user_id" gorm:"type:uuid;index"`
	AgentID uint     `json:"agent_id" gorm:"index"`

	// 关联关系
	User  User  `json:"user,omitempty" gorm:"foreignKey:UserID"`
	Agent Agent `json:"agent,omitempty" gorm:"foreignKey:AgentID"`
}

// TableName 指定表名
func (UserAgent) TableName() string {
	return "user_agents"
}
