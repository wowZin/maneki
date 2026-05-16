package handler

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/maneki/api/internal/config"
	"github.com/maneki/api/internal/middleware"
	"github.com/maneki/api/internal/model"
	"github.com/maneki/api/internal/repository"
	"github.com/maneki/api/internal/service"
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
	smsService     service.SMSService
	redis          *redis.Client
}

// NewAuthHandler 创建认证处理器
func NewAuthHandler(cfg *config.Config, userRepo *repository.UserRepository, redisClient *redis.Client, smsSvc service.SMSService) *AuthHandler {
	return &AuthHandler{
		cfg:             cfg,
		userRepo:        userRepo,
		loginProtection: middleware.NewLoginProtection(redisClient),
		auditLogger:     middleware.NewAuditLogger(redisClient),
		tokenBlacklist:  middleware.NewTokenBlacklist(redisClient),
		smsService:      smsSvc,
		redis:           redisClient,
	}
}

// RegisterRequest 注册请求
type RegisterRequest struct {
	Nickname        string `json:"nickname" binding:"required,min=2,max=20"`
	Phone           string `json:"phone" binding:"required"`
	Password        string `json:"password" binding:"required,min=8"`
	ConfirmPassword string `json:"confirm_password" binding:"required"`
}

// PasswordLoginRequest 密码登录请求（支持手机号或昵称）
type PasswordLoginRequest struct {
	Account  string `json:"account" binding:"required"` // 手机号或昵称
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
	Nickname    string `json:"nickname"`
	Phone       string `json:"phone"`
	AvatarURL   string `json:"avatar_url"`
	VIPLevel    int    `json:"vip_level"`
	VIPTier     string `json:"vip_tier"`
	IsVIP       bool   `json:"is_vip"`
	IsSuperuser bool   `json:"is_superuser"`
	IsActive    bool   `json:"is_active"`
	IsVerified  bool   `json:"is_verified"`
}

// Register 用户注册
func (h *AuthHandler) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 检查手机号格式
	if !h.smsService.IsValidPhone(req.Phone) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请输入有效的手机号"})
		return
	}

	// 检查手机号是否已存在
	existingUser, _ := h.userRepo.GetByPhone(c.Request.Context(), req.Phone)
	if existingUser != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "该手机号已被注册"})
		return
	}

	// 检查昵称是否已存在
	existingUser, _ = h.userRepo.GetByNickname(c.Request.Context(), req.Nickname)
	if existingUser != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "该昵称已被使用"})
		return
	}

	// 确认密码一致性
	if req.Password != req.ConfirmPassword {
		c.JSON(http.StatusBadRequest, gin.H{"error": "两次输入的密码不一致"})
		return
	}

	// 密码强度验证
	if err := validatePasswordStrength(req.Password); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 加密密码
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "服务器繁忙，请稍后重试"})
		return
	}

	// 创建用户
	user := &model.User{
		Nickname:       req.Nickname,
		Phone:          req.Phone,
		Email:          req.Phone + "@test.local",
		Username:       req.Phone,
		HashedPassword: string(hashedPassword),
		RegisterSource: "password",
		IsActive:       true,
		IsSuperuser:    false,
		VIPLevel:       0,
	}

	if err := h.userRepo.Create(c.Request.Context(), user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "注册失败，请稍后重试"})
		return
	}

	// 生成Token
	accessToken, err := middleware.GenerateToken(user, h.cfg.SecretKey, h.cfg.JWT.AccessTokenExpire)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "服务器繁忙，请稍后重试"})
		return
	}

	refreshToken, err := middleware.GenerateToken(user, h.cfg.SecretKey, h.cfg.JWT.RefreshTokenExpire)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "服务器繁忙，请稍后重试"})
		return
	}

	h.auditLogger.Log("user_create", user.ID.String(), req.Phone, nil, c)

	// 设置 httpOnly Cookie
	h.setTokenCookie(c, "access_token", accessToken, 14 * 24 * 60 * 60)
	h.setTokenCookie(c, "refresh_token", refreshToken, int(h.cfg.JWT.RefreshTokenExpire.Seconds()))

	c.JSON(http.StatusCreated, TokenResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		TokenType:    "Bearer",
		ExpiresIn:    14 * 24 * 60 * 60,
		User: UserInfo{
			ID:          user.ID.String(),
			Nickname:    user.Nickname,
			Phone:       user.Phone,
			AvatarURL:   user.AvatarURL,
			VIPLevel:    user.VIPLevel,
			VIPTier:     user.VIPTier(),
			IsVIP:       user.IsVIP(),
			IsSuperuser: user.IsSuperuser,
		},
	})
}

