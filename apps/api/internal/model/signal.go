package model

import (
	"time"

	"gorm.io/gorm"
)

// Signal 交易信号记录表
type Signal struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	CreatedAt time.Time `json:"created_at"`

	Code       string  `json:"code" gorm:"index;size:20;not null"`
	SignalType string  `json:"signal_type" gorm:"size:20;not null"` // buy/sell/watch/alert
	Confidence float64 `json:"confidence" gorm:"type:decimal(3,2);not null"` // 0.00-1.00
	TriggerPrice *float64 `json:"trigger_price,omitempty" gorm:"type:decimal(10,4)"`
	Reason     string  `json:"reason,omitempty" gorm:"type:text"`
	AgentsVotes JSON    `json:"agents_votes,omitempty" gorm:"type:jsonb"`
	ExtraData  JSON    `json:"extra_data,omitempty" gorm:"type:jsonb"`
	IsValid    bool    `json:"is_valid" gorm:"default:true"` // 复盘时标记

	// 关联关系
	Stock     Stock          `json:"stock,omitempty" gorm:"foreignKey:Code;references:Code"`
	Decisions []AgentDecision `json:"decisions,omitempty" gorm:"foreignKey:SignalID"`
}

// TableName 指定表名
func (Signal) TableName() string {
	return "signals"
}

// BeforeCreate 创建前钩子
func (s *Signal) BeforeCreate(tx *gorm.DB) error {
	if s.CreatedAt.IsZero() {
		s.CreatedAt = time.Now()
	}
	return nil
}

// AgentDecision Agent决策详情表
type AgentDecision struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	CreatedAt time.Time `json:"created_at"`

	SignalID  uint    `json:"signal_id" gorm:"index;not null"`
	AgentType string  `json:"agent_type" gorm:"size:30;not null"`
	Decision  string  `json:"decision" gorm:"size:10;not null"` // buy/sell/hold
	Score     *float64 `json:"score,omitempty" gorm:"type:decimal(3,2)"`
	Reasoning string  `json:"reasoning,omitempty" gorm:"type:text"`
	Weight    float64 `json:"weight" gorm:"type:decimal(3,2);default:1.0"`

	// 关联关系
	Signal Signal `json:"signal,omitempty" gorm:"foreignKey:SignalID"`
}

// TableName 指定表名
func (AgentDecision) TableName() string {
	return "agent_decisions"
}
