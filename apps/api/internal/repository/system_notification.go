package repository

import (
	"context"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"

	"github.com/maneki/api/internal/model"
)

// SystemNotificationRepository 系统通知数据访问层
type SystemNotificationRepository struct {
	db *gorm.DB
}

// NewSystemNotificationRepository 创建系统通知仓库
func NewSystemNotificationRepository(db *gorm.DB) *SystemNotificationRepository {
	return &SystemNotificationRepository{db: db}
}

// AdminListQuery 管理端列表查询参数
type AdminListQuery struct {
	Page     int
	PageSize int
	Status   string // pending, active, expired, disabled
	Keyword  string
}

// AdminListResult 管理端列表查询结果
type AdminListResult struct {
	Data     []model.SystemNotification
	Total    int64
	Page     int
	PageSize int
}

// UserListQuery 用户端列表查询参数
type UserListQuery struct {
	Page         int
	PageSize     int
	UserVIPLevel int
}

// UserListResult 用户端列表查询结果
type UserListResult struct {
	Urgent []model.SystemNotification
	Normal []model.SystemNotification
}

// Create 创建通知
func (r *SystemNotificationRepository) Create(ctx context.Context, data *model.SystemNotification) error {
	return r.db.WithContext(ctx).Create(data).Error
}

// GetByID 根据ID获取通知
func (r *SystemNotificationRepository) GetByID(ctx context.Context, id uint) (*model.SystemNotification, error) {
	var data model.SystemNotification
	if err := r.db.WithContext(ctx).First(&data, id).Error; err != nil {
		return nil, err
	}
	return &data, nil
}

// Update 更新通知
func (r *SystemNotificationRepository) Update(ctx context.Context, id uint, updates map[string]interface{}) error {
	return r.db.WithContext(ctx).Model(&model.SystemNotification{}).Where("id = ?", id).Updates(updates).Error
}

// Disable 将通知标记为已失效
func (r *SystemNotificationRepository) Disable(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Model(&model.SystemNotification{}).Where("id = ?", id).Update("is_disabled", true).Error
}

// Duplicate 复制一条通知
func (r *SystemNotificationRepository) Duplicate(ctx context.Context, id uint) (*model.SystemNotification, error) {
	src, err := r.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	copy := &model.SystemNotification{
		Title:           src.Title + "（副本）",
		Content:         src.Content,
		Priority:        src.Priority,
		StartTime:       src.StartTime,
		EndTime:         src.EndTime,
		MinVisibleLevel: src.MinVisibleLevel,
		IsDisabled:      false,
	}

	if err := r.db.WithContext(ctx).Create(copy).Error; err != nil {
		return nil, err
	}
	return copy, nil
}

// AdminList 管理端通知列表（支持分页、状态筛选、关键词搜索）
func (r *SystemNotificationRepository) AdminList(ctx context.Context, query AdminListQuery) (*AdminListResult, error) {
	db := r.db.WithContext(ctx).Model(&model.SystemNotification{})

	// 关键词搜索（标题）
	if strings.TrimSpace(query.Keyword) != "" {
		db = db.Where("title ILIKE ?", "%"+query.Keyword+"%")
	}

	// 状态筛选
	if query.Status != "" {
		db = r.applyStatusFilter(db, query.Status)
	}

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, err
	}

	var data []model.SystemNotification
	offset := (query.Page - 1) * query.PageSize
	if err := db.Order("created_at DESC").
		Offset(offset).
		Limit(query.PageSize).
		Find(&data).Error; err != nil {
		return nil, err
	}

	return &AdminListResult{
		Data:     data,
		Total:    total,
		Page:     query.Page,
		PageSize: query.PageSize,
	}, nil
}

// UserListActive 用户端获取对其可见的生效通知
func (r *SystemNotificationRepository) UserListActive(ctx context.Context, query UserListQuery) (*UserListResult, error) {
	now := time.Now()

	var notifications []model.SystemNotification
	err := r.db.WithContext(ctx).
		Where("is_disabled = ?", false).
		Where("start_time <= ?", now).
		Where("(end_time IS NULL OR end_time >= ?)", now).
		Where("min_visible_level <= ?", query.UserVIPLevel).
		Order("priority DESC, created_at DESC").
		Find(&notifications).Error
	if err != nil {
		return nil, err
	}

	result := &UserListResult{}
	for _, n := range notifications {
		if n.Priority == 2 {
			result.Urgent = append(result.Urgent, n)
		} else {
			result.Normal = append(result.Normal, n)
		}
	}
	return result, nil
}

// applyStatusFilter 应用状态筛选条件
func (r *SystemNotificationRepository) applyStatusFilter(db *gorm.DB, status string) *gorm.DB {
	now := time.Now()
	switch status {
	case "disabled":
		return db.Where("is_disabled = ?", true)
	case "pending":
		return db.Where("is_disabled = ? AND start_time > ?", false, now)
	case "active":
		return db.Where("is_disabled = ? AND start_time <= ? AND (end_time IS NULL OR end_time >= ?)", false, now, now)
	case "expired":
		return db.Where("is_disabled = ? AND end_time IS NOT NULL AND end_time < ?", false, now)
	default:
		return db
	}
}

// ValidateTimeRange 校验结束时间是否严格晚于开始时间
func ValidateTimeRange(startTime time.Time, endTime *time.Time) error {
	if endTime != nil && !endTime.After(startTime) {
		return fmt.Errorf("结束时间必须严格晚于开始时间")
	}
	return nil
}
