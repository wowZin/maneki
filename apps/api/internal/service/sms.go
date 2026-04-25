package service

import (
	"context"
	"fmt"
	"math/rand"
	"regexp"
	"time"

	dypnsapi "github.com/alibabacloud-go/dypnsapi-20170525/v3/client"
	openapiutil "github.com/alibabacloud-go/darabonba-openapi/v2/utils"
	"github.com/alibabacloud-go/tea/tea"
	"github.com/maneki/api/internal/config"
	"github.com/redis/go-redis/v9"
)

var phoneRegex = regexp.MustCompile(`^1[3-9]\d{9}$`)

// SMSService 短信/号码认证服务接口
type SMSService interface {
	// 号码认证
	GetAuthToken(ctx context.Context) (*AuthTokenResult, error)
	VerifyPhoneWithToken(ctx context.Context, phone, spToken string) error

	// 短信验证码（登录）
	SendVerifyCode(ctx context.Context, phone string) (string, error)
	ValidateVerifyCode(ctx context.Context, phone, code string) (bool, error)

	// 短信验证码（忘记密码）
	SendForgotPasswordCode(ctx context.Context, phone string) (string, error)
	ValidateForgotPasswordCode(ctx context.Context, phone, code string) (bool, error)

	// 通用
	IsValidPhone(phone string) bool
}

// AuthTokenResult 号码认证Token结果
type AuthTokenResult struct {
	AccessToken string `json:"access_token"`
	JwtToken    string `json:"jwt_token"`
	ExpireTime  int    `json:"expire_time"`
}

// smsServiceImpl 实现
type smsServiceImpl struct {
	cfg   *config.SMSConfig
	redis *redis.Client

	// Aliyun PNS client (lazy init)
	pnsClient *dypnsapi.Client
}

// NewSMSService 创建SMS服务
func NewSMSService(cfg *config.SMSConfig, redisClient *redis.Client) (SMSService, error) {
	svc := &smsServiceImpl{
		cfg:   cfg,
		redis: redisClient,
	}

	if cfg.Mode == "aliyun" {
		if err := svc.initAliyunClient(); err != nil {
			return nil, fmt.Errorf("failed to init aliyun client: %w", err)
		}
	}

	return svc, nil
}

func (s *smsServiceImpl) initAliyunClient() error {
	if s.cfg.AccessKeyID == "" || s.cfg.AccessKeySecret == "" {
		return fmt.Errorf("aliyun access key not configured")
	}

	// 使用 openapi Config 初始化 PNS 客户端
	// AccessKeyId/AccessKeySecret 直接设置在 Config 上即可
	cfg := &openapiutil.Config{
		AccessKeyId:     tea.String(s.cfg.AccessKeyID),
		AccessKeySecret: tea.String(s.cfg.AccessKeySecret),
		Endpoint:        tea.String("dypnsapi.aliyuncs.com"),
	}

	pnsClient, err := dypnsapi.NewClient(cfg)
	if err != nil {
		return fmt.Errorf("failed to create pns client: %w", err)
	}
	s.pnsClient = pnsClient

	return nil
}

// IsValidPhone 校验手机号格式
func (s *smsServiceImpl) IsValidPhone(phone string) bool {
	return phoneRegex.MatchString(phone)
}

// GetAuthToken 获取号码认证Token
func (s *smsServiceImpl) GetAuthToken(ctx context.Context) (*AuthTokenResult, error) {
	if s.cfg.Mode == "mock" {
		return &AuthTokenResult{
			AccessToken: "mock_access_token_" + randomString(16),
			JwtToken:    "mock_jwt_token_" + randomString(16),
			ExpireTime:  300,
		}, nil
	}

	if s.pnsClient == nil {
		return nil, fmt.Errorf("pns client not initialized")
	}

	resp, err := s.pnsClient.GetAuthToken(&dypnsapi.GetAuthTokenRequest{
		Url: tea.String("https://www.maneki.cn"),
	})
	if err != nil {
		return nil, fmt.Errorf("get auth token failed: %w", err)
	}

	if resp.Body == nil || resp.Body.Code == nil || tea.StringValue(resp.Body.Code) != "OK" {
		msg := "unknown error"
		if resp.Body != nil && resp.Body.Message != nil {
			msg = tea.StringValue(resp.Body.Message)
		}
		return nil, fmt.Errorf("get auth token failed: %s", msg)
	}

	if resp.Body.TokenInfo == nil {
		return nil, fmt.Errorf("get auth token failed: empty token info")
	}

	return &AuthTokenResult{
		AccessToken: tea.StringValue(resp.Body.TokenInfo.AccessToken),
		JwtToken:    tea.StringValue(resp.Body.TokenInfo.JwtToken),
		ExpireTime:  600, // AccessToken 默认有效期 10 分钟
	}, nil
}

