package repository

import (
	"context"

	"gorm.io/gorm"

	"github.com/maneki/api/internal/model"
)

// NotificationRepository 通知数据访问层
type NotificationRepository struct {
	db *gorm.DB
}

// NewNotificationRepository 创建通知仓库
func NewNotificationRepository(db *gorm.DB) *NotificationRepository {
	return &NotificationRepository{db: db}
}

// ListNotificationQuery 通知列表查询参数
type ListNotificationQuery struct {
	Page       int
	PageSize   int
	UnreadOnly bool
}

// ListNotificationResult 通知列表查询结果
type ListNotificationResult struct {
	Data     []model.Notification
	Total    int64
	Page     int
	PageSize int
}

// List 获取通知列表
func (r *NotificationRepository) List(ctx context.Context, query ListNotificationQuery) (*ListNotificationResult, error) {
	db := r.db.WithContext(ctx).Model(&model.Notification{})

	if query.UnreadOnly {
		db = db.Where("is_read = ?", false)
	}

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, err
	}

	var data []model.Notification
	offset := (query.Page - 1) * query.PageSize
	if err := db.Order("created_at DESC").
		Offset(offset).
		Limit(query.PageSize).
		Find(&data).Error; err != nil {
		return nil, err
	}

	return &ListNotificationResult{
		Data:     data,
		Total:    total,
		Page:     query.Page,
		PageSize: query.PageSize,
	}, nil
}

// GetByID 根据ID获取通知
func (r *NotificationRepository) GetByID(ctx context.Context, id uint) (*model.Notification, error) {
	var data model.Notification
	if err := r.db.WithContext(ctx).First(&data, id).Error; err != nil {
		return nil, err
	}
	return &data, nil
}

// Create 创建通知
func (r *NotificationRepository) Create(ctx context.Context, data *model.Notification) error {
	return r.db.WithContext(ctx).Create(data).Error
}

// MarkRead 标记单条已读
func (r *NotificationRepository) MarkRead(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Model(&model.Notification{}).
		Where("id = ?", id).
		Update("is_read", true).Error
}

// MarkAllRead 标记全部已读
func (r *NotificationRepository) MarkAllRead(ctx context.Context) error {
	return r.db.WithContext(ctx).Model(&model.Notification{}).
		Where("is_read = ?", false).
		Update("is_read", true).Error
}

// GetUnreadCount 获取未读通知数量
func (r *NotificationRepository) GetUnreadCount(ctx context.Context) (int64, error) {
	var count int64
	if err := r.db.WithContext(ctx).Model(&model.Notification{}).
		Where("is_read = ?", false).
		Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}
