package model

import (
	"time"
)

// TopInst 龙虎榜机构交易名单模型
type TopInst struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	TradeDate string    `json:"trade_date" gorm:"size:8;index;index:idx_code_date_exalter"` // 交易日期 YYYYMMDD
	TSCode    string    `json:"ts_code" gorm:"size:20;index;index:idx_code_date_exalter"`   // 股票代码
	Exalter   string    `json:"exalter" gorm:"size:200;index;index:idx_code_date_exalter"`  // 营业部名称
	Buy       float64   `json:"buy"`                                                          // 买入额(万)
	BuyRate   float64   `json:"buy_rate"`                                                     // 买入占总成交比例
	Sell      float64   `json:"sell"`                                                         // 卖出额(万)
	SellRate  float64   `json:"sell_rate"`                                                    // 卖出占总成交比例
	NetBuy    float64   `json:"net_buy"`                                                      // 净买额(万)
	Side      string    `json:"side" gorm:"size:20"`                                          // 买卖方向
	Reason    string    `json:"reason" gorm:"size:500"`                                       // 上榜原因
	Source    string    `json:"source" gorm:"size:50;index"`                                  // 数据来源
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (TopInst) TableName() string {
	return "top_inst"
}

// ToResponse 转换为响应格式
func (t *TopInst) ToResponse() map[string]interface{} {
	return map[string]interface{}{
		"id":         t.ID,
		"trade_date": formatDate(t.TradeDate),
		"ts_code":    t.TSCode,
		"exalter":    t.Exalter,
		"buy":        t.Buy,
		"buy_rate":   t.BuyRate,
		"sell":       t.Sell,
		"sell_rate":  t.SellRate,
		"net_buy":    t.NetBuy,
		"side":       t.Side,
		"reason":     t.Reason,
		"source":     t.Source,
	}
}
