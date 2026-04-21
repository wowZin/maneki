package model

import (
	"errors"
	"time"
)

// AntiArbitrageStrategyType 防套利策略类型
type AntiArbitrageStrategyType string

const (
	AntiArbitrageSelfSubscribe     AntiArbitrageStrategyType = "self_subscribe"
	AntiArbitrageIPFreq            AntiArbitrageStrategyType = "ip_freq"
	AntiArbitrageNewUserThreshold  AntiArbitrageStrategyType = "new_user_threshold"
	AntiArbitrageLinkedAccount     AntiArbitrageStrategyType = "linked_account"
)

// AntiArbitrageAction 防套利处理动作
type AntiArbitrageAction string

const (
	AntiArbitrageActionBlock  AntiArbitrageAction = "block"
	AntiArbitrageActionReview AntiArbitrageAction = "review"
)

// AntiArbitrageStatus 防套利规则状态
type AntiArbitrageStatus string

const (
	AntiArbitrageStatusActive   AntiArbitrageStatus = "active"
	AntiArbitrageStatusInactive AntiArbitrageStatus = "inactive"
)

// AntiArbitrageRule 防套利规则表
type AntiArbitrageRule struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	Name         string                    `json:"name" gorm:"size:128;not null"`
	StrategyType AntiArbitrageStrategyType `json:"strategy_type" gorm:"size:32;not null;index"`
	RuleParams   JSON                      `json:"rule_params" gorm:"type:jsonb;not null"`
	Action       AntiArbitrageAction       `json:"action" gorm:"size:16;not null"`
	Status       AntiArbitrageStatus       `json:"status" gorm:"size:16;not null;default:'active'"`
	Priority     int                       `json:"priority" gorm:"not null;default:0"`

	CreatedBy uint  `json:"created_by" gorm:"not null"`
	Admin     Admin `json:"admin,omitempty" gorm:"foreignKey:CreatedBy"`
}

func (AntiArbitrageRule) TableName() string {
	return "anti_arbitrage_rules"
}

// Validate 校验防套利规则有效性
func (r *AntiArbitrageRule) Validate() error {
	if r.Name == "" {
		return errors.New("规则名称不能为空")
	}
	switch r.StrategyType {
	case AntiArbitrageSelfSubscribe, AntiArbitrageIPFreq, AntiArbitrageNewUserThreshold, AntiArbitrageLinkedAccount:
		// valid
	default:
		return errors.New("无效的策略类型")
	}
	if r.Action != AntiArbitrageActionBlock && r.Action != AntiArbitrageActionReview {
		return errors.New("无效的处理动作")
	}
	if r.Status != AntiArbitrageStatusActive && r.Status != AntiArbitrageStatusInactive {
		return errors.New("无效的状态值")
	}
	return nil
}

// IsActive 检查规则是否启用
func (r *AntiArbitrageRule) IsActive() bool {
	return r.Status == AntiArbitrageStatusActive
}

// IPFreqParams IP频次策略参数
type IPFreqParams struct {
	WindowHours int `json:"window_hours"`
	MaxCount    int `json:"max_count"`
}

// NewUserThresholdParams 新用户阈值策略参数
type NewUserThresholdParams struct {
	WindowDays        int `json:"window_days"`
	MaxSubscriptions  int `json:"max_subscriptions"`
}
