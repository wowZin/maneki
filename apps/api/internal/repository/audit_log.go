package repository

import (
	"context"
	"fmt"

	"github.com/maneki/api/internal/model"
	"gorm.io/gorm"
)

// AuditLogRepository 操作日志数据访问层
type AuditLogRepository struct {
	db *gorm.DB
}

// NewAuditLogRepository 创建操作日志仓库
func NewAuditLogRepository(db *gorm.DB) *AuditLogRepository {
	return &AuditLogRepository{db: db}
}

// Create 创建日志记录
func (r *AuditLogRepository) Create(ctx context.Context, log *model.AuditLog) error {
	return r.db.WithContext(ctx).Create(log).Error
}

// List 获取日志列表（分页）
func (r *AuditLogRepository) List(ctx context.Context, page, pageSize int) ([]*model.AuditLog, int64, error) {
	var logs []*model.AuditLog
	var total int64

	offset := (page - 1) * pageSize

	err := r.db.WithContext(ctx).Model(&model.AuditLog{}).Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	err = r.db.WithContext(ctx).Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&logs).Error
	return logs, total, err
}

// ListWithFilters 带筛选条件的日志列表
func (r *AuditLogRepository) ListWithFilters(ctx context.Context, startDate, endDate, adminName string, action model.AuditAction, page, pageSize int) ([]*model.AuditLog, int64, error) {
	var logs []*model.AuditLog
	var total int64

	query := r.db.WithContext(ctx).Model(&model.AuditLog{})

	if startDate != "" {
		query = query.Where("created_at >= ?", startDate+" 00:00:00")
	}
	if endDate != "" {
		query = query.Where("created_at <= ?", endDate+" 23:59:59")
	}
	if adminName != "" {
		query = query.Where("admin_name = ?", adminName)
	}
	if action != "" {
		query = query.Where("action = ?", action)
	}

	err := query.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	err = query.Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&logs).Error
	return logs, total, err
}

// GetByAdminID 根据管理员ID获取日志
func (r *AuditLogRepository) GetByAdminID(ctx context.Context, adminID uint64, page, pageSize int) ([]*model.AuditLog, int64, error) {
	var logs []*model.AuditLog
	var total int64

	offset := (page - 1) * pageSize

	err := r.db.WithContext(ctx).Model(&model.AuditLog{}).Where("admin_id = ?", adminID).Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	err = r.db.WithContext(ctx).Where("admin_id = ?", adminID).Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&logs).Error
	return logs, total, err
}

// Export 导出日志（不分页，限制最大条数）
func (r *AuditLogRepository) Export(ctx context.Context, startDate, endDate, adminName string, action model.AuditAction, maxRows int) ([]*model.AuditLog, error) {
	var logs []*model.AuditLog

	query := r.db.WithContext(ctx).Model(&model.AuditLog{})

	if startDate != "" {
		query = query.Where("created_at >= ?", startDate+" 00:00:00")
	}
	if endDate != "" {
		query = query.Where("created_at <= ?", endDate+" 23:59:59")
	}
	if adminName != "" {
		query = query.Where("admin_name = ?", adminName)
	}
	if action != "" {
		query = query.Where("action = ?", action)
	}

	if maxRows <= 0 || maxRows > 10000 {
		maxRows = 10000
	}

	err := query.Order("created_at DESC").Limit(maxRows).Find(&logs).Error
	return logs, err
}

// DeleteOldLogs 删除过期日志（由定时任务调用）
func (r *AuditLogRepository) DeleteOldLogs(ctx context.Context, beforeDate string) error {
	return r.db.WithContext(ctx).Where("created_at < ?", beforeDate).Delete(&model.AuditLog{}).Error
}

// FormatDetail 格式化详情为字符串
func FormatDetail(detail interface{}) string {
	if detail == nil {
		return ""
	}
	// 简单实现，实际可以使用 json.Marshal
	return fmt.Sprintf("%v", detail)
}
