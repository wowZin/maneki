package config

import (
	"fmt"
	"os"
	"strings"
	"time"
)

// Config 应用配置
type Config struct {
	// 应用信息
	AppName    string
	AppVersion string
	Debug      bool
	Port       string

	// 安全密钥
	SecretKey string

	// 数据库配置
	Database DatabaseConfig
	Redis    RedisConfig

	// 微信配置
	Wechat WechatConfig

	// JWT配置
	JWT JWTConfig

	// 监控配置
	Monitor MonitorConfig

	// 数据源配置
	DataSource DataSourceConfig

	// LLM配置
	LLM LLMConfig

	// VIP/返佣配置
	VIP VIPConfig

	// 短信/号码认证配置
	SMS SMSConfig
}

// DatabaseConfig 数据库配置
type DatabaseConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	Name     string
	SSLMode  string
}

// RedisConfig Redis配置
type RedisConfig struct {
	Host     string
	Port     string
	Password string
	DB       int
}

// WechatConfig 微信配置
type WechatConfig struct {
	MPAppID     string // 公众号AppID
	MPAppSecret string // 公众号AppSecret
	MiniAppID   string // 小程序AppID
	MiniSecret  string // 小程序AppSecret
}

// JWTConfig JWT配置
type JWTConfig struct {
	AccessTokenExpire  time.Duration
	RefreshTokenExpire time.Duration
}

// MonitorConfig 监控配置
type MonitorConfig struct {
	StockCount             int
	SignalThreshold        float64
	DataCollectionInterval int
	DataRetentionDays      int
	ReplayTime             string
	AgentDiscussionTimeout int
	MaxAgents              int
}

// DataSourceConfig 数据源配置
type DataSourceConfig struct {
	TushareToken  string
	TushareEnabled bool
	DataServiceURL string
	Strategy      string // tiered | free
}

// LLMConfig LLM配置
type LLMConfig struct {
	Provider       string
	AliyunAPIKey   string
	AliyunBaseURL  string
	Model          string
	ModelAdvanced  string
}

// VIPConfig VIP配置
type VIPConfig struct {
	RebateEnabled          bool
	RebateAmount           float64
	RebateMinVIPDays       int
	RebateSettlementDays   int
	RebateMaxPerMonth      float64
}

// SMSConfig 短信/号码认证配置
type SMSConfig struct {
	Mode            string // mock | aliyun
	AccessKeyID     string
	AccessKeySecret string
	SignName        string // 短信签名
	TemplateCode    string // 短信模板Code
	PNSAppKey       string // 号码认证AppKey
}

