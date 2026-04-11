package config

import "os"

type Config struct {
	Port            string
	Database        DatabaseConfig
	Redis           RedisConfig
	TushareToken    string // Tushare API Token
	AkshareProxyURL string // Akshare Python服务地址
}

type DatabaseConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	Name     string
}

type RedisConfig struct {
	Host string
	Port string
}

func Load() *Config {
	return &Config{
		Port: getEnv("PORT", "8080"),
		Database: DatabaseConfig{
			Host:     getEnv("DB_HOST", "localhost"),
			Port:     getEnv("DB_PORT", "5432"),
			User:     getEnv("DB_USER", "postgres"),
			Password: getEnv("DB_PASSWORD", ""),
			Name:     getEnv("DB_NAME", "maneki"),
		},
		Redis: RedisConfig{
			Host: getEnv("REDIS_HOST", "localhost"),
			Port: getEnv("REDIS_PORT", "6379"),
		},
		TushareToken:    getEnv("TUSHARE_TOKEN", ""),
		AkshareProxyURL: getEnv("AKSHARE_PROXY_URL", "http://localhost:8001"),
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
