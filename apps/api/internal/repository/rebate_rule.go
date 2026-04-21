package repository

import (
	"context"
	"errors"
	"time"

	"github.com/maneki/api/internal/model"
	"gorm.io/gorm"
)

// RebateRuleRepository 返佣规则数据访问层
type RebateRuleRepository struct {
	db *gorm.DB
}

// NewRebateRuleRepository 创建返佣规则仓库
func NewRebateRuleRepository(db *gorm.DB) *RebateRuleRepository {
	return &RebateRuleRepository{db: db}
}

// Create 创建返佣规则
func (r *RebateRuleRepository) Create(ctx context.Context, rule *model.RebateRule) error {
	return r.db.WithContext(ctx).Create(rule).Error
}

// GetByID 根据ID获取返佣规则（含激励规则）
func (r *RebateRuleRepository) GetByID(ctx context.Context, id uint) (*model.RebateRule, error) {
	var rule model.RebateRule
	err := r.db.WithContext(ctx).Preload("IncentiveRules").First(&rule, id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &rule, nil
}

// List 获取返佣规则列表
func (r *RebateRuleRepository) List(ctx context.Context, filters map[string]interface{}, page, pageSize int) ([]*model.RebateRule, int64, error) {
	var rules []*model.RebateRule
	var total int64

	query := r.db.WithContext(ctx).Model(&model.RebateRule{})

	if status, ok := filters["status"].(string); ok && status != "" {
		query = query.Where("status = ?", status)
	}
	if agentID, ok := filters["agent_id"].(uint); ok && agentID > 0 {
		query = query.Where("agent_id = ?", agentID)
	}

	err := query.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	err = query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&rules).Error
	return rules, total, err
}

// Update 更新返佣规则
func (r *RebateRuleRepository) Update(ctx context.Context, rule *model.RebateRule) error {
	return r.db.WithContext(ctx).Save(rule).Error
}

// Delete 删除返佣规则
func (r *RebateRuleRepository) Delete(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&model.RebateRule{}, id).Error
}

// FindActiveGlobal 查找当前生效的全局规则
func (r *RebateRuleRepository) FindActiveGlobal(ctx context.Context, now time.Time) (*model.RebateRule, error) {
	var rule model.RebateRule
	err := r.db.WithContext(ctx).
		Where("status = ? AND agent_id IS NULL AND start_at <= ? AND end_at >= ?", model.RebateStatusActive, now, now).
		Preload("IncentiveRules").
		First(&rule).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &rule, nil
}

// FindActiveByAgent 查找指定 Agent 当前生效的专属规则
func (r *RebateRuleRepository) FindActiveByAgent(ctx context.Context, agentID uint, now time.Time) (*model.RebateRule, error) {
	var rule model.RebateRule
	err := r.db.WithContext(ctx).
		Where("status = ? AND agent_id = ? AND start_at <= ? AND end_at >= ?", model.RebateStatusActive, agentID, now, now).
		Preload("IncentiveRules").
		First(&rule).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &rule, nil
}

// HasActiveGlobal 检查是否存在生效的全局规则（排除指定ID，用于更新时校验）
func (r *RebateRuleRepository) HasActiveGlobal(ctx context.Context, excludeID uint, now time.Time) (bool, error) {
	var count int64
	query := r.db.WithContext(ctx).Model(&model.RebateRule{}).
		Where("status = ? AND agent_id IS NULL AND start_at <= ? AND end_at >= ?", model.RebateStatusActive, now, now)
	if excludeID > 0 {
		query = query.Where("id != ?", excludeID)
	}
	err := query.Count(&count).Error
	return count > 0, err
}

// HasActiveByAgent 检查指定 Agent 是否已有生效规则（排除指定ID）
func (r *RebateRuleRepository) HasActiveByAgent(ctx context.Context, agentID uint, excludeID uint, now time.Time) (bool, error) {
	var count int64
	query := r.db.WithContext(ctx).Model(&model.RebateRule{}).
		Where("status = ? AND agent_id = ? AND start_at <= ? AND end_at >= ?", model.RebateStatusActive, agentID, now, now)
	if excludeID > 0 {
		query = query.Where("id != ?", excludeID)
	}
	err := query.Count(&count).Error
	return count > 0, err
}

// DeleteIncentivesByRuleID 删除指定规则的所有激励规则
func (r *RebateRuleRepository) DeleteIncentivesByRuleID(ctx context.Context, ruleID uint) error {
	return r.db.WithContext(ctx).Where("rebate_rule_id = ?", ruleID).Delete(&model.IncentiveRule{}).Error
}
