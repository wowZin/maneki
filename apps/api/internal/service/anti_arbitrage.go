package service

import (
	"context"
	"errors"

	"github.com/maneki/api/internal/model"
	"github.com/maneki/api/internal/repository"
)

// AntiArbitrageService 防套利规则服务
type AntiArbitrageService struct {
	repo *repository.AntiArbitrageRuleRepository
}

// NewAntiArbitrageService 创建防套利服务
func NewAntiArbitrageService(repo *repository.AntiArbitrageRuleRepository) *AntiArbitrageService {
	return &AntiArbitrageService{repo: repo}
}

// CreateRule 创建防套利规则
func (s *AntiArbitrageService) CreateRule(ctx context.Context, rule *model.AntiArbitrageRule) error {
	if err := rule.Validate(); err != nil {
		return err
	}
	return s.repo.Create(ctx, rule)
}

// GetRule 获取防套利规则
func (s *AntiArbitrageService) GetRule(ctx context.Context, id uint) (*model.AntiArbitrageRule, error) {
	return s.repo.GetByID(ctx, id)
}

// ListRules 获取防套利规则列表
func (s *AntiArbitrageService) ListRules(ctx context.Context, filters map[string]interface{}) ([]*model.AntiArbitrageRule, error) {
	return s.repo.List(ctx, filters)
}

// UpdateRule 更新防套利规则
func (s *AntiArbitrageService) UpdateRule(ctx context.Context, id uint, updates map[string]interface{}) error {
	rule, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if rule == nil {
		return errors.New("规则不存在")
	}

	if name, ok := updates["name"].(string); ok {
		rule.Name = name
	}
	if strategyType, ok := updates["strategy_type"].(string); ok {
		rule.StrategyType = model.AntiArbitrageStrategyType(strategyType)
	}
	if action, ok := updates["action"].(string); ok {
		rule.Action = model.AntiArbitrageAction(action)
	}
	if priority, ok := updates["priority"].(int); ok {
		rule.Priority = priority
	}

	if err := rule.Validate(); err != nil {
		return err
	}
	return s.repo.Update(ctx, rule)
}

// ToggleStatus 切换状态
func (s *AntiArbitrageService) ToggleStatus(ctx context.Context, id uint, status model.AntiArbitrageStatus) error {
	rule, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if rule == nil {
		return errors.New("规则不存在")
	}
	rule.Status = status
	return s.repo.Update(ctx, rule)
}

// DeleteRule 删除规则
func (s *AntiArbitrageService) DeleteRule(ctx context.Context, id uint) error {
	return s.repo.Delete(ctx, id)
}
