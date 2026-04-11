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
