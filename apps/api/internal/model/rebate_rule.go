package model

import (
	"errors"
	"time"
)

// RebateStatus 返佣规则状态
type RebateStatus string

const (
	RebateStatusActive   RebateStatus = "active"
	RebateStatusInactive RebateStatus = "inactive"
)

// RebateRule 返佣定价规则表
type RebateRule struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	Name      string  `json:"name" gorm:"size:128;not null"`
	UnitPrice float64 `json:"unit_price" gorm:"type:decimal(10,2);not null"`

	// 适用对象：NULL 表示全局默认，非 NULL 表示指定 Agent
	AgentID *uint `json:"agent_id,omitempty" gorm:"index"`
	Agent   Agent `json:"agent,omitempty" gorm:"foreignKey:AgentID"`

	StartAt time.Time `json:"start_at" gorm:"not null"`
	EndAt   time.Time `json:"end_at" gorm:"not null"`

	Status RebateStatus `json:"status" gorm:"size:16;not null;default:'active'"`

	CreatedBy uint  `json:"created_by" gorm:"not null"`
	Admin     Admin `json:"admin,omitempty" gorm:"foreignKey:CreatedBy"`

	// 关联的阶梯激励规则
	IncentiveRules []IncentiveRule `json:"incentive_rules,omitempty" gorm:"foreignKey:RebateRuleID;references:ID"`
}

func (RebateRule) TableName() string {
	return "rebate_rules"
}

// Validate 校验规则有效性
func (r *RebateRule) Validate() error {
	if r.Name == "" {
		return errors.New("规则名称不能为空")
	}
	if r.UnitPrice < 0 {
		return errors.New("返佣单价不能为负数")
	}
	if !r.EndAt.After(r.StartAt) {
		return errors.New("结束时间必须晚于开始时间")
	}
	if r.Status != RebateStatusActive && r.Status != RebateStatusInactive {
		return errors.New("无效的状态值")
	}
	return nil
}

// IncentiveRule 阶梯激励规则表
type IncentiveRule struct {
	ID           uint    `json:"id" gorm:"primaryKey"`
	CreatedAt    time.Time `json:"created_at"`
	RebateRuleID uint      `json:"rebate_rule_id" gorm:"not null;index"`
	RangeStart   int       `json:"range_start" gorm:"not null"`
	RangeEnd     *int      `json:"range_end,omitempty"`
	Coefficient  float64   `json:"coefficient" gorm:"type:decimal(5,2);not null;default:1.00"`
}

func (IncentiveRule) TableName() string {
	return "incentive_rules"
}

// Validate 校验激励规则有效性
func (ir *IncentiveRule) Validate() error {
	if ir.RangeStart < 1 {
		return errors.New("区间下限必须大于等于1")
	}
	if ir.RangeEnd != nil && *ir.RangeEnd < ir.RangeStart {
		return errors.New("区间上限不能小于下限")
	}
	if ir.Coefficient < 0 {
		return errors.New("激励系数不能为负数")
	}
	return nil
}

// ValidateIncentiveRules 校验一组激励规则的连续性
func ValidateIncentiveRules(rules []IncentiveRule) error {
	if len(rules) == 0 {
		return nil
	}

	// 按 range_start 排序后校验（调用方应保证已排序）
	if rules[0].RangeStart != 1 {
		return errors.New("第一个激励区间的下限必须为1")
	}

	for i := 0; i < len(rules); i++ {
		if err := rules[i].Validate(); err != nil {
			return err
		}
		if i > 0 {
			prevEnd := rules[i-1].RangeEnd
			if prevEnd == nil {
				return errors.New("前一个区间没有设置上限，后续区间将产生间隙")
			}
			if rules[i].RangeStart != *prevEnd+1 {
				return errors.New("激励区间必须连续无间隙")
			}
		}
	}

	return nil
}
