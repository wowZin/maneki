package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/maneki/api/internal/model"
	"gorm.io/gorm"
)

// AgentRepository Agent数据访问层
type AgentRepository struct {
	db *gorm.DB
}

// NewAgentRepository 创建Agent仓库
func NewAgentRepository(db *gorm.DB) *AgentRepository {
	return &AgentRepository{db: db}
}

// Create 创建Agent
func (r *AgentRepository) Create(ctx context.Context, agent *model.Agent) error {
	return r.db.WithContext(ctx).Create(agent).Error
}

// GetByID 根据ID获取Agent
func (r *AgentRepository) GetByID(ctx context.Context, id uint) (*model.Agent, error) {
	var agent model.Agent
	err := r.db.WithContext(ctx).First(&agent, id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &agent, nil
}

// GetByName 根据名称获取Agent（用于唯一性校验）
func (r *AgentRepository) GetByName(ctx context.Context, name string) (*model.Agent, error) {
	var agent model.Agent
	err := r.db.WithContext(ctx).Where("name = ?", name).First(&agent).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &agent, nil
}

// List 获取Agent列表
func (r *AgentRepository) List(ctx context.Context, filters map[string]interface{}, page, pageSize int) ([]*model.Agent, int64, error) {
	var agents []*model.Agent
	var total int64

	query := r.db.WithContext(ctx).Model(&model.Agent{})

	// 应用过滤条件
	if isActive, ok := filters["is_active"].(bool); ok {
		query = query.Where("is_active = ?", isActive)
	}
	if isFeatured, ok := filters["is_featured"].(bool); ok {
		query = query.Where("is_featured = ?", isFeatured)
	}
	if agentType, ok := filters["type"].(string); ok && agentType != "" {
		query = query.Where("type = ?", agentType)
	}
	if ownerID, ok := filters["owner_id"].(uuid.UUID); ok {
		query = query.Where("owner_id = ?", ownerID)
	}

	err := query.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	err = query.Offset(offset).Limit(pageSize).Find(&agents).Error
	return agents, total, err
}

// ListAdmin 管理员获取Agent列表（支持搜索，不限制状态）
func (r *AgentRepository) ListAdmin(ctx context.Context, filters map[string]interface{}, page, pageSize int) ([]*model.Agent, int64, error) {
	var agents []*model.Agent
	var total int64

	query := r.db.WithContext(ctx).Model(&model.Agent{})

	// 搜索名称或描述
	if search, ok := filters["search"].(string); ok && search != "" {
		query = query.Where("name ILIKE ? OR description ILIKE ?", "%"+search+"%", "%"+search+"%")
	}

	err := query.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	err = query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&agents).Error
	return agents, total, err
}

// ListFeatured 获取精选Agent列表
func (r *AgentRepository) ListFeatured(ctx context.Context) ([]*model.Agent, error) {
	var agents []*model.Agent
	err := r.db.WithContext(ctx).
		Where("is_active = ? AND is_featured = ?", true, true).
		Find(&agents).Error
	return agents, err
}

// ListWithSorting 获取Agent列表（支持排序、筛选、分页）
func (r *AgentRepository) ListWithSorting(ctx context.Context, filters map[string]interface{}, sortBy, sortOrder string, page, pageSize int) ([]*model.Agent, int64, error) {
	var agents []*model.Agent
	var total int64

	query := r.db.WithContext(ctx).Model(&model.Agent{}).Where("is_active = ?", true)

	// 应用过滤条件
	if agentType, ok := filters["type"].(string); ok && agentType != "" {
		query = query.Where("type = ?", agentType)
	}
	if category, ok := filters["category"].(string); ok && category != "" {
		query = query.Where("category = ?", category)
	}

	err := query.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	// 排序
	orderClause := sortBy + " " + sortOrder
	if sortBy == "accuracy" {
		// 准确率排序需要在查询后处理（因为来自快照表）
		orderClause = "created_at DESC"
	}
	if sortBy == "created_at" {
		orderClause = "created_at " + sortOrder
	} else if sortBy == "use_count" {
		orderClause = "use_count " + sortOrder
	} else if sortBy == "rating" {
		orderClause = "rating " + sortOrder
	}

	offset := (page - 1) * pageSize
	err = query.Preload("Owner").Order(orderClause).Offset(offset).Limit(pageSize).Find(&agents).Error
	return agents, total, err
}

