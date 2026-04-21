package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/maneki/api/internal/model"
	"gorm.io/gorm"
)

// AdminRepository 管理员数据访问层
type AdminRepository struct {
	db *gorm.DB
}

// NewAdminRepository 创建管理员仓库
func NewAdminRepository(db *gorm.DB) *AdminRepository {
	return &AdminRepository{db: db}
}

// Create 创建管理员
func (r *AdminRepository) Create(ctx context.Context, admin *model.Admin) error {
	return r.db.WithContext(ctx).Create(admin).Error
}

// GetByID 根据ID获取管理员
func (r *AdminRepository) GetByID(ctx context.Context, id uint64) (*model.Admin, error) {
	var admin model.Admin
	err := r.db.WithContext(ctx).First(&admin, "id = ?", id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &admin, nil
}

// GetByName 根据账户名称获取管理员
func (r *AdminRepository) GetByName(ctx context.Context, name string) (*model.Admin, error) {
	var admin model.Admin
	err := r.db.WithContext(ctx).First(&admin, "name = ?", name).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &admin, nil
}

// Update 更新管理员
func (r *AdminRepository) Update(ctx context.Context, admin *model.Admin) error {
	return r.db.WithContext(ctx).Save(admin).Error
}

// List 获取管理员列表（分页）
func (r *AdminRepository) List(ctx context.Context, page, pageSize int) ([]*model.Admin, int64, error) {
	var admins []*model.Admin
	var total int64

	offset := (page - 1) * pageSize

	err := r.db.WithContext(ctx).Model(&model.Admin{}).Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	err = r.db.WithContext(ctx).Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&admins).Error
	return admins, total, err
}

// Search 搜索管理员
func (r *AdminRepository) Search(ctx context.Context, keyword string, page, pageSize int) ([]*model.Admin, int64, error) {
	var admins []*model.Admin
	var total int64

	query := r.db.WithContext(ctx).Model(&model.Admin{})
	if keyword != "" {
		likeKeyword := fmt.Sprintf("%%%s%%", keyword)
		query = query.Where("name LIKE ?", likeKeyword)
	}

	err := query.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	err = query.Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&admins).Error
	return admins, total, err
}

// CountActiveSuperAdmins 统计活跃超级管理员数量
func (r *AdminRepository) CountActiveSuperAdmins(ctx context.Context) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&model.Admin{}).
		Where("role = ? AND is_active = ?", model.AdminRoleSuper, true).
		Count(&count).Error
	return count, err
}

// NameExists 检查账户名称是否已存在
func (r *AdminRepository) NameExists(ctx context.Context, name string) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&model.Admin{}).Where("name = ?", name).Count(&count).Error
	return count > 0, err
}
