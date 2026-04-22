package service

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/maneki/api/internal/model"
	"github.com/maneki/api/internal/repository"
	"golang.org/x/crypto/bcrypt"
)

// UserService 用户管理服务
type UserService struct {
	userRepo *repository.UserRepository
}

// NewUserService 创建用户管理服务
func NewUserService(userRepo *repository.UserRepository) *UserService {
	return &UserService{userRepo: userRepo}
}

// UserListResult 用户列表结果
type UserListResult struct {
	List     []*model.User `json:"list"`
	Total    int64         `json:"total"`
	Page     int           `json:"page"`
	PageSize int           `json:"page_size"`
}

// ListUsers 获取用户列表
func (s *UserService) ListUsers(ctx context.Context, search string, isSuperuser, isActive *bool, vipLevel *int, vipLevels []int, sortBy, sortOrder string, page, pageSize int) (*UserListResult, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	var users []*model.User
	var total int64
	var err error

	if search != "" || isSuperuser != nil || isActive != nil || vipLevel != nil || len(vipLevels) > 0 || sortBy != "" {
		users, total, err = s.userRepo.SearchWithFilters(ctx, search, isSuperuser, isActive, vipLevel, vipLevels, sortBy, sortOrder, page, pageSize)
	} else {
		users, total, err = s.userRepo.List(ctx, page, pageSize)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to list users: %w", err)
	}

	return &UserListResult{
		List:     users,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	}, nil
}

// GetUser 获取单个用户
func (s *UserService) GetUser(ctx context.Context, id uuid.UUID) (*model.User, error) {
	user, err := s.userRepo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch user: %w", err)
	}
	if user == nil {
		return nil, fmt.Errorf("user not found")
	}
	return user, nil
}

// CreateUserRequest 创建用户请求
type CreateUserRequest struct {
	Email       string
	Username    string
	Password    string
	Nickname    string
	Phone       string
	IsSuperuser bool
	IsActive    bool
}

// CreateUser 创建用户
func (s *UserService) CreateUser(ctx context.Context, req *CreateUserRequest) (*model.User, error) {
	// 检查邮箱是否已存在
	existingUser, _ := s.userRepo.GetByEmail(ctx, req.Email)
	if existingUser != nil {
		return nil, fmt.Errorf("email already exists")
	}

	// 检查用户名是否已存在
	existingUser, _ = s.userRepo.GetByUsername(ctx, req.Username)
	if existingUser != nil {
		return nil, fmt.Errorf("username already exists")
	}

	// 加密密码
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	user := &model.User{
		Email:          req.Email,
		Username:       req.Username,
		Nickname:       req.Nickname,
		Phone:          req.Phone,
		HashedPassword: string(hashedPassword),
		IsActive:       req.IsActive,
		IsSuperuser:    req.IsSuperuser,
		IsVerified:     true,
		RegisterSource: "admin",
		VIPLevel:       0,
	}

	if err := s.userRepo.Create(ctx, user); err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	return user, nil
}

// UpdateUserRequest 更新用户请求
type UpdateUserRequest struct {
	Email       string
	Username    string
	Nickname    string
	Phone       string
	IsSuperuser *bool
	IsActive    *bool
}

