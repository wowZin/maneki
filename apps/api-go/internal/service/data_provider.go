package service

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/maneki/api/internal/config"
	"github.com/maneki/api/internal/model"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

// DataSource 数据源接口
type DataSource interface {
	GetName() string
	GetKLine(ctx context.Context, code string, days int) ([]model.KLine, error)
	GetStockBasic(ctx context.Context, code string) (*model.Stock, error)
	GetRealtimeQuote(ctx context.Context, codes []string) ([]model.Quote, error)
	IsAvailable() bool
}

// DataProvider 统一数据提供者
type DataProvider struct {
	cfg       *config.Config
	db        *gorm.DB
	redis     *redis.Client
	sources   map[string]DataSource
	proxyURL  string // Python Akshare 服务地址
}

// NewDataProvider 创建数据提供者
func NewDataProvider(cfg *config.Config, db *gorm.DB, redis *redis.Client) *DataProvider {
	dp := &DataProvider{
		cfg:      cfg,
		db:       db,
		redis:    redis,
		sources:  make(map[string]DataSource),
		proxyURL: cfg.AkshareProxyURL, // 如: http://localhost:8001
	}

	// 注册数据源
	if cfg.TushareToken != "" {
		dp.sources["tushare"] = NewTushareSource(cfg.TushareToken)
	}
	if cfg.AkshareProxyURL != "" {
		dp.sources["akshare"] = NewAkshareProxySource(cfg.AkshareProxyURL)
	}

	return dp
}

// GetKLine 获取K线数据（带缓存和自动降级）
func (dp *DataProvider) GetKLine(ctx context.Context, user *model.User, code string, days int) ([]model.KLine, error) {
	cacheKey := fmt.Sprintf("kline:%s:%d", code, days)

	// 1. 先查本地缓存（Redis）
	if data, err := dp.getFromCache(ctx, cacheKey); err == nil && len(data) > 0 {
		return data, nil
	}

	// 2. 查数据库（14天内数据）
	if days <= 14 {
		if data, err := dp.getFromDB(ctx, code, days); err == nil && len(data) >= days/2 {
			// 异步刷新缓存
			go dp.refreshCache(cacheKey, data, 5*time.Minute)
			return data, nil
		}
	}

	// 3. 根据用户等级选择数据源
	source := dp.selectSource(user)
	if source == nil {
		return nil, fmt.Errorf("no available data source")
	}

	// 4. 从外部数据源获取
	data, err := source.GetKLine(ctx, code, days)
	if err != nil {
		return nil, fmt.Errorf("%s get kline failed: %w", source.GetName(), err)
	}

	// 5. 存入数据库和缓存
	go dp.saveToDB(data)
	go dp.refreshCache(cacheKey, data, 5*time.Minute)

	return data, nil
}

// GetRealtimeQuote 获取实时行情（优先Tushare）
func (dp *DataProvider) GetRealtimeQuote(ctx context.Context, user *model.User, codes []string) ([]model.Quote, error) {
	// 实时数据不走缓存，直接查数据源
	source := dp.selectSource(user)
	if source == nil {
		return nil, fmt.Errorf("no available data source")
	}

	return source.GetRealtimeQuote(ctx, codes)
}

// selectSource 根据用户等级选择数据源
func (dp *DataProvider) selectSource(user *model.User) DataSource {
	// VIP/SVIP 优先使用 Tushare（实时、稳定）
	if user.IsVIP() || user.IsSVIP() {
		if src, ok := dp.sources["tushare"]; ok && src.IsAvailable() {
			return src
		}
		// Tushare 不可用时降级到 Akshare
		if src, ok := dp.sources["akshare"]; ok && src.IsAvailable() {
			return src
		}
	}

	// 免费用户使用 Akshare
	if src, ok := dp.sources["akshare"]; ok && src.IsAvailable() {
		return src
	}

	// 最后尝试 Tushare（可能token配置但用户非VIP）
	if src, ok := dp.sources["tushare"]; ok && src.IsAvailable() {
		return src
	}

	return nil
}

// getFromCache 从Redis获取缓存
func (dp *DataProvider) getFromCache(ctx context.Context, key string) ([]model.KLine, error) {
	if dp.redis == nil {
		return nil, fmt.Errorf("redis not available")
	}

	data, err := dp.redis.Get(ctx, key).Bytes()
	if err != nil {
		return nil, err
	}

	var klines []model.KLine
	if err := json.Unmarshal(data, &klines); err != nil {
		return nil, err
	}

	return klines, nil
}

// refreshCache 刷新缓存
func (dp *DataProvider) refreshCache(key string, data []model.KLine, ttl time.Duration) {
	if dp.redis == nil {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	jsonData, _ := json.Marshal(data)
	dp.redis.Set(ctx, key, jsonData, ttl)
}

// getFromDB 从数据库查询
func (dp *DataProvider) getFromDB(ctx context.Context, code string, days int) ([]model.KLine, error) {
	var klines []model.KLine
	err := dp.db.WithContext(ctx).
		Where("code = ?", code).
		Order("date DESC").
		Limit(days).
		Find(&klines).Error
	return klines, err
}

// saveToDB 保存到数据库
func (dp *DataProvider) saveToDB(klines []model.KLine) {
	if len(klines) == 0 {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Upsert 操作
	for _, k := range klines {
		dp.db.WithContext(ctx).Save(&k)
	}
}

// SyncStockData 同步股票数据（定时任务调用）
func (dp *DataProvider) SyncStockData(ctx context.Context, code string) error {
	// 默认使用 Tushare 同步（数据质量更好）
	src, ok := dp.sources["tushare"]
	if !ok || !src.IsAvailable() {
		src, ok = dp.sources["akshare"]
	}
	if !ok {
		return fmt.Errorf("no available source for sync")
	}

	// 获取最近14天数据
	data, err := src.GetKLine(ctx, code, 14)
	if err != nil {
		return err
	}

	dp.saveToDB(data)
	return nil
}

// BatchSync 批量同步（收盘后调用）
func (dp *DataProvider) BatchSync(ctx context.Context, codes []string) error {
	for _, code := range codes {
		if err := dp.SyncStockData(ctx, code); err != nil {
			// 记录错误但继续
			continue
		}
	}
	return nil
}