// PasswordLogin 密码登录（支持手机号或昵称）
func (h *AuthHandler) PasswordLogin(c *gin.Context) {
	var req PasswordLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ip := c.ClientIP()
	account := req.Account

	// 检查登录锁定
	allowed, ttl := h.loginProtection.CheckLoginAttempts(account, ip)
	if !allowed {
		retryAfter := formatDuration(ttl)
		c.JSON(http.StatusTooManyRequests, gin.H{
			"error":       "登录失败次数过多，账号已锁定，请" + retryAfter + "后再试",
			"retry_after": retryAfter,
		})
		return
	}

	var user *model.User
	var err error

	// 先尝试按手机号查找（输入为纯数字且长度合适时）
	if h.smsService.IsValidPhone(account) {
		user, err = h.userRepo.GetByPhone(c.Request.Context(), account)
	}

	// 未命中则按昵称查找
	if user == nil && err == nil {
		user, err = h.userRepo.GetByNickname(c.Request.Context(), account)
	}

	if err != nil || user == nil {
		h.loginProtection.RecordFailedAttempt(account, ip)
		h.auditLogger.Log("login_failed", "", account, map[string]interface{}{"reason": "user_not_found"}, c)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "账号或密码错误"})
		return
	}

	// 验证密码（短信自动注册用户可能无密码）
	if user.HashedPassword == "" {
		h.loginProtection.RecordFailedAttempt(account, ip)
		h.auditLogger.Log("login_failed", "", account, map[string]interface{}{"reason": "no_password_set"}, c)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "该账号未设置密码，请使用短信验证码登录"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.HashedPassword), []byte(req.Password)); err != nil {
		h.loginProtection.RecordFailedAttempt(account, ip)
		h.auditLogger.Log("login_failed", "", account, map[string]interface{}{"reason": "invalid_password"}, c)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "账号或密码错误"})
		return
	}

	// 登录成功，清除失败记录
	h.loginProtection.ClearAttempts(account, ip)

	// 生成Token
	if err := h.generateAndSetTokens(c, user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "服务器繁忙，请稍后重试"})
		return
	}

	h.auditLogger.Log("login_success", user.ID.String(), user.Phone, nil, c)
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": "服务器繁忙，请稍后重试"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"access_token": accessToken,
		"token_type":   "Bearer",
		"expires_in":   14 * 24 * 60 * 60,
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
		Nickname:    user.Nickname,
		Phone:       user.Phone,
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

// ==================== 手机号登录相关接口 ====================

// PhoneTokenRequest 号码认证Token请求
type PhoneTokenRequest struct {
	Scene string `json:"scene,omitempty"`
}

// PhoneTokenResponse 号码认证Token响应
type PhoneTokenResponse struct {
	AccessToken string `json:"access_token"`
	JwtToken    string `json:"jwt_token"`
	ExpireTime  int    `json:"expire_time"`
}

// PhoneVerifyRequest 号码认证登录请求
type PhoneVerifyRequest struct {
	Phone   string `json:"phone" binding:"required"`
	SpToken string `json:"sp_token" binding:"required"`
}

// PhoneSendCodeRequest 发送验证码请求
type PhoneSendCodeRequest struct {
	Phone string `json:"phone" binding:"required"`
}

// PhoneLoginByCodeRequest 验证码登录请求
type PhoneLoginByCodeRequest struct {
	Phone string `json:"phone" binding:"required"`
	Code  string `json:"code" binding:"required"`
}

// GetPhoneAuthToken 获取号码认证Token
func (h *AuthHandler) GetPhoneAuthToken(c *gin.Context) {
	tokenResult, err := h.smsService.GetAuthToken(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "认证服务暂不可用，请稍后重试"})
		return
	}

	c.JSON(http.StatusOK, PhoneTokenResponse{
		AccessToken: tokenResult.AccessToken,
		JwtToken:    tokenResult.JwtToken,
		ExpireTime:  tokenResult.ExpireTime,
	})
}

// VerifyPhoneLogin 号码认证登录
func (h *AuthHandler) VerifyPhoneLogin(c *gin.Context) {
	var req PhoneVerifyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数错误"})
		return
	}

	if !h.smsService.IsValidPhone(req.Phone) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请输入有效的手机号"})
		return
	}

	// 调用阿里云验证
	if err := h.smsService.VerifyPhoneWithToken(c.Request.Context(), req.Phone, req.SpToken); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "手机号验证失败，请检查后重试"})
		return
	}

	// 查找或创建用户
	user, err := h.findOrCreateUserByPhone(c.Request.Context(), req.Phone)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "登录失败，请稍后重试"})
		return
	}

	if !user.IsActive {
		c.JSON(http.StatusForbidden, gin.H{"error": "账号已被禁用，请联系客服"})
		return
	}

	// 生成Token
	if err := h.generateAndSetTokens(c, user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "登录失败，请稍后重试"})
		return
	}

	h.auditLogger.Log("phone_login_success", user.ID.String(), req.Phone, nil, c)
}

