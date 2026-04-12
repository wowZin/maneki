package handler

import (
	"fmt"
	"net/http"
	"strings"

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

// LoginRequest 登录请求（支持 username 或 email）
type LoginRequest struct {
	Username string `json:"username"` // 用户名
	Email    string `json:"email"`    // 邮箱（username 和 email 二选一）
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
	ID          string `json:"id"`
	Email       string `json:"email"`
	Username    string `json:"username"`
	Nickname    string `json:"nickname"`
	AvatarURL   string `json:"avatar_url"`
	VIPLevel    int    `json:"vip_level"`
	VIPTier     string `json:"vip_tier"`
	IsVIP       bool   `json:"is_vip"`
	IsSuperuser bool   `json:"is_superuser"`
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
		HashedPassword: string(hashedPassword),
		RegisterSource: "email",
		IsActive:       true,
		IsSuperuser:    false,
		VIPLevel:       0,
	}

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

	// 设置 httpOnly Cookie
	h.setTokenCookie(c, "access_token", accessToken, int(h.cfg.JWT.AccessTokenExpire.Seconds()))
	h.setTokenCookie(c, "refresh_token", refreshToken, int(h.cfg.JWT.RefreshTokenExpire.Seconds()))

	c.JSON(http.StatusCreated, TokenResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		TokenType:    "Bearer",
		ExpiresIn:    int(h.cfg.JWT.AccessTokenExpire.Seconds()),
		User: UserInfo{
			ID:          user.ID.String(),
			Email:       user.Email,
			Username:    user.Username,
			Nickname:    user.Nickname,
			AvatarURL:   user.AvatarURL,
			VIPLevel:    user.VIPLevel,
			VIPTier:     user.VIPTier(),
			IsVIP:       user.IsVIP(),
			IsSuperuser: user.IsSuperuser,
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

	// 验证 username 或 email 至少提供一个
	if req.Username == "" && req.Email == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "username or email is required"})
		return
	}

	ip := c.ClientIP()

	// 查找用户（支持 username 或 email）
	identifier := req.Username
	if identifier == "" {
		identifier = req.Email
	}

	// 检查登录锁定
	allowed, ttl := h.loginProtection.CheckLoginAttempts(identifier, ip)
	if !allowed {
		// 格式化剩余时间为可读字符串
		retryAfter := formatDuration(ttl)
		c.JSON(http.StatusTooManyRequests, gin.H{
			"error":       "account locked",
			"retry_after": retryAfter,
		})
		return
	}

	var user *model.User
	var err error

	// 先尝试用 username 查找
	if req.Username != "" {
		user, err = h.userRepo.GetByUsername(c.Request.Context(), req.Username)
	} else {
		// 否则用 email 查找
		user, err = h.userRepo.GetByEmail(c.Request.Context(), req.Email)
	}

	if err != nil || user == nil {
		h.loginProtection.RecordFailedAttempt(identifier, ip)
		h.auditLogger.Log("login_failed", "", identifier, map[string]interface{}{"reason": "user_not_found"}, c)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	// 验证密码
	if err := bcrypt.CompareHashAndPassword([]byte(user.HashedPassword), []byte(req.Password)); err != nil {
		h.loginProtection.RecordFailedAttempt(identifier, ip)
		h.auditLogger.Log("login_failed", "", identifier, map[string]interface{}{"reason": "invalid_password"}, c)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

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

	// 设置 httpOnly Cookie
	h.setTokenCookie(c, "access_token", accessToken, int(h.cfg.JWT.AccessTokenExpire.Seconds()))
	h.setTokenCookie(c, "refresh_token", refreshToken, int(h.cfg.JWT.RefreshTokenExpire.Seconds()))

	c.JSON(http.StatusOK, TokenResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		TokenType:    "Bearer",
		ExpiresIn:    int(h.cfg.JWT.AccessTokenExpire.Seconds()),
		User: UserInfo{
			ID:          user.ID.String(),
			Email:       user.Email,
			Username:    user.Username,
			Nickname:    user.Nickname,
			AvatarURL:   user.AvatarURL,
			VIPLevel:    user.VIPLevel,
			VIPTier:     user.VIPTier(),
			IsVIP:       user.IsVIP(),
			IsSuperuser: user.IsSuperuser,
		},
	})
}

// setTokenCookie 设置 httpOnly Cookie
func (h *AuthHandler) setTokenCookie(c *gin.Context, name, value string, maxAge int) {
	// 获取请求来源
	origin := c.Request.Header.Get("Origin")

	// 开发环境配置
	secure := false
	sameSite := http.SameSiteLaxMode
	domain := ""

	// 如果有 Origin 且不是 localhost，尝试提取 domain
	if origin != "" && !strings.Contains(origin, "localhost") && !strings.Contains(origin, "127.0.0.1") {
		// 从 http://dev.maneki.cn:5175 提取 domain
		// 简单处理：取 host 部分，去掉端口
		host := strings.TrimPrefix(origin, "http://")
		host = strings.TrimPrefix(host, "https://")
		host = strings.Split(host, ":")[0] // 去掉端口

		// 如果 host 包含 .，设置 domain 为 .xxx.xxx 形式
		if strings.Contains(host, ".") {
			// 如果是子域名，设置父域名让所有子域共享 cookie
			parts := strings.Split(host, ".")
			if len(parts) >= 2 {
				domain = "." + strings.Join(parts[len(parts)-2:], ".")
			}
		}
	}

	c.SetSameSite(sameSite)
	c.SetCookie(
		name,
		value,
		maxAge,
		"/",
		domain,
		secure,
		true, // httpOnly
	)
}

// Logout 用户登出
func (h *AuthHandler) Logout(c *gin.Context) {
	// 清除 Cookie
	h.clearTokenCookie(c, "access_token")
	h.clearTokenCookie(c, "refresh_token")

	// 获取token加入黑名单（可选）
	if authHeader := c.GetHeader("Authorization"); authHeader != "" {
		// 解析token获取过期时间并加入黑名单
	}

	userID, _ := c.Get("user_id")
	userEmail, _ := c.Get("user_email")
	if userID != nil && userEmail != nil {
		h.auditLogger.Log("logout", userID.(string), userEmail.(string), nil, c)
	}

	c.JSON(http.StatusOK, gin.H{"message": "logged out successfully"})
}

// clearTokenCookie 清除 Cookie
func (h *AuthHandler) clearTokenCookie(c *gin.Context, name string) {
	c.SetCookie(
		name,
		"",
		-1,
		"/",
		"",
		false,
		true,
	)
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
		ID:          user.ID.String(),
		Email:       user.Email,
		Username:    user.Username,
		Nickname:    user.Nickname,
		AvatarURL:   user.AvatarURL,
		VIPLevel:    user.VIPLevel,
		VIPTier:     user.VIPTier(),
		IsVIP:       user.IsVIP(),
		IsSuperuser: user.IsSuperuser,
	})
}

// formatDuration 将秒数格式化为可读字符串
func formatDuration(seconds int) string {
	if seconds < 60 {
		return fmt.Sprintf("%d秒", seconds)
	}
	if seconds < 3600 {
		minutes := seconds / 60
		secs := seconds % 60
		if secs > 0 {
			return fmt.Sprintf("%d分%d秒", minutes, secs)
		}
		return fmt.Sprintf("%d分钟", minutes)
	}
	hours := seconds / 3600
	minutes := (seconds % 3600) / 60
	if minutes > 0 {
		return fmt.Sprintf("%d小时%d分", hours, minutes)
	}
	return fmt.Sprintf("%d小时", hours)
}
