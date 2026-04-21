package model

import (
	"time"
)

// TopList 龙虎榜数据模型
type TopList struct {
	ID           uint      `json:"id" gorm:"primaryKey"`
	TradeDate    string    `json:"trade_date" gorm:"size:8;index;index:idx_code_date"` // 交易日期 YYYYMMDD
	TSCode       string    `json:"ts_code" gorm:"size:20;index;index:idx_code_date"`   // 股票代码
	Name         string    `json:"name" gorm:"size:100"`                               // 股票名称
	Close        float64   `json:"close"`                                              // 收盘价
	PctChange    float64   `json:"pct_change"`                                         // 涨跌幅
	Turnover     float64   `json:"turnover"`                                           // 换手率
	Amount       float64   `json:"amount"`                                             // 龙虎榜成交额
	NetBuyAmount float64   `json:"net_buy_amount"`                                     // 龙虎榜净买入额
	NetSellAmount float64  `json:"net_sell_amount"`                                    // 龙虎榜净卖出额
	Reason       string    `json:"reason" gorm:"size:500"`                             // 上榜原因
	Source       string    `json:"source" gorm:"size:50;index"`                        // 数据来源
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

func (TopList) TableName() string {
	return "top_list"
}

// ToResponse 转换为响应格式
func (t *TopList) ToResponse() map[string]interface{} {
	return map[string]interface{}{
		"id":              t.ID,
		"trade_date":      formatDate(t.TradeDate),
		"ts_code":         t.TSCode,
		"name":            t.Name,
		"close":           t.Close,
		"pct_change":      t.PctChange,
		"turnover":        t.Turnover,
		"amount":          t.Amount,
		"net_buy_amount":  t.NetBuyAmount,
		"net_sell_amount": t.NetSellAmount,
		"reason":          t.Reason,
		"source":          t.Source,
	}
}

// formatDate 将 YYYYMMDD 格式化为 YYYY-MM-dd
func formatDate(date string) string {
	if len(date) != 8 {
		return date
	}
	return date[:4] + "-" + date[4:6] + "-" + date[6:]
}
