package repository

import (
	"context"
	"errors"
	"time"

	"github.com/maneki/api/internal/model"
	"gorm.io/gorm"
)

// RebateRecordRepository 返佣记录数据访问层
type RebateRecordRepository struct {
	db *gorm.DB
}

// NewRebateRecordRepository 创建返佣记录仓库
func NewRebateRecordRepository(db *gorm.DB) *RebateRecordRepository {
	return &RebateRecordRepository{db: db}
}

// Create 创建返佣记录
func (r *RebateRecordRepository) Create(ctx context.Context, record *model.RebateRecord) error {
	return r.db.WithContext(ctx).Create(record).Error
}

// GetByID 根据ID获取返佣记录
func (r *RebateRecordRepository) GetByID(ctx context.Context, id uint) (*model.RebateRecord, error) {
	var record model.RebateRecord
	err := r.db.WithContext(ctx).First(&record, id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &record, nil
}

// GetBySubscriptionID 根据订阅ID获取返佣记录
func (r *RebateRecordRepository) GetBySubscriptionID(ctx context.Context, subscriptionID uint) (*model.RebateRecord, error) {
	var record model.RebateRecord
	err := r.db.WithContext(ctx).Where("subscription_id = ?", subscriptionID).First(&record).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &record, nil
}

// List 获取返佣记录列表（支持筛选）
func (r *RebateRecordRepository) List(ctx context.Context, filters map[string]interface{}, page, pageSize int) ([]*model.RebateRecord, int64, error) {
	var records []*model.RebateRecord
	var total int64

	query := r.db.WithContext(ctx).Model(&model.RebateRecord{})

	if status, ok := filters["status"].(string); ok && status != "" {
		query = query.Where("status = ?", status)
	}
	if agentID, ok := filters["agent_id"].(uint); ok && agentID > 0 {
		query = query.Where("agent_id = ?", agentID)
	}
	if creatorID, ok := filters["creator_id"].(uint); ok && creatorID > 0 {
		query = query.Where("creator_id = ?", creatorID)
	}
	if startDate, ok := filters["start_date"].(time.Time); ok {
		query = query.Where("created_at >= ?", startDate)
	}
	if endDate, ok := filters["end_date"].(time.Time); ok {
		query = query.Where("created_at <= ?", endDate)
	}

	err := query.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	err = query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&records).Error
	return records, total, err
}

// UpdateStatus 更新返佣记录状态
func (r *RebateRecordRepository) UpdateStatus(ctx context.Context, id uint, status model.RebateRecordStatus) error {
	return r.db.WithContext(ctx).Model(&model.RebateRecord{}).Where("id = ?", id).Update("status", status).Error
}

// Review 审核返佣记录
func (r *RebateRecordRepository) Review(ctx context.Context, id uint, status model.RebateRecordStatus, adminID uint) error {
	updates := map[string]interface{}{
		"status":      status,
		"reviewed_by": adminID,
		"reviewed_at": time.Now(),
	}
	return r.db.WithContext(ctx).Model(&model.RebateRecord{}).Where("id = ?", id).Updates(updates).Error
}

// MarkRefunded 标记退款
func (r *RebateRecordRepository) MarkRefunded(ctx context.Context, subscriptionID uint) error {
	return r.db.WithContext(ctx).Model(&model.RebateRecord{}).
		Where("subscription_id = ?", subscriptionID).
		Update("status", model.RebateRecordStatusRefunded).Error
}

// GetPendingForSettlement 获取待结算的记录（T+1 结算用）
func (r *RebateRecordRepository) GetPendingForSettlement(ctx context.Context, before time.Time) ([]*model.RebateRecord, error) {
	var records []*model.RebateRecord
	err := r.db.WithContext(ctx).
		Where("status = ? AND created_at < ?", model.RebateRecordStatusPending, before).
		Find(&records).Error
	return records, err
}

// BatchSettle 批量结算
func (r *RebateRecordRepository) BatchSettle(ctx context.Context, ids []uint) error {
	return r.db.WithContext(ctx).Model(&model.RebateRecord{}).
		Where("id IN ?", ids).
		Updates(map[string]interface{}{
			"status":     model.RebateRecordStatusSettled,
			"settled_at": time.Now(),
		}).Error
}

