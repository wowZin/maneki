package testutil

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/bcrypt"

	"github.com/maneki/api/internal/model"
)

// CreateAdmin 创建测试管理员
func (ts *TestServer) CreateAdmin(t *testing.T, name, password string, role model.AdminRole) *model.Admin {
	t.Helper()

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	require.NoError(t, err)

	admin := &model.Admin{
		Name:         name,
		PasswordHash: string(hash),
		Role:         role,
		IsActive:     true,
	}

	err = ts.DB.WithContext(context.Background()).Create(admin).Error
	require.NoError(t, err)
	return admin
}

// CreateSuperAdmin 创建超级管理员
func (ts *TestServer) CreateSuperAdmin(t *testing.T, name, password string) *model.Admin {
	return ts.CreateAdmin(t, name, password, model.AdminRoleSuper)
}

// CreateUser 创建测试用户
func (ts *TestServer) CreateUser(t *testing.T, phone, password string) *model.User {
	t.Helper()

	var passwordHash string
	if password != "" {
		hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		require.NoError(t, err)
		passwordHash = string(hash)
	}

	user := &model.User{
		Phone:          phone,
		HashedPassword: passwordHash,
		VIPLevel:       0,
		IsActive:       true,
	}

	err := ts.DB.WithContext(context.Background()).Create(user).Error
	require.NoError(t, err)
	return user
}

// CreateVIPUser 创建 VIP 测试用户
func (ts *TestServer) CreateVIPUser(t *testing.T, phone, password string, vipLevel int) *model.User {
	t.Helper()

	user := ts.CreateUser(t, phone, password)
	user.VIPLevel = vipLevel
	user.VIPExpireAt = &[]time.Time{time.Now().AddDate(0, 1, 0)}[0]

	err := ts.DB.WithContext(context.Background()).Save(user).Error
	require.NoError(t, err)
	return user
}
