package jwtutil

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func TestGenerateAndParseAdminToken(t *testing.T) {
	secret := "test-secret-key"
	tokenStr, jti, err := GenerateAdminToken(1, "admin", "super", secret, 30*time.Minute)
	if err != nil {
		t.Fatalf("generate token failed: %v", err)
	}
	if tokenStr == "" {
		t.Fatal("token should not be empty")
	}
	if jti == "" {
		t.Fatal("jti should not be empty")
	}

	claims, err := ParseAdminToken(tokenStr, secret)
	if err != nil {
		t.Fatalf("parse token failed: %v", err)
	}

	if claims.AdminID != 1 {
		t.Errorf("admin_id = %d, want 1", claims.AdminID)
	}
	if claims.Name != "admin" {
		t.Errorf("name = %s, want admin", claims.Name)
	}
	if claims.Role != "super" {
		t.Errorf("role = %s, want super", claims.Role)
	}
	if claims.JTI != jti {
		t.Errorf("jti mismatch: %s vs %s", claims.JTI, jti)
	}
}

func TestParseAdminTokenExpired(t *testing.T) {
	secret := "test-secret-key"
	tokenStr, _, err := GenerateAdminToken(1, "admin", "super", secret, -1*time.Second)
	if err != nil {
		t.Fatalf("generate token failed: %v", err)
	}

	_, err = ParseAdminToken(tokenStr, secret)
	if err == nil {
		t.Fatal("should fail for expired token")
	}
}

func TestParseAdminTokenInvalidSecret(t *testing.T) {
	secret := "test-secret-key"
	tokenStr, _, err := GenerateAdminToken(1, "admin", "super", secret, 30*time.Minute)
	if err != nil {
		t.Fatalf("generate token failed: %v", err)
	}

	_, err = ParseAdminToken(tokenStr, "wrong-secret")
	if err == nil {
		t.Fatal("should fail for invalid secret")
	}
}

func TestParseAdminTokenInvalidFormat(t *testing.T) {
	_, err := ParseAdminToken("invalid-token", "secret")
	if err == nil {
		t.Fatal("should fail for invalid token format")
	}
}

func TestAdminClaimsRegisteredClaims(t *testing.T) {
	now := time.Now()
	claims := AdminClaims{
		AdminID: 42,
		Name:    "test",
		Role:    "admin",
		JTI:     "jti-123",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(30 * time.Minute)),
			IssuedAt:  jwt.NewNumericDate(now),
			Issuer:    "maneki-admin",
			Subject:   "42",
			ID:        "jti-123",
		},
	}

	if claims.ID != "jti-123" {
		t.Errorf("registered claims id = %s, want jti-123", claims.ID)
	}
	if claims.Subject != "42" {
		t.Errorf("subject = %s, want 42", claims.Subject)
	}
}