// Load 加载配置
func Load() *Config {
	return &Config{
		AppName:    getEnv("APP_NAME", "Maneki API"),
		AppVersion: getEnv("APP_VERSION", "1.0.0"),
		Debug:      getEnv("DEBUG", "false") == "true",
		Port:       getEnv("PORT", "8080"),
		SecretKey:  getEnv("SECRET_KEY", ""),

		Database: DatabaseConfig{
			Host:     getEnv("DB_HOST", "localhost"),
			Port:     getEnv("DB_PORT", "5432"),
			User:     getEnv("DB_USER", "stock"),
			Password: getEnv("DB_PASSWORD", "stock123"),
			Name:     getEnv("DB_NAME", "stock_analysis"),
			SSLMode:  getEnv("DB_SSLMODE", "disable"),
		},

		Redis: RedisConfig{
			Host:     getEnv("REDIS_HOST", "localhost"),
			Port:     getEnv("REDIS_PORT", "6379"),
			Password: getEnv("REDIS_PASSWORD", ""),
			DB:       getEnvAsInt("REDIS_DB", 0),
		},

		Wechat: WechatConfig{
			MPAppID:     getEnv("WECHAT_MP_APP_ID", ""),
			MPAppSecret: getEnv("WECHAT_MP_APP_SECRET", ""),
			MiniAppID:   getEnv("WECHAT_MINI_APP_ID", ""),
			MiniSecret:  getEnv("WECHAT_MINI_APP_SECRET", ""),
		},

		JWT: JWTConfig{
			AccessTokenExpire:  getEnvAsDuration("JWT_ACCESS_EXPIRE", 2*time.Hour),
			RefreshTokenExpire: getEnvAsDuration("JWT_REFRESH_EXPIRE", 7*24*time.Hour),
		},

		Monitor: MonitorConfig{
			StockCount:             getEnvAsInt("MONITOR_STOCK_COUNT", 200),
			SignalThreshold:        getEnvAsFloat("SIGNAL_THRESHOLD", 0.75),
			DataCollectionInterval: getEnvAsInt("DATA_COLLECTION_INTERVAL", 5),
			DataRetentionDays:      getEnvAsInt("DATA_RETENTION_DAYS", 14),
			ReplayTime:             getEnv("REPLAY_TIME", "15:35"),
			AgentDiscussionTimeout: getEnvAsInt("AGENT_DISCUSSION_TIMEOUT", 5),
			MaxAgents:              getEnvAsInt("MAX_AGENTS", 5),
		},

		DataSource: DataSourceConfig{
			TushareToken:   getEnv("TUSHARE_TOKEN", ""),
			TushareEnabled: getEnv("TUSHARE_ENABLED", "false") == "true",
			DataServiceURL: getEnv("DATA_SERVICE_URL", "http://localhost:8001"),
			Strategy:       getEnv("DATA_SOURCE_STRATEGY", "tiered"),
		},

		LLM: LLMConfig{
			Provider:      getEnv("LLM_PROVIDER", "aliyun"),
			AliyunAPIKey:  getEnv("ALIYUN_API_KEY", ""),
			AliyunBaseURL: getEnv("ALIYUN_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1"),
			Model:         getEnv("LLM_MODEL", "qwen-turbo"),
			ModelAdvanced: getEnv("LLM_MODEL_ADVANCED", "qwen-plus"),
		},

		VIP: VIPConfig{
			RebateEnabled:        getEnv("REBATE_ENABLED", "true") == "true",
			RebateAmount:         getEnvAsFloat("REBATE_AMOUNT", 10.0),
			RebateMinVIPDays:     getEnvAsInt("REBATE_MIN_VIP_DAYS", 30),
			RebateSettlementDays: getEnvAsInt("REBATE_SETTLEMENT_DAYS", 7),
			RebateMaxPerMonth:    getEnvAsFloat("REBATE_MAX_PER_MONTH", 1000.0),
		},

		SMS: SMSConfig{
			Mode:            getEnv("SMS_MODE", "mock"),
			AccessKeyID:     getEnv("ALIYUN_ACCESS_KEY_ID", ""),
			AccessKeySecret: getEnv("ALIYUN_ACCESS_KEY_SECRET", ""),
			SignName:        getEnv("ALIYUN_SMS_SIGN_NAME", ""),
			TemplateCode:    getEnv("ALIYUN_SMS_TEMPLATE_CODE", ""),
			PNSAppKey:       getEnv("ALIYUN_PNS_APP_KEY", ""),
		},
	}
}

// DSN 返回数据库连接字符串
func (d DatabaseConfig) DSN() string {
	return "host=" + d.Host +
		" port=" + d.Port +
		" user=" + d.User +
		" password=" + d.Password +
		" dbname=" + d.Name +
		" sslmode=" + d.SSLMode
}

// Addr 返回Redis地址
func (r RedisConfig) Addr() string {
	return r.Host + ":" + r.Port
}

// CORSOrigins 返回CORS允许的源
func (c Config) CORSOrigins() []string {
	origins := getEnv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://app.maneki.cn:5173,http://admin.maneki.cn:5175")
	return strings.Split(origins, ",")
}

// Helper functions
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvAsInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		var result int
		if _, err := fmt.Sscanf(value, "%d", &result); err == nil {
			return result
		}
	}
	return defaultValue
}

func getEnvAsFloat(key string, defaultValue float64) float64 {
	if value := os.Getenv(key); value != "" {
		var result float64
		if _, err := fmt.Sscanf(value, "%f", &result); err == nil {
			return result
		}
	}
	return defaultValue
}

func getEnvAsDuration(key string, defaultValue time.Duration) time.Duration {
	if value := os.Getenv(key); value != "" {
		if d, err := time.ParseDuration(value); err == nil {
			return d
		}
	}
	return defaultValue
}
