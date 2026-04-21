package repository

import (
	"context"

	"github.com/maneki/api/internal/model"
	"gorm.io/gorm"
)

// UserLevelRepository 用户等级字典数据访问层
type UserLevelRepository struct {
	db *gorm.DB
}

// NewUserLevelRepository 创建用户等级字典仓库
func NewUserLevelRepository(db *gorm.DB) *UserLevelRepository {
	return &UserLevelRepository{db: db}
}

// ListAll 获取所有等级（按 sort_order 排序）
func (r *UserLevelRepository) ListAll(ctx context.Context) ([]model.UserLevel, error) {
	var levels []model.UserLevel
	err := r.db.WithContext(ctx).Order("sort_order ASC, id ASC").Find(&levels).Error
	return levels, err
}

// ListActive 获取所有启用的等级
func (r *UserLevelRepository) ListActive(ctx context.Context) ([]model.UserLevel, error) {
	var levels []model.UserLevel
	err := r.db.WithContext(ctx).Where("is_active = ?", true).Order("sort_order ASC, id ASC").Find(&levels).Error
	return levels, err
}

// GetByValue 根据 level_value 获取等级
func (r *UserLevelRepository) GetByValue(ctx context.Context, value int) (*model.UserLevel, error) {
	var level model.UserLevel
	err := r.db.WithContext(ctx).Where("level_value = ?", value).First(&level).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &level, nil
}
