package service

import (
	"context"
	"errors"
	"time"

	"github.com/maneki/api/internal/model"
	"github.com/maneki/api/internal/repository"
)

// RebateRuleService 返佣定价规则服务
type RebateRuleService struct {
	repo      *repository.RebateRuleRepository
	calc      *RebateCalculator
}

// NewRebateRuleService 创建返佣规则服务
func NewRebateRuleService(repo *repository.RebateRuleRepository) *RebateRuleService {
	return &RebateRuleService{
		repo: repo,
		calc: NewRebateCalculator(),
	}
}

// CreateRebateRule 创建返佣规则
func (s *RebateRuleService) CreateRebateRule(ctx context.Context, rule *model.RebateRule, incentives []model.IncentiveRule) error {
	// 校验规则
	if err := rule.Validate(); err != nil {
		return err
	}

	// 校验激励规则
	if len(incentives) > 0 {
		if err := model.ValidateIncentiveRules(incentives); err != nil {
			return err
		}
	}

	now := time.Now()

	// 全局规则唯一性校验
	if rule.AgentID == nil || *rule.AgentID == 0 {
		hasGlobal, err := s.repo.HasActiveGlobal(ctx, 0, now)
		if err != nil {
			return err
		}
		if hasGlobal && rule.Status == model.RebateStatusActive {
			return errors.New("已存在全局返佣规则，请先停用现有规则")
		}
	} else {
		// 专属规则唯一性校验
		hasAgentRule, err := s.repo.HasActiveByAgent(ctx, *rule.AgentID, 0, now)
		if err != nil {
			return err
		}
		if hasAgentRule && rule.Status == model.RebateStatusActive {
			return errors.New("该Agent已存在生效的返佣规则")
		}
	}

	// 创建规则（含激励规则）
	rule.IncentiveRules = incentives
	return s.repo.Create(ctx, rule)
}

// GetRebateRule 获取返佣规则详情
func (s *RebateRuleService) GetRebateRule(ctx context.Context, id uint) (*model.RebateRule, error) {
	return s.repo.GetByID(ctx, id)
}

// ListRebateRules 获取返佣规则列表
func (s *RebateRuleService) ListRebateRules(ctx context.Context, filters map[string]interface{}, page, pageSize int) ([]*model.RebateRule, int64, error) {
	return s.repo.List(ctx, filters, page, pageSize)
}

// UpdateRebateRule 更新返佣规则
func (s *RebateRuleService) UpdateRebateRule(ctx context.Context, id uint, updates map[string]interface{}, incentives []model.IncentiveRule) error {
	rule, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if rule == nil {
		return errors.New("规则不存在")
	}

	// 应用更新
	if name, ok := updates["name"].(string); ok {
		rule.Name = name
	}
	if unitPrice, ok := updates["unit_price"].(float64); ok {
		rule.UnitPrice = unitPrice
	}
	if startAt, ok := updates["start_at"].(time.Time); ok {
		rule.StartAt = startAt
	}
	if endAt, ok := updates["end_at"].(time.Time); ok {
		rule.EndAt = endAt
	}

	if err := rule.Validate(); err != nil {
		return err
	}

	// 如果更新激励规则
	if len(incentives) > 0 {
		if err := model.ValidateIncentiveRules(incentives); err != nil {
			return err
		}
		// 删除旧激励规则，创建新激励规则
		if err := s.repo.DeleteIncentivesByRuleID(ctx, id); err != nil {
			return err
		}
		rule.IncentiveRules = incentives
	}

	return s.repo.Update(ctx, rule)
}

// ToggleRebateRuleStatus 切换返佣规则状态
func (s *RebateRuleService) ToggleRebateRuleStatus(ctx context.Context, id uint, status model.RebateStatus) error {
	rule, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if rule == nil {
		return errors.New("规则不存在")
	}

	rule.Status = status
	if err := rule.Validate(); err != nil {
		return err
	}

	now := time.Now()

	// 启用时校验唯一性
	if status == model.RebateStatusActive {
		if rule.AgentID == nil || *rule.AgentID == 0 {
			hasGlobal, err := s.repo.HasActiveGlobal(ctx, rule.ID, now)
			if err != nil {
				return err
			}
			if hasGlobal {
				return errors.New("已存在全局返佣规则，请先停用现有规则")
			}
		} else {
			hasAgentRule, err := s.repo.HasActiveByAgent(ctx, *rule.AgentID, rule.ID, now)
			if err != nil {
				return err
			}
			if hasAgentRule {
				return errors.New("该Agent已存在生效的返佣规则")
			}
		}
	}

	return s.repo.Update(ctx, rule)
}

// DeleteRebateRule 删除返佣规则
func (s *RebateRuleService) DeleteRebateRule(ctx context.Context, id uint) error {
	// 检查是否有返佣记录引用
	// 这里简化处理，实际应由数据库外键约束或关联查询控制
	return s.repo.Delete(ctx, id)
}

// GetActiveRuleForAgent 获取Agent当前生效的返佣规则（优先专属规则）
func (s *RebateRuleService) GetActiveRuleForAgent(ctx context.Context, agentID uint) (*model.RebateRule, error) {
	now := time.Now()

	// 优先查找专属规则
	rule, err := s.repo.FindActiveByAgent(ctx, agentID, now)
	if err != nil {
		return nil, err
	}
	if rule != nil {
		return rule, nil
	}

	//  fallback 到全局规则
	return s.repo.FindActiveGlobal(ctx, now)
}