// SendPhoneCode 发送短信验证码
func (h *AuthHandler) SendPhoneCode(c *gin.Context) {
	var req PhoneSendCodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请输入有效的手机号"})
		return
	}

	if !h.smsService.IsValidPhone(req.Phone) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请输入有效的手机号"})
		return
	}

	// IP频率限制检查
	ip := c.ClientIP()
	ipLimitKey := fmt.Sprintf("sms:limit:ip:%s", ip)
	ipCount, err := h.redis.Incr(c.Request.Context(), ipLimitKey).Result()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "服务暂不可用"})
		return
	}
	if ipCount == 1 {
		_ = h.redis.Expire(c.Request.Context(), ipLimitKey, 60*time.Second)
	}
	if ipCount > 10 {
		c.JSON(http.StatusTooManyRequests, gin.H{
			"error": "操作过于频繁，请稍后再试",
			"code":  "rate_limited_ip",
		})
		return
	}

	// 发送验证码
	_, err = h.smsService.SendVerifyCode(c.Request.Context(), req.Phone)
	if err != nil {
		if strings.Contains(err.Error(), "rate limited") {
			// 获取剩余时间
			phoneLimitKey := fmt.Sprintf("sms:limit:phone:%s", req.Phone)
			ttl, _ := h.redis.TTL(c.Request.Context(), phoneLimitKey).Result()
			retryAfter := int(ttl.Seconds())
			if retryAfter < 0 {
				retryAfter = 60
			}
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":       "请稍后再试",
				"code":        "rate_limited_phone",
				"retry_after": retryAfter,
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "短信发送失败，请稍后重试"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "验证码已发送"})
}

// LoginByPhoneCode 短信验证码登录
func (h *AuthHandler) LoginByPhoneCode(c *gin.Context) {
	var req PhoneLoginByCodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数错误"})
		return
	}

	if !h.smsService.IsValidPhone(req.Phone) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请输入有效的手机号"})
		return
	}

	// 校验验证码
	valid, err := h.smsService.ValidateVerifyCode(c.Request.Context(), req.Phone, req.Code)
	if err != nil {
		if strings.Contains(err.Error(), "expired") || strings.Contains(err.Error(), "not requested") {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "验证码已过期，请重新获取",
				"code":  "code_expired",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "验证失败，请稍后重试"})
		return
	}
	if !valid {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "验证码错误，请重新输入",
			"code":  "invalid_code",
		})
		return
	}

	// 查找或创建用户
	user, err := h.findOrCreateUserByPhone(c.Request.Context(), req.Phone)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "登录失败，请稍后重试"})
		return
	}

	if !user.IsActive {
		c.JSON(http.StatusForbidden, gin.H{"error": "账号已被禁用，请联系客服"})
		return
	}

	// 生成Token
	if err := h.generateAndSetTokens(c, user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "登录失败，请稍后重试"})
		return
	}

	h.auditLogger.Log("phone_code_login_success", user.ID.String(), req.Phone, nil, c)
}

// findOrCreateUserByPhone 根据手机号查找或创建用户
func (h *AuthHandler) findOrCreateUserByPhone(ctx context.Context, phone string) (*model.User, error) {
	user, err := h.userRepo.GetByPhone(ctx, phone)
	if err != nil {
		return nil, err
	}

	if user != nil {
		return user, nil
	}

	// 自动创建用户
	maskedPhone := phone[:3] + "****" + phone[7:]
	user = &model.User{
		Phone:          phone,
		Nickname:       maskedPhone,
		RegisterSource: "phone",
		IsActive:       true,
		IsSuperuser:    false,
		VIPLevel:       0,
	}

	if err := h.userRepo.Create(ctx, user); err != nil {
		return nil, err
	}

	return user, nil
}

// ForgotPasswordSendCodeRequest 忘记密码发送验证码请求
type ForgotPasswordSendCodeRequest struct {
	Phone string `json:"phone" binding:"required"`
}

// ForgotPasswordResetRequest 忘记密码重置请求
type ForgotPasswordResetRequest struct {
	Phone       string `json:"phone" binding:"required"`
	Code        string `json:"code" binding:"required"`
	NewPassword string `json:"new_password" binding:"required,min=8"`
}

