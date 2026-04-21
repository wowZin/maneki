package service

import (
	"context"
	"fmt"
	"math/rand"
	"time"

	"github.com/maneki/api/internal/config"
	"github.com/maneki/api/internal/model"
	"github.com/maneki/api/internal/repository"
	"github.com/maneki/api/pkg/jwtutil"
	"github.com/redis/go-redis/v9"
	"golang.org/x/crypto/bcrypt"
)

// AdminAuthService 管理员认证服务
type AdminAuthService struct {
	cfg        *config.Config
	adminRepo  *repository.AdminRepository
	redis      *redis.Client
}

// NewAdminAuthService 创建管理员认证服务
func NewAdminAuthService(cfg *config.Config, adminRepo *repository.AdminRepository, redis *redis.Client) *AdminAuthService {
	return &AdminAuthService{
		cfg:       cfg,
		adminRepo: adminRepo,
		redis:     redis,
	}
}

// AdminLoginResult 管理员登录结果
type AdminLoginResult struct {
	Token               string      `json:"token"`
	Admin               *model.Admin `json:"admin"`
	ForceChangePassword bool        `json:"force_change_password"`
}

// Login 管理员登录
func (s *AdminAuthService) Login(ctx context.Context, name, password string) (*AdminLoginResult, error) {
	// 查找管理员
	admin, err := s.adminRepo.GetByName(ctx, name)
	if err != nil {
		return nil, fmt.Errorf("failed to find admin: %w", err)
	}
	if admin == nil {
		return nil, fmt.Errorf("invalid credentials")
	}

	// 检查是否被禁用
	if !admin.IsActive {
		return nil, fmt.Errorf("account disabled")
	}

	// 验证密码
	if err := bcrypt.CompareHashAndPassword([]byte(admin.PasswordHash), []byte(password)); err != nil {
		return nil, fmt.Errorf("invalid credentials")
	}

	// 生成JWT token（30分钟有效期）
	token, jti, err := jwtutil.GenerateAdminToken(admin.ID, admin.Name, string(admin.Role), s.cfg.SecretKey, 30*time.Minute)
	if err != nil {
		return nil, fmt.Errorf("failed to generate token: %w", err)
	}

	// 记录活跃会话 jti
	if s.redis != nil && jti != "" {
		sessionKey := fmt.Sprintf("admin:session:%d", admin.ID)
		_ = s.redis.Set(ctx, sessionKey, jti, 30*time.Minute).Err()
	}

	// 更新最后登录时间
	now := time.Now()
	admin.LastLoginAt = &now
	_ = s.adminRepo.Update(ctx, admin)

	return &AdminLoginResult{
		Token:               token,
		Admin:               admin,
		ForceChangePassword: admin.ForceChangePassword,
	}, nil
}

// Logout 管理员登出
func (s *AdminAuthService) Logout(ctx context.Context, jti string, expireAt time.Time) error {
	if s.redis == nil || jti == "" {
		return nil
	}
	key := fmt.Sprintf("jwt:blacklist:%s", jti)
	ttl := time.Until(expireAt)
	if ttl <= 0 {
		ttl = 1 * time.Second
	}
	return s.redis.Set(ctx, key, "1", ttl).Err()
}

// ChangePassword 修改密码
func (s *AdminAuthService) ChangePassword(ctx context.Context, adminID uint64, oldPassword, newPassword string) error {
	admin, err := s.adminRepo.GetByID(ctx, adminID)
	if err != nil {
		return fmt.Errorf("failed to find admin: %w", err)
	}
	if admin == nil {
		return fmt.Errorf("admin not found")
	}

	// 验证旧密码
	if err := bcrypt.CompareHashAndPassword([]byte(admin.PasswordHash), []byte(oldPassword)); err != nil {
		return fmt.Errorf("old password incorrect")
	}

	// 加密新密码
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	admin.PasswordHash = string(hashedPassword)
	admin.ForceChangePassword = false
	return s.adminRepo.Update(ctx, admin)
}

// GetAdminByID 根据ID获取管理员
func (s *AdminAuthService) GetAdminByID(ctx context.Context, adminID uint64) (*model.Admin, error) {
	return s.adminRepo.GetByID(ctx, adminID)
}

// GenerateRandomPassword 生成随机密码
func GenerateRandomPassword(length int) string {
	if length < 8 {
		length = 8
	}
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"
	b := make([]byte, length)
	for i := range b {
		b[i] = charset[rand.Intn(len(charset))]
	}
	return string(b)
}
