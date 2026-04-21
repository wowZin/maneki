package repository

import (
	"context"
	"errors"

	"github.com/maneki/api/internal/model"
	"gorm.io/gorm"
)

// AntiArbitrageRuleRepository 防套利规则数据访问层
type AntiArbitrageRuleRepository struct {
	db *gorm.DB
}

// NewAntiArbitrageRuleRepository 创建防套利规则仓库
func NewAntiArbitrageRuleRepository(db *gorm.DB) *AntiArbitrageRuleRepository {
	return &AntiArbitrageRuleRepository{db: db}
}

// Create 创建防套利规则
func (r *AntiArbitrageRuleRepository) Create(ctx context.Context, rule *model.AntiArbitrageRule) error {
	return r.db.WithContext(ctx).Create(rule).Error
}

// GetByID 根据ID获取防套利规则
func (r *AntiArbitrageRuleRepository) GetByID(ctx context.Context, id uint) (*model.AntiArbitrageRule, error) {
	var rule model.AntiArbitrageRule
	err := r.db.WithContext(ctx).First(&rule, id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &rule, nil
}

// List 获取防套利规则列表
func (r *AntiArbitrageRuleRepository) List(ctx context.Context, filters map[string]interface{}) ([]*model.AntiArbitrageRule, error) {
	var rules []*model.AntiArbitrageRule

	query := r.db.WithContext(ctx).Model(&model.AntiArbitrageRule{})

	if status, ok := filters["status"].(string); ok && status != "" {
		query = query.Where("status = ?", status)
	}
	if strategyType, ok := filters["strategy_type"].(string); ok && strategyType != "" {
		query = query.Where("strategy_type = ?", strategyType)
	}

	err := query.Order("priority DESC, created_at DESC").Find(&rules).Error
	return rules, err
}

// Update 更新防套利规则
func (r *AntiArbitrageRuleRepository) Update(ctx context.Context, rule *model.AntiArbitrageRule) error {
	return r.db.WithContext(ctx).Save(rule).Error
}

// Delete 删除防套利规则
func (r *AntiArbitrageRuleRepository) Delete(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&model.AntiArbitrageRule{}, id).Error
}

// ListActive 获取所有生效的防套利规则（按优先级排序）
func (r *AntiArbitrageRuleRepository) ListActive(ctx context.Context) ([]*model.AntiArbitrageRule, error) {
	var rules []*model.AntiArbitrageRule
	err := r.db.WithContext(ctx).
		Where("status = ?", model.AntiArbitrageStatusActive).
		Order("priority DESC, created_at DESC").
		Find(&rules).Error
	return rules, err
}
