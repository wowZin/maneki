package model

import (
	"time"

	"github.com/google/uuid"
)

// Agent Agent模板表
type Agent struct {
	ID          uint      `json:"id" gorm:"primaryKey"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`

	// 基础信息
	Name        string `json:"name" gorm:"size:100;not null"`
	Description string `json:"description" gorm:"type:text"`
	Avatar      string `json:"avatar" gorm:"size:500"`

	// Agent类型
	Type        string `json:"type" gorm:"size:30;not null"` // technical/fundamental/sentiment/capital/decision
	Category    string `json:"category" gorm:"size:50"`

	// 策略配置
	StrategyConfig JSON `json:"strategy_config,omitempty" gorm:"type:jsonb"`

	// 定价
	Price       float64 `json:"price" gorm:"type:decimal(10,2);default:0"`
	PriceType   string  `json:"price_type" gorm:"size:20;default:'onetime'"` // onetime/monthly/yearly

	// 状态
	IsActive    bool `json:"is_active" gorm:"default:true"`
	IsFeatured  bool `json:"is_featured" gorm:"default:false"` // 精选Agent，免费用户可用
	IsOfficial  bool `json:"is_official" gorm:"default:false"` // 官方Agent

	// 统计
	UseCount    int     `json:"use_count" gorm:"default:0"`
	Rating      float64 `json:"rating" gorm:"type:decimal(2,1);default:5.0"`
	RatingCount int     `json:"rating_count" gorm:"default:0"`

	// 所属用户
	OwnerID *uuid.UUID `json:"owner_id,omitempty" gorm:"type:uuid;index"`

	// 关联关系
	Owner *User `json:"owner,omitempty" gorm:"foreignKey:OwnerID"`
}

// TableName 指定表名
func (Agent) TableName() string {
	return "agents"
}

// AgentWeight Agent权重配置表
type AgentWeight struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	UserID   uuid.UUID `json:"user_id" gorm:"type:uuid;index;not null"`
	AgentID  uint      `json:"agent_id" gorm:"index;not null"`

	// 权重配置
	Weight      float64 `json:"weight" gorm:"type:decimal(3,2);default:1.0"`
	IsEnabled   bool    `json:"is_enabled" gorm:"default:true"`
	CustomConfig JSON   `json:"custom_config,omitempty" gorm:"type:jsonb"`

	// 关联关系
	User  User  `json:"user,omitempty" gorm:"foreignKey:UserID"`
	Agent Agent `json:"agent,omitempty" gorm:"foreignKey:AgentID"`
}

// TableName 指定表名
func (AgentWeight) TableName() string {
	return "agent_weights"
}

// AgentSubscription Agent订阅表
type AgentSubscription struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	UserID  uuid.UUID `json:"user_id" gorm:"type:uuid;index;not null"`
	AgentID uint      `json:"agent_id" gorm:"index;not null"`

	// 订阅信息
	StartDate   time.Time  `json:"start_date"`
	EndDate     *time.Time `json:"end_date,omitempty"`
	Status      string     `json:"status" gorm:"size:20;default:'active'"` // active/expired/cancelled
	Price       float64    `json:"price" gorm:"type:decimal(10,2)"`
	OrderID     string     `json:"order_id" gorm:"size:100"`

	// 关联关系
	User  User  `json:"user,omitempty" gorm:"foreignKey:UserID"`
	Agent Agent `json:"agent,omitempty" gorm:"foreignKey:AgentID"`
}

// TableName 指定表名
func (AgentSubscription) TableName() string {
	return "agent_subscriptions"
}
