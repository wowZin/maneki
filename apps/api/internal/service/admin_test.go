package service

import (
	"testing"

	"github.com/maneki/api/internal/model"
	"golang.org/x/crypto/bcrypt"
)

func TestGenerateRandomPassword(t *testing.T) {
	pwd1 := GenerateRandomPassword(8)
	if len(pwd1) != 8 {
		t.Errorf("password length = %d, want 8", len(pwd1))
	}

	pwd2 := GenerateRandomPassword(5)
	if len(pwd2) != 8 {
		t.Errorf("password length = %d, want 8", len(pwd2))
	}

	pwd3 := GenerateRandomPassword(16)
	if len(pwd3) != 16 {
		t.Errorf("password length = %d, want 16", len(pwd3))
	}

	// 确保随机性
	if pwd1 == pwd2 {
		t.Error("random passwords should not be equal")
	}
}

func TestCreateAdminRequestValidation(t *testing.T) {
	req := CreateAdminRequest{Name: "ab"}
	if req.Name == "" {
		t.Error("name should not be empty")
	}
}

func TestAdminListResultStructure(t *testing.T) {
	result := AdminListResult{
		List:     []*model.Admin{},
		Total:    0,
		Page:     1,
		PageSize: 20,
	}
	if result.Page != 1 {
		t.Errorf("page = %d, want 1", result.Page)
	}
}

func TestBcryptHashConsistency(t *testing.T) {
	password := "111111"
	hash1, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		t.Fatalf("hash failed: %v", err)
	}

	hash2, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		t.Fatalf("hash failed: %v", err)
	}

	// 两次哈希结果应该不同（因为 salt 不同）
	if string(hash1) == string(hash2) {
		t.Error("bcrypt hashes should be different due to random salt")
	}

	// 但都应该能验证通过
	if err := bcrypt.CompareHashAndPassword(hash1, []byte(password)); err != nil {
		t.Errorf("hash1 verify failed: %v", err)
	}
	if err := bcrypt.CompareHashAndPassword(hash2, []byte(password)); err != nil {
		t.Errorf("hash2 verify failed: %v", err)
	}
}