// GetStats 获取统计聚合数据
func (r *RebateRecordRepository) GetStats(ctx context.Context, startDate, endDate time.Time) (map[string]interface{}, error) {
	var result struct {
		TotalAmount        float64 `gorm:"column:total_amount"`
		TotalSubscriptions int64   `gorm:"column:total_subscriptions"`
		PendingCount       int64   `gorm:"column:pending_count"`
		BlockedCount       int64   `gorm:"column:blocked_count"`
		ReviewingCount     int64   `gorm:"column:reviewing_count"`
	}

	err := r.db.WithContext(ctx).Model(&model.RebateRecord{}).
		Select(
			"COALESCE(SUM(amount), 0) as total_amount",
			"COUNT(*) as total_subscriptions",
			"SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count",
			"SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) as blocked_count",
			"SUM(CASE WHEN status = 'reviewing' THEN 1 ELSE 0 END) as reviewing_count",
		).
		Where("created_at >= ? AND created_at <= ?", startDate, endDate).
		Scan(&result).Error

	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"total_rebate_amount":   result.TotalAmount,
		"total_subscriptions":   result.TotalSubscriptions,
		"pending_count":         result.PendingCount,
		"blocked_count":         result.BlockedCount,
		"reviewing_count":       result.ReviewingCount,
		"avg_rebate_per_subscription": result.TotalAmount / float64(max(result.TotalSubscriptions, 1)),
	}, nil
}

// GetTrend 获取趋势数据
func (r *RebateRecordRepository) GetTrend(ctx context.Context, groupBy string, startDate, endDate time.Time, agentID, creatorID uint) ([]map[string]interface{}, error) {
	var results []map[string]interface{}

	var dateFormat string
	switch groupBy {
	case "week":
		dateFormat = "YYYY-IW"
	case "month":
		dateFormat = "YYYY-MM"
	default:
		dateFormat = "YYYY-MM-DD"
	}

	dateExpr := "TO_CHAR(created_at, '" + dateFormat + "')"
	query := r.db.WithContext(ctx).Model(&model.RebateRecord{}).
		Select(
			dateExpr+" as date",
			"COALESCE(SUM(amount), 0) as rebate_amount",
			"COUNT(*) as subscription_count",
			"SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) as blocked_count",
		).
		Where("created_at >= ? AND created_at <= ?", startDate, endDate).
		Group(dateExpr).
		Order("date")

	if agentID > 0 {
		query = query.Where("agent_id = ?", agentID)
	}
	if creatorID > 0 {
		query = query.Where("creator_id = ?", creatorID)
	}

	err := query.Scan(&results).Error
	return results, err
}

// GetCreatorRanking 获取创作者排名
func (r *RebateRecordRepository) GetCreatorRanking(ctx context.Context, startDate, endDate time.Time, page, pageSize int) ([]map[string]interface{}, int64, error) {
	var results []map[string]interface{}
	var total int64

	countQuery := r.db.WithContext(ctx).Model(&model.RebateRecord{}).
		Select("creator_id").
		Where("created_at >= ? AND created_at <= ?", startDate, endDate).
		Group("creator_id")

	err := countQuery.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	err = r.db.WithContext(ctx).Model(&model.RebateRecord{}).
		Select(
			"creator_id",
			"COALESCE(SUM(amount), 0) as total_amount",
			"COUNT(*) as subscription_count",
			"COUNT(DISTINCT agent_id) as agent_count",
		).
		Where("created_at >= ? AND created_at <= ?", startDate, endDate).
		Group("creator_id").
		Order("total_amount DESC").
		Offset(offset).Limit(pageSize).
		Scan(&results).Error

	return results, total, err
}

// GetAgentStats 获取Agent统计
func (r *RebateRecordRepository) GetAgentStats(ctx context.Context, startDate, endDate time.Time, creatorID uint, page, pageSize int) ([]map[string]interface{}, int64, error) {
	var results []map[string]interface{}
	var total int64

	query := r.db.WithContext(ctx).Model(&model.RebateRecord{}).
		Select(
			"agent_id",
			"COALESCE(SUM(amount), 0) as total_amount",
			"COUNT(*) as subscription_count",
		).
		Where("created_at >= ? AND created_at <= ?", startDate, endDate)

	if creatorID > 0 {
		query = query.Where("creator_id = ?", creatorID)
	}

	countQuery := query.Group("agent_id")
	err := countQuery.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	err = query.Group("agent_id").
		Order("total_amount DESC").
		Offset(offset).Limit(pageSize).
		Scan(&results).Error

	return results, total, err
}

func max(a, b int64) int64 {
	if a > b {
		return a
	}
	return b
}
