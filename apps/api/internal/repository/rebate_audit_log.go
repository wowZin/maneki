package repository

import (
	"context"

	"github.com/maneki/api/internal/model"
	"gorm.io/gorm"
)

// RebateAuditLogRepository 返佣审核日志数据访问层
type RebateAuditLogRepository struct {
	db *gorm.DB
}

// NewRebateAuditLogRepository 创建返佣审核日志仓库
func NewRebateAuditLogRepository(db *gorm.DB) *RebateAuditLogRepository {
	return &RebateAuditLogRepository{db: db}
}

// Create 创建审核日志
func (r *RebateAuditLogRepository) Create(ctx context.Context, log *model.RebateAuditLog) error {
	return r.db.WithContext(ctx).Create(log).Error
}

// ListByRecordID 根据返佣记录ID获取审核日志
func (r *RebateAuditLogRepository) ListByRecordID(ctx context.Context, rebateRecordID uint) ([]*model.RebateAuditLog, error) {
	var logs []*model.RebateAuditLog
	err := r.db.WithContext(ctx).
		Where("rebate_record_id = ?", rebateRecordID).
		Order("created_at DESC").
		Find(&logs).Error
	return logs, err
}