// SendForgotPasswordCode 发送忘记密码验证码
func (h *AuthHandler) SendForgotPasswordCode(c *gin.Context) {
	var req ForgotPasswordSendCodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请输入有效的手机号"})
		return
	}

	if !h.smsService.IsValidPhone(req.Phone) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请输入有效的手机号"})
		return
	}

	// 验证手机号是否已注册
	user, err := h.userRepo.GetByPhone(c.Request.Context(), req.Phone)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "服务暂不可用"})
		return
	}
	if user == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "该手机号未注册"})
		return
	}

	// IP频率限制检查
	ip := c.ClientIP()
	ipLimitKey := fmt.Sprintf("sms:limit:forgot_ip:%s", ip)
	ipCount, err := h.redis.Incr(c.Request.Context(), ipLimitKey).Result()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "服务暂不可用"})
		return
	}
	if ipCount == 1 {
		_ = h.redis.Expire(c.Request.Context(), ipLimitKey, 60*time.Second)
	}
	if ipCount > 10 {
		c.JSON(http.StatusTooManyRequests, gin.H{
			"error": "操作过于频繁，请稍后再试",
			"code":  "rate_limited_ip",
		})
		return
	}

	// 发送验证码
	_, err = h.smsService.SendForgotPasswordCode(c.Request.Context(), req.Phone)
	if err != nil {
		if strings.Contains(err.Error(), "rate limited") {
			phoneLimitKey := fmt.Sprintf("sms:limit:forgot:%s", req.Phone)
			ttl, _ := h.redis.TTL(c.Request.Context(), phoneLimitKey).Result()
			retryAfter := int(ttl.Seconds())
			if retryAfter < 0 {
				retryAfter = 60
			}
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":       "请稍后再试",
				"code":        "rate_limited_phone",
				"retry_after": retryAfter,
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "短信发送失败，请稍后重试"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "验证码已发送"})
}

// ResetPassword 重置密码
func (h *AuthHandler) ResetPassword(c *gin.Context) {
	var req ForgotPasswordResetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数错误"})
		return
	}

	if !h.smsService.IsValidPhone(req.Phone) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请输入有效的手机号"})
		return
	}

	// 密码强度验证
	if err := validatePasswordStrength(req.NewPassword); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 验证验证码
	valid, err := h.smsService.ValidateForgotPasswordCode(c.Request.Context(), req.Phone, req.Code)
	if err != nil {
		if strings.Contains(err.Error(), "expired") || strings.Contains(err.Error(), "not requested") {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "验证码已过期，请重新获取",
				"code":  "code_expired",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "验证失败，请稍后重试"})
		return
	}
	if !valid {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "验证码错误，请重新输入",
			"code":  "invalid_code",
		})
		return
	}

	// 查找用户
	user, err := h.userRepo.GetByPhone(c.Request.Context(), req.Phone)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "服务暂不可用"})
		return
	}
	if user == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "该手机号未注册"})
		return
	}

	// 加密新密码
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "密码加密失败"})
		return
	}

	// 更新密码
	user.HashedPassword = string(hashedPassword)
	if err := h.userRepo.Update(c.Request.Context(), user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "密码更新失败"})
		return
	}

	h.auditLogger.Log("password_reset", user.ID.String(), req.Phone, nil, c)

	// 生成Token并自动登录
	if err := h.generateAndSetTokens(c, user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "登录失败，请稍后重试"})
		return
	}
}

// validatePasswordStrength 验证密码强度
func validatePasswordStrength(password string) error {
	if len(password) < 8 {
		return fmt.Errorf("密码至少8位")
	}

	hasLetter := false
	hasDigit := false
	for _, ch := range password {
		if (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') {
			hasLetter = true
		}
		if ch >= '0' && ch <= '9' {
			hasDigit = true
		}
	}

	if !hasLetter {
		return fmt.Errorf("密码必须包含字母")
	}
	if !hasDigit {
		return fmt.Errorf("密码必须包含数字")
	}

	return nil
}

// generateAndSetTokens 生成JWT并设置Cookie
func (h *AuthHandler) generateAndSetTokens(c *gin.Context, user *model.User) error {
	accessToken, err := middleware.GenerateToken(user, h.cfg.SecretKey, h.cfg.JWT.AccessTokenExpire)
	if err != nil {
		return err
	}

	refreshToken, err := middleware.GenerateToken(user, h.cfg.SecretKey, h.cfg.JWT.RefreshTokenExpire)
	if err != nil {
		return err
	}

	h.setTokenCookie(c, "access_token", accessToken, 14*24*60*60)
	h.setTokenCookie(c, "refresh_token", refreshToken, int(h.cfg.JWT.RefreshTokenExpire.Seconds()))

	c.JSON(http.StatusOK, TokenResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		TokenType:    "Bearer",
		ExpiresIn:    14 * 24 * 60 * 60,
		User: UserInfo{
			ID:          user.ID.String(),
			Nickname:    user.Nickname,
			Phone:       user.Phone,
			AvatarURL:   user.AvatarURL,
			VIPLevel:    user.VIPLevel,
			VIPTier:     user.VIPTier(),
			IsVIP:       user.IsVIP(),
			IsSuperuser: user.IsSuperuser,
			IsActive:    user.IsActive,
			IsVerified:  user.IsVerified,
		},
	})

	return nil
}
