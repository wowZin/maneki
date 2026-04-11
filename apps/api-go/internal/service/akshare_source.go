package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/maneki/api/internal/model"
)

// AkshareProxySource Akshare代理数据源（通过Python服务）
type AkshareProxySource struct {
	proxyURL   string
	httpClient *http.Client
}

// AkshareRequest 请求结构
type AkshareRequest struct {
	APIName string                 `json:"api_name"`
	Params  map[string]interface{} `json:"params"`
}

// AkshareResponse 响应结构
type AkshareResponse struct {
	Code    int             `json:"code"`
	Msg     string          `json:"msg"`
	Data    json.RawMessage `json:"data"`
}

// NewAkshareProxySource 创建Akshare代理数据源
func NewAkshareProxySource(proxyURL string) *AkshareProxySource {
	return &AkshareProxySource{
		proxyURL: proxyURL,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (a *AkshareProxySource) GetName() string {
	return "akshare"
}

func (a *AkshareProxySource) IsAvailable() bool {
	// 简单健康检查
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	req, _ := http.NewRequestWithContext(ctx, "GET", a.proxyURL+"/health", nil)
	resp, err := a.httpClient.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()

	return resp.StatusCode == 200
}

// GetKLine 获取K线数据
func (a *AkshareProxySource) GetKLine(ctx context.Context, code string, days int) ([]model.KLine, error) {
	req := AkshareRequest{
		APIName: "stock_zh_a_hist",
		Params: map[string]interface{}{
			"symbol": code,
			"period": "daily",
			"start_date": time.Now().AddDate(0, 0, -days).Format("20060102"),
			"end_date":   time.Now().Format("20060102"),
		},
	}

	resp, err := a.callProxy(ctx, "/api/kline", req)
	if err != nil {
		return nil, err
	}

	// 解析Akshare返回的数据格式
	var akData []struct {
		Date   string  `json:"日期"`
		Open   float64 `json:"开盘"`
		Close  float64 `json:"收盘"`
		High   float64 `json:"最高"`
		Low    float64 `json:"最低"`
		Volume float64 `json:"成交量"`
		Amount float64 `json:"成交额"`
	}

	if err := json.Unmarshal(resp.Data, &akData); err != nil {
		return nil, err
	}

	var klines []model.KLine
	for _, d := range akData {
		klines = append(klines, model.KLine{
			Code:   code,
			Date:   parseCNDate(d.Date),
			Open:   d.Open,
			High:   d.High,
			Low:    d.Low,
			Close:  d.Close,
			Volume: d.Volume,
			Amount: d.Amount,
			Source: "akshare",
		})
	}

	return klines, nil
}

// GetStockBasic 获取股票基本信息
func (a *AkshareProxySource) GetStockBasic(ctx context.Context, code string) (*model.Stock, error) {
	req := AkshareRequest{
		APIName: "stock_individual_info_em",
		Params: map[string]interface{}{
			"symbol": code,
		},
	}

	resp, err := a.callProxy(ctx, "/api/stock/info", req)
	if err != nil {
		return nil, err
	}

	var info map[string]string
	if err := json.Unmarshal(resp.Data, &info); err != nil {
		return nil, err
	}

	return &model.Stock{
		Code: code,
		Name: info["股票简称"],
	}, nil
}

// GetRealtimeQuote 获取实时行情
func (a *AkshareProxySource) GetRealtimeQuote(ctx context.Context, codes []string) ([]model.Quote, error) {
	req := AkshareRequest{
		APIName: "stock_bid_ask_em",
		Params: map[string]interface{}{
			"codes": codes,
		},
	}

	resp, err := a.callProxy(ctx, "/api/quote/realtime", req)
	if err != nil {
		return nil, err
	}

	var quotes []model.Quote
	if err := json.Unmarshal(resp.Data, &quotes); err != nil {
		return nil, err
	}

	// 补充数据来源
	for i := range quotes {
		quotes[i].Source = "akshare"
	}

	return quotes, nil
}

// callProxy 调用Python代理服务
func (a *AkshareProxySource) callProxy(ctx context.Context, path string, req AkshareRequest) (*AkshareResponse, error) {
	jsonData, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", a.proxyURL+path, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, err
	}

	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := a.httpClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var akResp AkshareResponse
	if err := json.NewDecoder(resp.Body).Decode(&akResp); err != nil {
		return nil, err
	}

	if akResp.Code != 0 {
		return nil, fmt.Errorf("akshare proxy error: %s", akResp.Msg)
	}

	return &akResp, nil
}

// parseCNDate 解析中文日期格式
func parseCNDate(dateStr string) time.Time {
	// 尝试多种格式
	formats := []string{
		"2006-01-02",
		"2006/01/02",
		"20060102",
	}

	for _, f := range formats {
		if t, err := time.Parse(f, dateStr); err == nil {
			return t
		}
	}

	return time.Now()
}