// VerifyPhoneWithToken 号码认证校验
func (s *smsServiceImpl) VerifyPhoneWithToken(ctx context.Context, phone, spToken string) error {
	if !s.IsValidPhone(phone) {
		return fmt.Errorf("invalid phone number")
	}

	if s.cfg.Mode == "mock" {
		// Mock模式下直接通过
		return nil
	}

	if s.pnsClient == nil {
		return fmt.Errorf("pns client not initialized")
	}

	resp, err := s.pnsClient.VerifyPhoneWithToken(&dypnsapi.VerifyPhoneWithTokenRequest{
		PhoneNumber: tea.String(phone),
		SpToken:     tea.String(spToken),
	})
	if err != nil {
		return fmt.Errorf("verify phone failed: %w", err)
	}

	if resp.Body == nil || resp.Body.Code == nil || tea.StringValue(resp.Body.Code) != "OK" {
		msg := "unknown error"
		if resp.Body != nil && resp.Body.Message != nil {
			msg = tea.StringValue(resp.Body.Message)
		}
		return fmt.Errorf("verify phone failed: %s", msg)
	}

	return nil
}

// SendVerifyCode 发送短信验证码
func (s *smsServiceImpl) SendVerifyCode(ctx context.Context, phone string) (string, error) {
	if !s.IsValidPhone(phone) {
		return "", fmt.Errorf("invalid phone number")
	}

	// 检查频率限制
	limitKey := fmt.Sprintf("sms:limit:phone:%s", phone)
	exists, err := s.redis.Exists(ctx, limitKey).Result()
	if err != nil {
		return "", fmt.Errorf("check rate limit failed: %w", err)
	}
	if exists > 0 {
		return "", fmt.Errorf("rate limited: please wait before resending")
	}

	var code string

	if s.cfg.Mode == "mock" {
		code = "123456"
		fmt.Printf("[MOCK SMS] Phone: %s, Code: %s\n", phone, code)
	} else {
		if s.pnsClient == nil {
			return "", fmt.Errorf("pns client not initialized")
		}

		templateCode := s.cfg.TemplateCode
		if templateCode == "" {
			templateCode = "100001" // 默认使用阿里云系统模板：登录/注册验证码
		}

		resp, err := s.pnsClient.SendSmsVerifyCode(&dypnsapi.SendSmsVerifyCodeRequest{
			PhoneNumber:      tea.String(phone),
			SignName:         tea.String(s.cfg.SignName),
			TemplateCode:     tea.String(templateCode),
			CodeLength:       tea.Int64(6),
			ValidTime:        tea.Int64(300),
			ReturnVerifyCode: tea.Bool(true),
		})
		if err != nil {
			return "", fmt.Errorf("send sms failed: %w", err)
		}

		if resp.Body == nil || resp.Body.Code == nil || tea.StringValue(resp.Body.Code) != "OK" {
			msg := "unknown error"
			if resp.Body != nil && resp.Body.Message != nil {
				msg = tea.StringValue(resp.Body.Message)
			}
			return "", fmt.Errorf("send sms failed: %s", msg)
		}

		if resp.Body.Model != nil && resp.Body.Model.VerifyCode != nil {
			code = tea.StringValue(resp.Body.Model.VerifyCode)
		} else {
			return "", fmt.Errorf("sms provider did not return verify code")
		}
	}

	// 存储验证码到Redis，5分钟过期
	codeKey := fmt.Sprintf("sms:login:%s", phone)
	if err := s.redis.Set(ctx, codeKey, code, 5*time.Minute).Err(); err != nil {
		return "", fmt.Errorf("store code failed: %w", err)
	}

	// 设置发送频率限制，60秒
	if err := s.redis.Set(ctx, limitKey, "1", 60*time.Second).Err(); err != nil {
		return "", fmt.Errorf("set rate limit failed: %w", err)
	}

	return code, nil
}

