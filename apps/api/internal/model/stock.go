package model

import (
	"time"
)

// Stock 股票基本信息
type Stock struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	Code      string    `json:"code" gorm:"index;size:20"`      // 股票代码
	Name      string    `json:"name" gorm:"size:100"`           // 股票名称
	Industry  string    `json:"industry" gorm:"size:50"`        // 所属行业
	Area      string    `json:"area" gorm:"size:50"`            // 地区
	ListDate  time.Time `json:"list_date"`                      // 上市日期
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (Stock) TableName() string {
	return "stocks"
}

// KLine K线数据
type KLine struct {
	ID     uint      `json:"id" gorm:"primaryKey"`
	Code   string    `json:"code" gorm:"index:idx_code_date;size:20"` // 股票代码
	Date   time.Time `json:"date" gorm:"index:idx_code_date"`         // 日期
	Open   float64   `json:"open"`                                    // 开盘价
	High   float64   `json:"high"`                                    // 最高价
	Low    float64   `json:"low"`                                     // 最低价
	Close  float64   `json:"close"`                                   // 收盘价
	Volume float64   `json:"volume"`                                  // 成交量
	Amount float64   `json:"amount"`                                  // 成交额
	Source string    `json:"source" gorm:"size:20"`                   // 数据来源
}

func (KLine) TableName() string {
	return "kline_1d" // 日线数据表，使用TimescaleDB hypertable
}

// Quote 实时行情
type Quote struct {
	Code      string    `json:"code"`
	Name      string    `json:"name"`
	Price     float64   `json:"price"`      // 当前价格
	Change    float64   `json:"change"`     // 涨跌额
	ChangePct float64   `json:"change_pct"` // 涨跌幅
	Volume    float64   `json:"volume"`     // 成交量
	Amount    float64   `json:"amount"`     // 成交额
	Bid       float64   `json:"bid"`        // 买一价
	Ask       float64   `json:"ask"`        // 卖一价
	Time      time.Time `json:"time"`
	Source    string    `json:"source"`
}
