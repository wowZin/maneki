package middleware

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

// SecurityHeaders 安全响应头中间件
func SecurityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 禁止 MIME 类型嗅探
		c.Header("X-Content-Type-Options", "nosniff")
		// XSS 保护（旧浏览器）
		c.Header("X-XSS-Protection", "1; mode=block")
		// 点击劫持保护
		c.Header("X-Frame-Options", "DENY")
		// Referrer 策略
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
		// 权限策略
		c.Header("Permissions-Policy", "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()")
		// 内容安全策略
		c.Header("Content-Security-Policy", "default-src 'self'; frame-ancestors 'none';")
		c.Next()
	}
}

// LoginProtection 登录保护
type LoginProtection struct {
	redis      *redis.Client
	maxAttempts int
	lockDuration time.Duration
}

// NewLoginProtection 创建登录保护实例
func NewLoginProtection(redis *redis.Client) *LoginProtection {
	return &LoginProtection{
		redis:       redis,
		maxAttempts: 5,
		lockDuration: 15 * time.Minute,
	}
}

// CheckLoginAttempts 检查登录尝试次数
func (lp *LoginProtection) CheckLoginAttempts(identifier string, ip string) (bool, int) {
	ctx := context.Background()

	// 检查账号锁定
	accountKey := fmt.Sprintf("login_lock:account:%s", identifier)
	if ttl, err := lp.redis.TTL(ctx, accountKey).Result(); err == nil && ttl > 0 {
		return false, int(ttl.Seconds())
	}

	// 检查IP锁定
	ipKey := fmt.Sprintf("login_lock:ip:%s", ip)
	if ttl, err := lp.redis.TTL(ctx, ipKey).Result(); err == nil && ttl > 0 {
		return false, int(ttl.Seconds())
	}

	return true, 0
}

// RecordFailedAttempt 记录失败尝试
func (lp *LoginProtection) RecordFailedAttempt(identifier string, ip string) {
	ctx := context.Background()

	// 账号失败次数
	accountKey := fmt.Sprintf("login_fail:account:%s", identifier)
	accountFails, _ := lp.redis.Incr(ctx, accountKey).Result()
	lp.redis.Expire(ctx, accountKey, time.Hour)

	// IP失败次数
	ipKey := fmt.Sprintf("login_fail:ip:%s", ip)
	ipFails, _ := lp.redis.Incr(ctx, ipKey).Result()
	lp.redis.Expire(ctx, ipKey, time.Hour)

	// 超过阈值则锁定
	if accountFails >= int64(lp.maxAttempts) {
		lockKey := fmt.Sprintf("login_lock:account:%s", identifier)
		lp.redis.Set(ctx, lockKey, "locked", lp.lockDuration)
	}

	if ipFails >= 10 {
		lockKey := fmt.Sprintf("login_lock:ip:%s", ip)
		lp.redis.Set(ctx, lockKey, "locked", lp.lockDuration)
	}
}

// ClearAttempts 清除失败记录
func (lp *LoginProtection) ClearAttempts(identifier string, ip string) {
	ctx := context.Background()
	lp.redis.Del(ctx, fmt.Sprintf("login_fail:account:%s", identifier))
	lp.redis.Del(ctx, fmt.Sprintf("login_fail:ip:%s", ip))
}

// AuditLogger 审计日志
type AuditLogger struct {
	redis *redis.Client
}

// NewAuditLogger 创建审计日志实例
func NewAuditLogger(redis *redis.Client) *AuditLogger {
	return &AuditLogger{redis: redis}
}

// SensitiveActions 敏感操作列表
var SensitiveActions = map[string]string{
	"user_create":         "创建用户",
	"user_update":         "更新用户",
	"user_delete":         "删除用户",
	"user_reset_password": "重置密码",
	"agent_update":        "更新 Agent",
	"settings_update":     "更新系统配置",
	"rebate_settle":       "返佣结算",
	"login_success":       "登录成功",
	"login_failed":        "登录失败",
	"logout":              "退出登录",
}

// LogEntry 日志条目
type LogEntry struct {
	Timestamp string                 `json:"timestamp"`
	Action    string                 `json:"action"`
	ActionName string                `json:"action_name"`
	UserID    string                 `json:"user_id,omitempty"`
	UserEmail string                 `json:"user_email,omitempty"`
	IP        string                 `json:"ip,omitempty"`
	UserAgent string                 `json:"user_agent,omitempty"`
	Details   map[string]interface{} `json:"details,omitempty"`
}

