package service

import (
	"context"
	"fmt"
	"time"

	"github.com/maneki/api/internal/model"
	"github.com/maneki/api/internal/repository"
	"github.com/redis/go-redis/v9"
	"golang.org/x/crypto/bcrypt"
)

// AdminService 管理员管理服务
type AdminService struct {
	adminRepo *repository.AdminRepository
	redis     *redis.Client
}

// NewAdminService 创建管理员管理服务
func NewAdminService(adminRepo *repository.AdminRepository, redis *redis.Client) *AdminService {
	return &AdminService{
		adminRepo: adminRepo,
		redis:     redis,
	}
}

// CreateAdminRequest 创建管理员请求
type CreateAdminRequest struct {
	Name string `json:"name" binding:"required,min=3,max=64"`
}

// AdminListResult 管理员列表结果
type AdminListResult struct {
	List     []*model.Admin `json:"list"`
	Total    int64          `json:"total"`
	Page     int            `json:"page"`
	PageSize int            `json:"page_size"`
}

// ListAdmins 获取管理员列表
func (s *AdminService) ListAdmins(ctx context.Context, keyword string, page, pageSize int) (*AdminListResult, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	var admins []*model.Admin
	var total int64
	var err error

	if keyword != "" {
		admins, total, err = s.adminRepo.Search(ctx, keyword, page, pageSize)
	} else {
		admins, total, err = s.adminRepo.List(ctx, page, pageSize)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to list admins: %w", err)
	}

	return &AdminListResult{
		List:     admins,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	}, nil
}

// CreateAdmin 创建普通管理员（初始密码 111111）
func (s *AdminService) CreateAdmin(ctx context.Context, name string) (*model.Admin, error) {
	// 验证名称
	admin := &model.Admin{Name: name}
	if !admin.ValidateName() {
		return nil, fmt.Errorf("invalid admin name format")
	}

	// 检查名称是否已存在
	exists, err := s.adminRepo.NameExists(ctx, name)
	if err != nil {
		return nil, fmt.Errorf("failed to check name existence: %w", err)
	}
	if exists {
		return nil, fmt.Errorf("admin name already exists")
	}

	// 加密初始密码 111111
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte("111111"), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	admin.PasswordHash = string(hashedPassword)
	admin.Role = model.AdminRoleAdmin
	admin.IsActive = true
	admin.ForceChangePassword = true

	if err := s.adminRepo.Create(ctx, admin); err != nil {
		return nil, fmt.Errorf("failed to create admin: %w", err)
	}

	return admin, nil
}

// DisableAdmin 禁用管理员
func (s *AdminService) DisableAdmin(ctx context.Context, id uint64) error {
	admin, err := s.adminRepo.GetByID(ctx, id)
	if err != nil {
		return fmt.Errorf("failed to find admin: %w", err)
	}
	if admin == nil {
		return fmt.Errorf("admin not found")
	}

	// 如果是超级管理员，检查是否是最后一个活跃的超级管理员
	if admin.Role == model.AdminRoleSuper {
		count, err := s.adminRepo.CountActiveSuperAdmins(ctx)
		if err != nil {
			return fmt.Errorf("failed to check super admin count: %w", err)
		}
		if count <= 1 {
			return fmt.Errorf("cannot disable the last active super admin")
		}
	}

	// 使该管理员的活跃会话失效
	_ = s.InvalidateAdminSession(ctx, id)

	admin.IsActive = false
	if err := s.adminRepo.Update(ctx, admin); err != nil {
		return fmt.Errorf("failed to disable admin: %w", err)
	}

	return nil
}

// EnableAdmin 启用管理员
func (s *AdminService) EnableAdmin(ctx context.Context, id uint64) error {
	admin, err := s.adminRepo.GetByID(ctx, id)
	if err != nil {
		return fmt.Errorf("failed to find admin: %w", err)
	}
	if admin == nil {
		return fmt.Errorf("admin not found")
	}

	admin.IsActive = true
	if err := s.adminRepo.Update(ctx, admin); err != nil {
		return fmt.Errorf("failed to enable admin: %w", err)
	}

	return nil
}

// InvalidateAdminSession 使管理员会话失效（将当前活跃token加入黑名单）
func (s *AdminService) InvalidateAdminSession(ctx context.Context, adminID uint64) error {
	if s.redis == nil {
		return nil
	}
	sessionKey := fmt.Sprintf("admin:session:%d", adminID)
	jti, err := s.redis.Get(ctx, sessionKey).Result()
	if err != nil {
		return nil // 没有活跃会话
	}
	if jti != "" {
		blacklistKey := fmt.Sprintf("jwt:blacklist:%s", jti)
		_ = s.redis.Set(ctx, blacklistKey, "1", 30*time.Minute).Err()
	}
	_ = s.redis.Del(ctx, sessionKey).Err()
	return nil
}
