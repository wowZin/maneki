package service

import (
	"errors"
	"sort"

	"github.com/maneki/api/internal/model"
)

// RebateCalculator 返佣金额计算器
type RebateCalculator struct{}

// NewRebateCalculator 创建计算器
func NewRebateCalculator() *RebateCalculator {
	return &RebateCalculator{}
}

// Calculate 根据规则和订阅数量计算返佣金额（超额累进）
func (c *RebateCalculator) Calculate(rule *model.RebateRule, quantity int) (float64, error) {
	if rule == nil {
		return 0, errors.New("返佣规则不能为空")
	}
	if quantity < 1 {
		return 0, errors.New("订阅数量必须大于等于1")
	}
	if rule.UnitPrice < 0 {
		return 0, errors.New("返佣单价不能为负数")
	}

	// 没有激励规则时，按基础公式计算
	if len(rule.IncentiveRules) == 0 {
		return float64(quantity) * rule.UnitPrice, nil
	}

	// 按 range_start 排序激励规则
	rules := make([]model.IncentiveRule, len(rule.IncentiveRules))
	copy(rules, rule.IncentiveRules)
	sort.Slice(rules, func(i, j int) bool {
		return rules[i].RangeStart < rules[j].RangeStart
	})

	// 校验连续性
	if err := model.ValidateIncentiveRules(rules); err != nil {
		return 0, err
	}

	var totalAmount float64
	remaining := quantity

	for _, ir := range rules {
		if remaining <= 0 {
			break
		}

		// 计算该区间的有效数量
		var intervalEnd int
		if ir.RangeEnd != nil {
			intervalEnd = *ir.RangeEnd
		} else {
			// 无上限区间，消耗所有剩余数量
			intervalEnd = ir.RangeStart + remaining - 1
		}

		intervalSize := intervalEnd - ir.RangeStart + 1
		if intervalSize <= 0 {
			continue
		}

		qtyInInterval := remaining
		if qtyInInterval > intervalSize {
			qtyInInterval = intervalSize
		}

		amount := float64(qtyInInterval) * rule.UnitPrice * ir.Coefficient
		totalAmount += amount
		remaining -= qtyInInterval
	}

	return totalAmount, nil
}
