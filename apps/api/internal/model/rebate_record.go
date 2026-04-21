package model

import (
	"errors"
	"time"
)

// RebateRecordStatus 返佣记录状态
type RebateRecordStatus string

const (
	RebateRecordStatusPending   RebateRecordStatus = "pending"
	RebateRecordStatusSettled   RebateRecordStatus = "settled"
	RebateRecordStatusBlocked   RebateRecordStatus = "blocked"
	RebateRecordStatusReviewing RebateRecordStatus = "reviewing"
	RebateRecordStatusRefunded  RebateRecordStatus = "refunded"
)

// RebateRecord 返佣记录表
type RebateRecord struct {
	ID             uint      `json:"id" gorm:"primaryKey"`
	CreatedAt      time.Time `json:"created_at"`
	SubscriptionID uint      `json:"subscription_id" gorm:"uniqueIndex;not null"`

	AgentID uint  `json:"agent_id" gorm:"index;not null"`
	Agent   Agent `json:"agent,omitempty" gorm:"foreignKey:AgentID"`

	CreatorID uint `json:"creator_id" gorm:"index;not null"`
	// Creator 关联在查询时按需加载

	Quantity  int     `json:"quantity" gorm:"not null"`
	UnitPrice float64 `json:"unit_price" gorm:"type:decimal(10,2);not null"`
	Amount    float64 `json:"amount" gorm:"type:decimal(12,2);not null"`

	RebateRuleID uint       `json:"rebate_rule_id" gorm:"not null"`
	RebateRule   RebateRule `json:"rebate_rule,omitempty" gorm:"foreignKey:RebateRuleID"`

	Status        RebateRecordStatus `json:"status" gorm:"size:16;not null;default:'pending'"`
	ArbitrageTags StringArray        `json:"arbitrage_tags,omitempty" gorm:"type:jsonb"`

	ReviewedBy *uint      `json:"reviewed_by,omitempty"`
	ReviewedAt *time.Time `json:"reviewed_at,omitempty"`

	SettledAt *time.Time `json:"settled_at,omitempty"`
}

func (RebateRecord) TableName() string {
	return "rebate_records"
}

// Validate 校验返佣记录有效性
func (r *RebateRecord) Validate() error {
	if r.SubscriptionID == 0 {
		return errors.New("订阅ID不能为空")
	}
	if r.AgentID == 0 {
		return errors.New("AgentID不能为空")
	}
	if r.CreatorID == 0 {
		return errors.New("创作者ID不能为空")
	}
	if r.Quantity < 1 {
		return errors.New("订阅数量必须大于等于1")
	}
	if r.UnitPrice < 0 {
		return errors.New("单价不能为负数")
	}
	if r.Amount < 0 {
		return errors.New("返佣金额不能为负数")
	}
	if r.RebateRuleID == 0 {
		return errors.New("返佣规则ID不能为空")
	}
	return nil
}

// CanReview 检查记录是否可以审核
func (r *RebateRecord) CanReview() bool {
	return r.Status == RebateRecordStatusReviewing
}

// IsSettled 检查是否已结算
func (r *RebateRecord) IsSettled() bool {
	return r.Status == RebateRecordStatusSettled
}

// IsBlocked 检查是否已拦截
func (r *RebateRecord) IsBlocked() bool {
	return r.Status == RebateRecordStatusBlocked
}
