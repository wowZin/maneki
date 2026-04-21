package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/maneki/api/internal/model"
	"gorm.io/gorm"
)

// UserRepository 用户数据访问层
type UserRepository struct {
	db *gorm.DB
}

// NewUserRepository 创建用户仓库
func NewUserRepository(db *gorm.DB) *UserRepository {
	return &UserRepository{db: db}
}

// Create 创建用户
func (r *UserRepository) Create(ctx context.Context, user *model.User) error {
	return r.db.WithContext(ctx).Create(user).Error
}

// GetByID 根据ID获取用户
func (r *UserRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.User, error) {
	var user model.User
	err := r.db.WithContext(ctx).First(&user, "id = ?", id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &user, nil
}

// GetByEmail 根据邮箱获取用户
func (r *UserRepository) GetByEmail(ctx context.Context, email string) (*model.User, error) {
	var user model.User
	err := r.db.WithContext(ctx).First(&user, "email = ?", email).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &user, nil
}

// GetByUsername 根据用户名获取用户
func (r *UserRepository) GetByUsername(ctx context.Context, username string) (*model.User, error) {
	var user model.User
	err := r.db.WithContext(ctx).First(&user, "username = ?", username).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &user, nil
}

// GetByPhone 根据手机号获取用户
func (r *UserRepository) GetByPhone(ctx context.Context, phone string) (*model.User, error) {
	var user model.User
	err := r.db.WithContext(ctx).First(&user, "phone = ?", phone).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &user, nil
}

// GetByWechatUnionID 根据微信UnionID获取用户
func (r *UserRepository) GetByWechatUnionID(ctx context.Context, unionID string) (*model.User, error) {
	var user model.User
	err := r.db.WithContext(ctx).First(&user, "wechat_unionid = ?", unionID).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &user, nil
}

// GetByWechatMiniOpenID 根据微信小程序OpenID获取用户
func (r *UserRepository) GetByWechatMiniOpenID(ctx context.Context, openID string) (*model.User, error) {
	var user model.User
	err := r.db.WithContext(ctx).First(&user, "wechat_mini_openid = ?", openID).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &user, nil
}

// Update 更新用户
func (r *UserRepository) Update(ctx context.Context, user *model.User) error {
	return r.db.WithContext(ctx).Save(user).Error
}

// List 获取用户列表（分页）
func (r *UserRepository) List(ctx context.Context, page, pageSize int) ([]*model.User, int64, error) {
	var users []*model.User
	var total int64

	offset := (page - 1) * pageSize

	err := r.db.WithContext(ctx).Model(&model.User{}).Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	err = r.db.WithContext(ctx).Offset(offset).Limit(pageSize).Find(&users).Error
	return users, total, err
}

// Search 搜索用户
func (r *UserRepository) Search(ctx context.Context, keyword string, page, pageSize int) ([]*model.User, int64, error) {
	var users []*model.User
	var total int64

	query := r.db.WithContext(ctx).Model(&model.User{})
	if keyword != "" {
		likeKeyword := fmt.Sprintf("%%%s%%", keyword)
		query = query.Where("email LIKE ? OR username LIKE ? OR nickname LIKE ? OR phone LIKE ?",
			likeKeyword, likeKeyword, likeKeyword, likeKeyword)
	}

	err := query.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	err = query.Offset(offset).Limit(pageSize).Find(&users).Error
	return users, total, err
}

// Delete 删除用户
func (r *UserRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&model.User{}, "id = ?", id).Error
}

// CountSuperusers 统计超管数量
func (r *UserRepository) CountSuperusers(ctx context.Context) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&model.User{}).Where("is_superuser = ?", true).Count(&count).Error
	return count, err
}

// CountActiveSuperusers 统计活跃超管数量
func (r *UserRepository) CountActiveSuperusers(ctx context.Context) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&model.User{}).
		Where("is_superuser = ? AND is_active = ?", true, true).
		Count(&count).Error
	return count, err
}

// SearchWithFilters 带过滤条件的搜索
func (r *UserRepository) SearchWithFilters(ctx context.Context, keyword string, isSuperuser, isActive *bool, vipLevel *int, vipLevels []int, sortBy, sortOrder string, page, pageSize int) ([]*model.User, int64, error) {
	var users []*model.User
	var total int64

	query := r.db.WithContext(ctx).Model(&model.User{})

	// 关键词搜索
	if keyword != "" {
		likeKeyword := fmt.Sprintf("%%%s%%", keyword)
		query = query.Where("email LIKE ? OR username LIKE ? OR nickname LIKE ? OR phone LIKE ?",
			likeKeyword, likeKeyword, likeKeyword, likeKeyword)
	}

	// 超管筛选
	if isSuperuser != nil {
		query = query.Where("is_superuser = ?", *isSuperuser)
	}

	// 状态筛选
	if isActive != nil {
		query = query.Where("is_active = ?", *isActive)
	}

	// VIP等级筛选（兼容旧版单选）
	if vipLevel != nil {
		query = query.Where("vip_level = ?", *vipLevel)
	}

	// VIP等级多选筛选
	if len(vipLevels) > 0 {
		query = query.Where("vip_level IN ?", vipLevels)
	}

	err := query.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize

	// 动态排序
	orderClause := "created_at DESC"
	if sortBy == "accuracy" {
		if sortOrder == "asc" {
			orderClause = "board_accuracy ASC NULLS LAST"
		} else {
			orderClause = "board_accuracy DESC NULLS LAST"
		}
	} else if sortBy == "created_at" {
		if sortOrder == "asc" {
			orderClause = "created_at ASC"
		} else {
			orderClause = "created_at DESC"
		}
	}

	err = query.Order(orderClause).Offset(offset).Limit(pageSize).Find(&users).Error
	return users, total, err
}

// GetStats 获取用户统计
func (r *UserRepository) GetStats(ctx context.Context) (map[string]interface{}, error) {
	var totalUsers, activeUsers, superusers, vipUsers int64

	r.db.WithContext(ctx).Model(&model.User{}).Count(&totalUsers)
	r.db.WithContext(ctx).Model(&model.User{}).Where("is_active = ?", true).Count(&activeUsers)
	r.db.WithContext(ctx).Model(&model.User{}).Where("is_superuser = ?", true).Count(&superusers)
	r.db.WithContext(ctx).Model(&model.User{}).Where("vip_level > ?", 0).Count(&vipUsers)

	return map[string]interface{}{
		"total_users":   totalUsers,
		"active_users":  activeUsers,
		"superusers":    superusers,
		"vip_users":     vipUsers,
	}, nil
}
