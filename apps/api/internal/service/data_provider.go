package service

import (
	"bytes"
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

// DataProvider 统一数据提供者
// 所有数据都通过 data-service (Python) 获取
type DataProvider struct {
	cfg           *config.Config
	db            *gorm.DB
	redis         *redis.Client
	dataServiceURL string
	httpClient    *http.Client
}

// DataServiceRequest 数据服务请求
type DataServiceRequest struct {
	Code   string `json:"code"`
	Days   int    `json:"days"`
	Source string `json:"source"` // auto | tushare | akshare
}

// DataServiceResponse 数据服务响应
type DataServiceResponse struct {
	Code   int             `json:"code"`
	Msg    string          `json:"msg"`
	Data   json.RawMessage `json:"data"`
	Source string          `json:"source"`
}

// NewDataProvider 创建数据提供者
func NewDataProvider(cfg *config.Config, db *gorm.DB, redis *redis.Client) *DataProvider {
	return &DataProvider{
		cfg:            cfg,
		db:             db,
		redis:          redis,
		dataServiceURL: cfg.DataSource.DataServiceURL,
		httpClient:     &http.Client{Timeout: 30 * time.Second},
	}
}

// GetKLine 获取K线数据（带缓存）
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

	// 3. 通过 data-service 获取数据
	source := dp.selectSource(user)
	data, err := dp.fetchFromDataService("/api/kline", DataServiceRequest{
		Code:   code,
		Days:   days,
		Source: source,
	})
	if err != nil {
		return nil, fmt.Errorf("data service error: %w", err)
	}

	// 解析K线数据
	var klines []model.KLine
	if err := json.Unmarshal(data.Data, &klines); err != nil {
		return nil, fmt.Errorf("parse kline error: %w", err)
	}

	// 4. 存入数据库和缓存
	go dp.saveToDB(klines)
	go dp.refreshCache(cacheKey, klines, 5*time.Minute)

	return klines, nil
}

// GetRealtimeQuote 获取实时行情
func (dp *DataProvider) GetRealtimeQuote(ctx context.Context, user *model.User, codes []string) ([]model.Quote, error) {
	source := dp.selectSource(user)

	reqData := map[string]interface{}{
		"codes":  codes,
		"source": source,
	}

	resp, err := dp.postToDataService("/api/quote/realtime", reqData)
	if err != nil {
		return nil, err
	}

	var quotes []model.Quote
	if err := json.Unmarshal(resp.Data, &quotes); err != nil {
		return nil, err
	}

	return quotes, nil
}

// GetStockList 获取股票列表
func (dp *DataProvider) GetStockList(ctx context.Context) ([]map[string]interface{}, error) {
	resp, err := dp.getFromDataService("/api/stock/list?source=auto")
	if err != nil {
		return nil, err
	}

	var list []map[string]interface{}
	if err := json.Unmarshal(resp.Data, &list); err != nil {
		return nil, err
	}

	return list, nil
}

// SyncStockData 同步股票数据（定时任务调用）
func (dp *DataProvider) SyncStockData(ctx context.Context, code string) error {
	reqData := map[string]interface{}{
		"codes": []string{code},
		"days":  14,
	}

	_, err := dp.postToDataService("/api/sync/batch", reqData)
	return err
}

// BatchSync 批量同步（收盘后调用）
func (dp *DataProvider) BatchSync(ctx context.Context, codes []string) error {
	reqData := map[string]interface{}{
		"codes": codes,
		"days":  14,
	}

	resp, err := dp.postToDataService("/api/sync/batch", reqData)
	if err != nil {
		return err
	}

	// 可以在这里处理同步结果
	_ = resp
	return nil
}

// selectSource 根据用户等级选择数据源
// VIP用户优先使用 tushare，免费用户使用 akshare
func (dp *DataProvider) selectSource(user *model.User) string {
	// VIP/SVIP 用户优先使用 Tushare（实时、稳定）
	if user.IsVIP() || user.IsSVIP() {
		return "tushare"
	}
	// 免费用户使用 Akshare
	return "akshare"
}

// fetchFromDataService 从数据服务获取数据（简化版）
func (dp *DataProvider) fetchFromDataService(path string, reqData interface{}) (*DataServiceResponse, error) {
	return dp.postToDataService(path, reqData)
}

// postToDataService POST请求数据服务
func (dp *DataProvider) postToDataService(path string, data interface{}) (*DataServiceResponse, error) {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return nil, err
	}

	url := dp.dataServiceURL + path
	resp, err := dp.httpClient.Post(url, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result DataServiceResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	if result.Code != 0 {
		return nil, fmt.Errorf("data service error: %s", result.Msg)
	}

	return &result, nil
}

// getFromDataService GET请求数据服务
func (dp *DataProvider) getFromDataService(path string) (*DataServiceResponse, error) {
	url := dp.dataServiceURL + path
	resp, err := dp.httpClient.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result DataServiceResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	if result.Code != 0 {
		return nil, fmt.Errorf("data service error: %s", result.Msg)
	}

	return &result, nil
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