// UpdateUser 更新用户信息
func (s *UserService) UpdateUser(ctx context.Context, id uuid.UUID, req *UpdateUserRequest) (*model.User, error) {
	user, err := s.userRepo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch user: %w", err)
	}
	if user == nil {
		return nil, fmt.Errorf("user not found")
	}

	// 检查是否尝试修改最后一个超管
	if req.IsSuperuser != nil && !*req.IsSuperuser && user.IsSuperuser {
		count, err := s.userRepo.CountSuperusers(ctx)
		if err != nil {
			return nil, fmt.Errorf("failed to check superuser count: %w", err)
		}
		if count <= 1 {
			return nil, fmt.Errorf("cannot remove the last superuser")
		}
	}

	// 如果修改邮箱，检查是否已存在
	if req.Email != "" && req.Email != user.Email {
		existingUser, _ := s.userRepo.GetByEmail(ctx, req.Email)
		if existingUser != nil {
			return nil, fmt.Errorf("email already exists")
		}
		user.Email = req.Email
	}

	// 如果修改用户名，检查是否已存在
	if req.Username != "" && req.Username != user.Username {
		existingUser, _ := s.userRepo.GetByUsername(ctx, req.Username)
		if existingUser != nil {
			return nil, fmt.Errorf("username already exists")
		}
		user.Username = req.Username
	}

	if req.Nickname != "" {
		user.Nickname = req.Nickname
	}
	if req.Phone != "" {
		user.Phone = req.Phone
	}
	if req.IsSuperuser != nil {
		user.IsSuperuser = *req.IsSuperuser
	}
	if req.IsActive != nil {
		user.IsActive = *req.IsActive
	}

	if err := s.userRepo.Update(ctx, user); err != nil {
		return nil, fmt.Errorf("failed to update user: %w", err)
	}

	return user, nil
}

// DeleteUser 删除用户
func (s *UserService) DeleteUser(ctx context.Context, id uuid.UUID) error {
	user, err := s.userRepo.GetByID(ctx, id)
	if err != nil {
		return fmt.Errorf("failed to fetch user: %w", err)
	}
	if user == nil {
		return fmt.Errorf("user not found")
	}

	// 如果是超管，检查是否是最后一个
	if user.IsSuperuser {
		count, err := s.userRepo.CountSuperusers(ctx)
		if err != nil {
			return fmt.Errorf("failed to check superuser count: %w", err)
		}
		if count <= 1 {
			return fmt.Errorf("cannot delete the last superuser")
		}
	}

	if err := s.userRepo.Delete(ctx, id); err != nil {
		return fmt.Errorf("failed to delete user: %w", err)
	}

	return nil
}

// ResetPassword 重置用户密码
func (s *UserService) ResetPassword(ctx context.Context, id uuid.UUID, newPassword string) error {
	user, err := s.userRepo.GetByID(ctx, id)
	if err != nil {
		return fmt.Errorf("failed to fetch user: %w", err)
	}
	if user == nil {
		return fmt.Errorf("user not found")
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	user.HashedPassword = string(hashedPassword)
	if err := s.userRepo.Update(ctx, user); err != nil {
		return fmt.Errorf("failed to reset password: %w", err)
	}

	return nil
}

// ToggleUserStatus 切换用户启用/禁用状态
func (s *UserService) ToggleUserStatus(ctx context.Context, id uuid.UUID, enable bool) (*model.User, error) {
	user, err := s.userRepo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch user: %w", err)
	}
	if user == nil {
		return nil, fmt.Errorf("user not found")
	}

	// 如果是超管，检查是否是最后一个活跃的超管
	if user.IsSuperuser && !enable {
		activeCount, err := s.userRepo.CountActiveSuperusers(ctx)
		if err != nil {
			return nil, fmt.Errorf("failed to check active superuser count: %w", err)
		}
		if activeCount <= 1 {
			return nil, fmt.Errorf("cannot disable the last active superuser")
		}
	}

	user.IsActive = enable
	if err := s.userRepo.Update(ctx, user); err != nil {
		return nil, fmt.Errorf("failed to update user status: %w", err)
	}

	return user, nil
}

// GetUserStats 获取用户统计
func (s *UserService) GetUserStats(ctx context.Context) (map[string]interface{}, error) {
	return s.userRepo.GetStats(ctx)
}

// UpdateUserRaw 直接更新用户模型（用于内部字段更新，如头像、密码）
func (s *UserService) UpdateUserRaw(ctx context.Context, user *model.User) error {
	if err := s.userRepo.Update(ctx, user); err != nil {
		return fmt.Errorf("failed to update user: %w", err)
	}
	return nil
}