// Log 记录审计日志
func (al *AuditLogger) Log(action string, userID string, userEmail string, details map[string]interface{}, c *gin.Context) {
	ctx := context.Background()

	entry := LogEntry{
		Timestamp:  time.Now().Format(time.RFC3339),
		Action:     action,
		ActionName: SensitiveActions[action],
		UserID:     userID,
		UserEmail:  userEmail,
		Details:    details,
	}

	if c != nil {
		entry.IP = getClientIP(c)
		entry.UserAgent = c.GetHeader("User-Agent")
	}

	data, _ := json.Marshal(entry)

	// 存储到Redis列表（保留最近10000条）
	al.redis.LPush(ctx, fmt.Sprintf("audit_log:%s", action), data)
	al.redis.LTrim(ctx, fmt.Sprintf("audit_log:%s", action), 0, 9999)

	// 存储到全局日志列表
	al.redis.LPush(ctx, "audit_log:all", data)
	al.redis.LTrim(ctx, "audit_log:all", 0, 9999)

	// 按日期存储
	dateKey := time.Now().Format("2006-01-02")
	al.redis.LPush(ctx, fmt.Sprintf("audit_log:%s", dateKey), data)
}

// TokenBlacklist Token黑名单
type TokenBlacklist struct {
	redis *redis.Client
}

// NewTokenBlacklist 创建Token黑名单实例
func NewTokenBlacklist(redis *redis.Client) *TokenBlacklist {
	return &TokenBlacklist{redis: redis}
}

// AddToBlacklist 将Token加入黑名单
func (tb *TokenBlacklist) AddToBlacklist(token string, exp int64) {
	ctx := context.Background()
	hash := sha256.Sum256([]byte(token))
	tokenHash := hex.EncodeToString(hash[:])

	ttl := exp - time.Now().Unix()
	if ttl > 0 {
		tb.redis.Set(ctx, fmt.Sprintf("token_blacklist:%s", tokenHash), "revoked", time.Duration(ttl)*time.Second)
	}
}

// IsBlacklisted 检查Token是否在黑名单中
func (tb *TokenBlacklist) IsBlacklisted(token string) bool {
	ctx := context.Background()
	hash := sha256.Sum256([]byte(token))
	tokenHash := hex.EncodeToString(hash[:])

	exists, _ := tb.redis.Exists(ctx, fmt.Sprintf("token_blacklist:%s", tokenHash)).Result()
	return exists > 0
}

// IPWhitelist IP白名单
type IPWhitelist struct {
	whitelist []string
}

// NewIPWhitelist 创建IP白名单实例
func NewIPWhitelist(defaultNetworks string) *IPWhitelist {
	return &IPWhitelist{
		whitelist: strings.Split(defaultNetworks, ","),
	}
}

// IsAllowed 检查IP是否在白名单中
func (iw *IPWhitelist) IsAllowed(ip string) bool {
	clientIP := net.ParseIP(ip)
	if clientIP == nil {
		return false
	}

	for _, network := range iw.whitelist {
		_, ipNet, err := net.ParseCIDR(network)
		if err != nil {
			// 单个IP
			if network == ip {
				return true
			}
			continue
		}
		if ipNet.Contains(clientIP) {
			return true
		}
	}

	return false
}

// getClientIP 获取客户端IP
func getClientIP(c *gin.Context) string {
	forwarded := c.GetHeader("X-Forwarded-For")
	if forwarded != "" {
		return strings.Split(forwarded, ",")[0]
	}

	realIP := c.GetHeader("X-Real-IP")
	if realIP != "" {
		return realIP
	}

	return c.ClientIP()
}

// RateLimiter 基于Redis的限流器
type RateLimiter struct {
	redis      *redis.Client
	window     time.Duration
	maxRequests int
}

// NewRateLimiter 创建限流器
func NewRateLimiter(redis *redis.Client, window time.Duration, maxRequests int) *RateLimiter {
	return &RateLimiter{
		redis:       redis,
		window:      window,
		maxRequests: maxRequests,
	}
}

// IsAllowed 检查是否允许请求
func (rl *RateLimiter) IsAllowed(key string) bool {
	ctx := context.Background()
	now := time.Now().Unix()
	windowStart := now - int64(rl.window.Seconds())

	pipe := rl.redis.Pipeline()
	// 移除窗口外的请求记录
	pipe.ZRemRangeByScore(ctx, fmt.Sprintf("rate_limit:%s", key), "0", fmt.Sprintf("%d", windowStart))
	// 获取当前窗口内的请求数
	pipe.ZCard(ctx, fmt.Sprintf("rate_limit:%s", key))
	// 添加当前请求
	pipe.ZAdd(ctx, fmt.Sprintf("rate_limit:%s", key), redis.Z{Score: float64(now), Member: now})
	// 设置过期时间
	pipe.Expire(ctx, fmt.Sprintf("rate_limit:%s", key), rl.window)

	results, _ := pipe.Exec(ctx)
	currentCount := results[1].(*redis.IntCmd).Val()

	return currentCount < int64(rl.maxRequests)
}