// ValidateVerifyCode 校验短信验证码
func (s *smsServiceImpl) ValidateVerifyCode(ctx context.Context, phone, code string) (bool, error) {
	if !s.IsValidPhone(phone) {
		return false, fmt.Errorf("invalid phone number")
	}

	codeKey := fmt.Sprintf("sms:login:%s", phone)
	storedCode, err := s.redis.Get(ctx, codeKey).Result()
	if err == redis.Nil {
		return false, fmt.Errorf("code expired or not requested")
	}
	if err != nil {
		return false, fmt.Errorf("get code failed: %w", err)
	}

	if storedCode != code {
		return false, nil
	}

	// 验证成功后删除验证码
	_ = s.redis.Del(ctx, codeKey)

	return true, nil
}

// SendForgotPasswordCode 发送忘记密码验证码
func (s *smsServiceImpl) SendForgotPasswordCode(ctx context.Context, phone string) (string, error) {
	if !s.IsValidPhone(phone) {
		return "", fmt.Errorf("invalid phone number")
	}

	// 检查频率限制
	limitKey := fmt.Sprintf("sms:limit:forgot:%s", phone)
	exists, err := s.redis.Exists(ctx, limitKey).Result()
	if err != nil {
		return "", fmt.Errorf("check rate limit failed: %w", err)
	}
	if exists > 0 {
		return "", fmt.Errorf("rate limited: please wait before resending")
	}

	var code string

	if s.cfg.Mode == "mock" {
		code = "123456"
		fmt.Printf("[MOCK SMS] Forgot Password Phone: %s, Code: %s\n", phone, code)
	} else {
		if s.pnsClient == nil {
			return "", fmt.Errorf("pns client not initialized")
		}

		templateCode := s.cfg.TemplateCode
		if templateCode == "" {
			templateCode = "100001"
		}

		resp, err := s.pnsClient.SendSmsVerifyCode(&dypnsapi.SendSmsVerifyCodeRequest{
			PhoneNumber:      tea.String(phone),
			SignName:         tea.String(s.cfg.SignName),
			TemplateCode:     tea.String(templateCode),
			CodeLength:       tea.Int64(6),
			ValidTime:        tea.Int64(300),
			ReturnVerifyCode: tea.Bool(true),
		})
		if err != nil {
			return "", fmt.Errorf("send sms failed: %w", err)
		}

		if resp.Body == nil || resp.Body.Code == nil || tea.StringValue(resp.Body.Code) != "OK" {
			msg := "unknown error"
			if resp.Body != nil && resp.Body.Message != nil {
				msg = tea.StringValue(resp.Body.Message)
			}
			return "", fmt.Errorf("send sms failed: %s", msg)
		}

		if resp.Body.Model != nil && resp.Body.Model.VerifyCode != nil {
			code = tea.StringValue(resp.Body.Model.VerifyCode)
		} else {
			return "", fmt.Errorf("sms provider did not return verify code")
		}
	}

	// 存储验证码到Redis，5分钟过期，使用独立命名空间
	codeKey := fmt.Sprintf("sms:forgot:%s", phone)
	if err := s.redis.Set(ctx, codeKey, code, 5*time.Minute).Err(); err != nil {
		return "", fmt.Errorf("store code failed: %w", err)
	}

	// 设置发送频率限制，60秒
	if err := s.redis.Set(ctx, limitKey, "1", 60*time.Second).Err(); err != nil {
		return "", fmt.Errorf("set rate limit failed: %w", err)
	}

	return code, nil
}

// ValidateForgotPasswordCode 校验忘记密码验证码
func (s *smsServiceImpl) ValidateForgotPasswordCode(ctx context.Context, phone, code string) (bool, error) {
	if !s.IsValidPhone(phone) {
		return false, fmt.Errorf("invalid phone number")
	}

	codeKey := fmt.Sprintf("sms:forgot:%s", phone)
	storedCode, err := s.redis.Get(ctx, codeKey).Result()
	if err == redis.Nil {
		return false, fmt.Errorf("code expired or not requested")
	}
	if err != nil {
		return false, fmt.Errorf("get code failed: %w", err)
	}

	if storedCode != code {
		return false, nil
	}

	// 验证成功后删除验证码
	_ = s.redis.Del(ctx, codeKey)

	return true, nil
}

func randomString(n int) string {
	letters := []rune("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")
	b := make([]rune, n)
	for i := range b {
		b[i] = letters[rand.Intn(len(letters))]
	}
	return string(b)
}
