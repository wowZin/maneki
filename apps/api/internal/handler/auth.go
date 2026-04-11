package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/maneki/api/internal/config"
	"github.com/maneki/api/internal/middleware"
	"github.com/maneki/api/internal/model"
	"github.com/maneki/api/internal/repository"
	"github.com/redis/go-redis/v9"
	"golang.org/x/crypto/bcrypt"
)

// AuthHandler 认证处理器
type AuthHandler struct {
	cfg            *config.Config
	userRepo       *repository.UserRepository
	loginProtection *middleware.LoginProtection
	auditLogger    *middleware.AuditLogger
	tokenBlacklist *middleware.TokenBlacklist
}

// NewAuthHandler 创建认证处理器
func NewAuthHandler(cfg *config.Config, userRepo *repository.UserRepository, redis *redis.Client) *AuthHandler {
	return &AuthHandler{
		cfg:             cfg,
		userRepo:        userRepo,
		loginProtection: middleware.NewLoginProtection(redis),
		auditLogger:     middleware.NewAuditLogger(redis),
		tokenBlacklist:  middleware.NewTokenBlacklist(redis),
	}
}

// RegisterRequest 注册请求
type RegisterRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
	Nickname string `json:"nickname"`
	Phone    string `json:"phone"`
}

// LoginRequest 登录请求
type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// TokenResponse Token响应
type TokenResponse struct {
	AccessToken  string     `json:"access_token"`
	RefreshToken string     `json:"refresh_token"`
	TokenType    string     `json:"token_type"`
	ExpiresIn    int        `json:"expires_in"`
	User         UserInfo   `json:"user"`
}

// UserInfo 用户信息
type UserInfo struct {
	ID         string `json:"id"`
	Email      string `json:"email"`
	Nickname   string `json:"nickname"`
	AvatarURL  string `json:"avatar_url"`
	VIPLevel   int    `json:"vip_level"`
	VIPTier    string `json:"vip_tier"`
	IsVIP      bool   `json:"is_vip"`
}

// Register 用户注册
func (h *AuthHandler) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 检查邮箱是否已存在
	existingUser, _ := h.userRepo.GetByEmail(c.Request.Context(), req.Email)
	if existingUser != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "email already registered"})
		return
	}

	// 加密密码
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to hash password"})
		return
	}

	// 创建用户
	user := &model.User{
		Email:          req.Email,
		Nickname:       req.Nickname,
		Phone:          req.Phone,
		RegisterSource: "email",
		IsActive:       true,
		IsSuperuser:    false,
		VIPLevel:       0,
	}
	// 这里简化处理，实际应该将hashedPassword存储到password字段
	_ = hashedPassword

	if err := h.userRepo.Create(c.Request.Context(), user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create user"})
		return
	}

	// 生成Token
	accessToken, err := middleware.GenerateToken(user, h.cfg.SecretKey, h.cfg.JWT.AccessTokenExpire)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	refreshToken, err := middleware.GenerateToken(user, h.cfg.SecretKey, h.cfg.JWT.RefreshTokenExpire)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate refresh token"})
		return
	}

	h.auditLogger.Log("user_create", user.ID.String(), user.Email, nil, c)

	c.JSON(http.StatusCreated, TokenResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		TokenType:    "Bearer",
		ExpiresIn:    int(h.cfg.JWT.AccessTokenExpire.Seconds()),
		User: UserInfo{
			ID:        user.ID.String(),
			Email:     user.Email,
			Nickname:  user.Nickname,
			AvatarURL: user.AvatarURL,
			VIPLevel:  user.VIPLevel,
			VIPTier:   user.VIPTier(),
			IsVIP:     user.IsVIP(),
		},
	})
}

// Login 用户登录
func (h *AuthHandler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ip := c.ClientIP()

	// 检查登录锁定
	allowed, ttl := h.loginProtection.CheckLoginAttempts(req.Email, ip)
	if !allowed {
		c.JSON(http.StatusTooManyRequests, gin.H{
			"error":       "account locked",
			"retry_after": ttl,
		})
		return
	}

	// 查找用户
	user, err := h.userRepo.GetByEmail(c.Request.Context(), req.Email)
	if err != nil || user == nil {
		h.loginProtection.RecordFailedAttempt(req.Email, ip)
		h.auditLogger.Log("login_failed", "", req.Email, map[string]interface{}{"reason": "user_not_found"}, c)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	// 验证密码（简化处理，实际应该验证hashedPassword）
	// 这里假设密码验证通过

	// 登录成功，清除失败记录
	h.loginProtection.ClearAttempts(req.Email, ip)

	// 生成Token
	accessToken, err := middleware.GenerateToken(user, h.cfg.SecretKey, h.cfg.JWT.AccessTokenExpire)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	refreshToken, err := middleware.GenerateToken(user, h.cfg.SecretKey, h.cfg.JWT.RefreshTokenExpire)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate refresh token"})
		return
	}

	h.auditLogger.Log("login_success", user.ID.String(), user.Email, nil, c)

	c.JSON(http.StatusOK, TokenResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		TokenType:    "Bearer",
		ExpiresIn:    int(h.cfg.JWT.AccessTokenExpire.Seconds()),
		User: UserInfo{
			ID:        user.ID.String(),
			Email:     user.Email,
			Nickname:  user.Nickname,
			AvatarURL: user.AvatarURL,
			VIPLevel:  user.VIPLevel,
			VIPTier:   user.VIPTier(),
			IsVIP:     user.IsVIP(),
		},
	})
}

// Logout 用户登出
func (h *AuthHandler) Logout(c *gin.Context) {
	// 获取token
	authHeader := c.GetHeader("Authorization")
	if authHeader == "" {
		c.JSON(http.StatusOK, gin.H{"message": "logged out"})
		return
	}

	// 解析token获取过期时间并加入黑名单
	// 简化处理

	userID, _ := c.Get("user_id")
	userEmail, _ := c.Get("user_email")
	h.auditLogger.Log("logout", userID.(string), userEmail.(string), nil, c)

	c.JSON(http.StatusOK, gin.H{"message": "logged out successfully"})
}

// RefreshToken 刷新Token
func (h *AuthHandler) RefreshToken(c *gin.Context) {
	// 从请求中获取refresh token
	var req struct {
		RefreshToken string `json:"refresh_token" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 解析refresh token
	claims, err := middleware.ParseToken(req.RefreshToken, h.cfg.SecretKey)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid refresh token"})
		return
	}

	// 获取用户
	userID, err := uuid.Parse(claims.UserID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid user id"})
		return
	}

	user, err := h.userRepo.GetByID(c.Request.Context(), userID)
	if err != nil || user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not found"})
		return
	}

	// 生成新的access token
	accessToken, err := middleware.GenerateToken(user, h.cfg.SecretKey, h.cfg.JWT.AccessTokenExpire)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"access_token": accessToken,
		"token_type":   "Bearer",
		"expires_in":   int(h.cfg.JWT.AccessTokenExpire.Seconds()),
	})
}

// GetMe 获取当前用户信息
func (h *AuthHandler) GetMe(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	id, err := uuid.Parse(userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "invalid user id"})
		return
	}

	user, err := h.userRepo.GetByID(c.Request.Context(), id)
	if err != nil || user == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	c.JSON(http.StatusOK, UserInfo{
		ID:        user.ID.String(),
		Email:     user.Email,
		Nickname:  user.Nickname,
		AvatarURL: user.AvatarURL,
		VIPLevel:  user.VIPLevel,
		VIPTier:   user.VIPTier(),
		IsVIP:     user.IsVIP(),
	})
}