// GetByIDWithOwner 根据ID获取Agent并关联Owner信息
func (r *AgentRepository) GetByIDWithOwner(ctx context.Context, id uint) (*model.Agent, error) {
	var agent model.Agent
	err := r.db.WithContext(ctx).Preload("Owner").First(&agent, id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &agent, nil
}

// GetAccuracyByAgentID 获取Agent最新命中率（30天周期）
func (r *AgentRepository) GetAccuracyByAgentID(ctx context.Context, agentID uint) (hitRate *float64, totalPredictions, hitCount int, err error) {
	type result struct {
		HitRate          *float64 `gorm:"column:hit_rate"`
		TotalPredictions int      `gorm:"column:total_predictions"`
		HitCount         int      `gorm:"column:hit_count"`
	}
	var res result
	err = r.db.WithContext(ctx).Raw(`
		SELECT hit_rate, total_predictions, hit_count
		FROM agent_performance_snapshots
		WHERE agent_id = ? AND period_type = '30d'
		ORDER BY calculated_at DESC
		LIMIT 1
	`, agentID).Scan(&res).Error
	if err != nil {
		return nil, 0, 0, err
	}
	return res.HitRate, res.TotalPredictions, res.HitCount, nil
}

// Update 更新Agent
func (r *AgentRepository) Update(ctx context.Context, agent *model.Agent) error {
	return r.db.WithContext(ctx).Save(agent).Error
}

// Delete 删除Agent
func (r *AgentRepository) Delete(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&model.Agent{}, id).Error
}

// AgentWeightRepository Agent权重数据访问层
type AgentWeightRepository struct {
	db *gorm.DB
}

// NewAgentWeightRepository 创建Agent权重仓库
func NewAgentWeightRepository(db *gorm.DB) *AgentWeightRepository {
	return &AgentWeightRepository{db: db}
}

// GetUserWeights 获取用户的Agent权重配置
func (r *AgentWeightRepository) GetUserWeights(ctx context.Context, userID uuid.UUID) ([]*model.AgentWeight, error) {
	var weights []*model.AgentWeight
	err := r.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Preload("Agent").
		Find(&weights).Error
	return weights, err
}

// GetByUserAndAgent 获取指定用户的Agent权重
func (r *AgentWeightRepository) GetByUserAndAgent(ctx context.Context, userID uuid.UUID, agentID uint) (*model.AgentWeight, error) {
	var weight model.AgentWeight
	err := r.db.WithContext(ctx).
		Where("user_id = ? AND agent_id = ?", userID, agentID).
		First(&weight).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &weight, nil
}

// CreateOrUpdate 创建或更新权重
func (r *AgentWeightRepository) CreateOrUpdate(ctx context.Context, weight *model.AgentWeight) error {
	return r.db.WithContext(ctx).Save(weight).Error
}

// AgentSubscriptionRepository Agent订阅数据访问层
type AgentSubscriptionRepository struct {
	db *gorm.DB
}

// NewAgentSubscriptionRepository 创建Agent订阅仓库
func NewAgentSubscriptionRepository(db *gorm.DB) *AgentSubscriptionRepository {
	return &AgentSubscriptionRepository{db: db}
}

// GetUserSubscriptions 获取用户的订阅列表
func (r *AgentSubscriptionRepository) GetUserSubscriptions(ctx context.Context, userID uuid.UUID, status string) ([]*model.AgentSubscription, error) {
	var subs []*model.AgentSubscription
	query := r.db.WithContext(ctx).Where("user_id = ?", userID)
	if status != "" {
		query = query.Where("status = ?", status)
	}
	err := query.Preload("Agent").Find(&subs).Error
	return subs, err
}

// Create 创建订阅
func (r *AgentSubscriptionRepository) Create(ctx context.Context, sub *model.AgentSubscription) error {
	return r.db.WithContext(ctx).Create(sub).Error
}

// UpdateStatus 更新订阅状态
func (r *AgentSubscriptionRepository) UpdateStatus(ctx context.Context, id uint, status string) error {
	return r.db.WithContext(ctx).
		Model(&model.AgentSubscription{}).
		Where("id = ?", id).
		Update("status", status).Error
}

// GetUserSubscription 获取指定用户对指定Agent的订阅
func (r *AgentSubscriptionRepository) GetUserSubscription(ctx context.Context, userID uuid.UUID, agentID uint) (*model.AgentSubscription, error) {
	var sub model.AgentSubscription
	err := r.db.WithContext(ctx).
		Where("user_id = ? AND agent_id = ?", userID, agentID).
		First(&sub).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &sub, nil
}

// CheckExistingSubscription 检查用户是否已有有效订阅
func (r *AgentSubscriptionRepository) CheckExistingSubscription(ctx context.Context, userID uuid.UUID, agentID uint) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&model.AgentSubscription{}).
		Where("user_id = ? AND agent_id = ? AND status = ?", userID, agentID, "active").
		Count(&count).Error
	return count > 0, err
}

// GetPendingSettlements 获取待结算的订阅
func (r *AgentSubscriptionRepository) GetPendingSettlements(ctx context.Context, days int) ([]*model.AgentSubscription, error) {
	var subs []*model.AgentSubscription
	cutoffDate := fmt.Sprintf("now() - interval '%d days'", days)
	err := r.db.WithContext(ctx).
		Where("status = 'active' AND created_at < ?", cutoffDate).
		Find(&subs).Error
	return subs, err
}
