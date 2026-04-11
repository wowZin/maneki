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

const (
	TushareAPIURL = "https://api.tushare.pro"
)

// TushareSource Tushare数据源
type TushareSource struct {
	token      string
	httpClient *http.Client
}

// TushareRequest Tushare API请求结构
type TushareRequest struct {
	APIName string                 `json:"api_name"`
	Token   string                 `json:"token"`
	Params  map[string]interface{} `json:"params"`
	Fields  string                 `json:"fields,omitempty"`
}

// TushareResponse Tushare API响应结构
type TushareResponse struct {
	Code int    `json:"code"`
	Msg  string `json:"msg"`
	Data struct {
		Fields []string        `json:"fields"`
		Items  [][]interface{} `json:"items"`
	} `json:"data"`
}

// NewTushareSource 创建Tushare数据源
func NewTushareSource(token string) *TushareSource {
	return &TushareSource{
		token: token,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (t *TushareSource) GetName() string {
	return "tushare"
}

func (t *TushareSource) IsAvailable() bool {
	return t.token != ""
}

// GetKLine 获取K线数据
func (t *TushareSource) GetKLine(ctx context.Context, code string, days int) ([]model.KLine, error) {
	// 转换股票代码格式 (000001.SZ)
	tsCode := t.toTSCode(code)

	// 计算开始日期
	endDate := time.Now().Format("20060102")
	startDate := time.Now().AddDate(0, 0, -days).Format("20060102")

	req := TushareRequest{
		APIName: "daily",
		Token:   t.token,
		Params: map[string]interface{}{
			"ts_code":    tsCode,
			"start_date": startDate,
			"end_date":   endDate,
		},
		Fields: "ts_code,trade_date,open,high,low,close,vol,amount",
	}

	resp, err := t.callAPI(ctx, req)
	if err != nil {
		return nil, err
	}

	return t.parseKLines(resp, code)
}

// GetStockBasic 获取股票基本信息
func (t *TushareSource) GetStockBasic(ctx context.Context, code string) (*model.Stock, error) {
	tsCode := t.toTSCode(code)

	req := TushareRequest{
		APIName: "stock_basic",
		Token:   t.token,
		Params: map[string]interface{}{
			"ts_code": tsCode,
		},
		Fields: "ts_code,symbol,name,area,industry,list_date",
	}

	resp, err := t.callAPI(ctx, req)
	if err != nil {
		return nil, err
	}

	if len(resp.Data.Items) == 0 {
		return nil, fmt.Errorf("stock not found")
	}

	item := resp.Data.Items[0]
	return &model.Stock{
		Code:     code,
		Name:     getString(item, 2),
		Industry: getString(item, 4),
		Area:     getString(item, 3),
	}, nil
}

// GetRealtimeQuote 获取实时行情
func (t *TushareSource) GetRealtimeQuote(ctx context.Context, codes []string) ([]model.Quote, error) {
	// Tushare Pro 需要付费权限才能获取实时行情
	// 这里使用最新日K线模拟
	var quotes []model.Quote

	for _, code := range codes {
		klines, err := t.GetKLine(ctx, code, 1)
		if err != nil {
			continue
		}
		if len(klines) > 0 {
			k := klines[0]
			quotes = append(quotes, model.Quote{
				Code:  code,
				Price: k.Close,
				Volume: k.Volume,
				Time:  time.Now(),
			})
		}
	}

	return quotes, nil
}

// callAPI 调用Tushare API
func (t *TushareSource) callAPI(ctx context.Context, req TushareRequest) (*TushareResponse, error) {
	jsonData, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", TushareAPIURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, err
	}

	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := t.httpClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var tushareResp TushareResponse
	if err := json.NewDecoder(resp.Body).Decode(&tushareResp); err != nil {
		return nil, err
	}

	if tushareResp.Code != 0 {
		return nil, fmt.Errorf("tushare API error: %s", tushareResp.Msg)
	}

	return &tushareResp, nil
}

// parseKLines 解析K线数据
func (t *TushareSource) parseKLines(resp *TushareResponse, code string) ([]model.KLine, error) {
	var klines []model.KLine

	for _, item := range resp.Data.Items {
		kline := model.KLine{
			Code:   code,
			Date:   parseDate(getString(item, 1)),
			Open:   getFloat64(item, 2),
			High:   getFloat64(item, 3),
			Low:    getFloat64(item, 4),
			Close:  getFloat64(item, 5),
			Volume: getFloat64(item, 6),
			Amount: getFloat64(item, 7),
			Source: "tushare",
		}
		klines = append(klines, kline)
	}

	return klines, nil
}

// toTSCode 转换为Tushare代码格式
func (t *TushareSource) toTSCode(code string) string {
	// 简单判断：0/3开头是深圳，6开头是上海
	if len(code) >= 1 {
		switch code[0] {
		case '0', '3':
			return code + ".SZ"
		case '6':
			return code + ".SH"
		}
	}
	return code
}

// 辅助函数
func getString(item []interface{}, index int) string {
	if index < len(item) {
		if s, ok := item[index].(string); ok {
			return s
		}
	}
	return ""
}

func getFloat64(item []interface{}, index int) float64 {
	if index < len(item) {
		switch v := item[index].(type) {
		case float64:
			return v
		case int:
			return float64(v)
		case string:
			var f float64
			fmt.Sscanf(v, "%f", &f)
			return f
		}
	}
	return 0
}

func parseDate(dateStr string) time.Time {
	t, _ := time.Parse("20060102", dateStr)
	return t
}
