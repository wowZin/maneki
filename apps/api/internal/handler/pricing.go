package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// PricingHandler 定价处理器
type PricingHandler struct{}

// NewPricingHandler 创建定价处理器
func NewPricingHandler() *PricingHandler {
	return &PricingHandler{}
}

// PriceDetail 价格详情
type PriceDetail struct {
	OriginalPrice   float64 `json:"original_price"`
	DiscountedPrice float64 `json:"discounted_price"`
	DiscountRate    float64 `json:"discount_rate"`
	DiscountLabel   string  `json:"discount_label"`
	SaveAmount      float64 `json:"save_amount"`
}

// MembershipPlan 会员方案
type MembershipPlan struct {
	Tier        string                     `json:"tier"`
	Name        string                     `json:"name"`
	Description string                     `json:"description"`
	Icon        string                     `json:"icon"`
	Color       string                     `json:"color"`
	Badge       string                     `json:"badge,omitempty"`
	Features    []string                   `json:"features"`
	Highlights  []string                   `json:"highlights"`
	Prices      map[string]PriceDetail     `json:"prices"`
	IsPopular   bool                       `json:"is_popular"`
}

// PricingConfigResponse 定价配置响应
type PricingConfigResponse struct {
	Plans           []MembershipPlan `json:"plans"`
	Cycles          []CycleInfo      `json:"cycles"`
	GlobalDiscount  *GlobalDiscount  `json:"global_discount,omitempty"`
}

// CycleInfo 计费周期信息
type CycleInfo struct {
	Cycle   string `json:"cycle"`
	Label   string `json:"label"`
	Unit    string `json:"unit"`
	Months  int    `json:"months"`
}

// GetPricingConfig 获取定价配置
func (h *PricingHandler) GetPricingConfig(c *gin.Context) {
	config := PricingConfigResponse{
		Plans: []MembershipPlan{
			{
				Tier:        "basic",
				Name:        "基础版",
				Description: "适合个人投资者入门使用",
				Icon:        "star",
				Color:       "blue",
				Features: []string{
					"每日涨停预测信号",
					"基础股票筛选",
					" limited 回测功能",
					"社区讨论访问",
				},
				Highlights: []string{"免费使用"},
				Prices: map[string]PriceDetail{
					"monthly":    {OriginalPrice: 0, DiscountedPrice: 0, DiscountRate: 1, DiscountLabel: "", SaveAmount: 0},
					"quarterly":  {OriginalPrice: 0, DiscountedPrice: 0, DiscountRate: 1, DiscountLabel: "", SaveAmount: 0},
					"yearly":     {OriginalPrice: 0, DiscountedPrice: 0, DiscountRate: 1, DiscountLabel: "", SaveAmount: 0},
				},
				IsPopular: false,
			},
			{
				Tier:        "vip",
				Name:        "VIP会员",
				Description: "解锁全部高级分析功能",
				Icon:        "crown",
				Color:       "gold",
				Badge:       "最受欢迎",
				Features: []string{
					"全部基础版功能",
					"实时涨停信号推送",
					"AI 智能选股策略",
					"无限回测分析",
					"龙虎榜资金流向",
					"游资动向追踪",
					"专属客服支持",
				},
				Highlights: []string{"实时推送", "AI选股"},
				Prices: map[string]PriceDetail{
					"monthly":    {OriginalPrice: 99, DiscountedPrice: 99, DiscountRate: 1, DiscountLabel: "", SaveAmount: 0},
					"quarterly":  {OriginalPrice: 297, DiscountedPrice: 249, DiscountRate: 0.84, DiscountLabel: "84折", SaveAmount: 48},
					"yearly":     {OriginalPrice: 1188, DiscountedPrice: 799, DiscountRate: 0.67, DiscountLabel: "67折", SaveAmount: 389},
				},
				IsPopular: true,
			},
			{
				Tier:        "svip",
				Name:        "SVIP会员",
				Description: "机构级专业分析工具",
				Icon:        "thunderbolt",
				Color:       "purple",
				Features: []string{
					"全部VIP功能",
					"机构专用策略模型",
					"大宗交易监控",
					"主力资金流向分析",
					"产业链关联分析",
					"1对1投资顾问",
					"API接口访问",
					"优先体验新功能",
				},
				Highlights: []string{"机构策略", "1对1顾问"},
				Prices: map[string]PriceDetail{
					"monthly":    {OriginalPrice: 299, DiscountedPrice: 299, DiscountRate: 1, DiscountLabel: "", SaveAmount: 0},
					"quarterly":  {OriginalPrice: 897, DiscountedPrice: 749, DiscountRate: 0.83, DiscountLabel: "83折", SaveAmount: 148},
					"yearly":     {OriginalPrice: 3588, DiscountedPrice: 2399, DiscountRate: 0.67, DiscountLabel: "67折", SaveAmount: 1189},
				},
				IsPopular: false,
			},
		},
		Cycles: []CycleInfo{
			{Cycle: "monthly", Label: "月付", Unit: "/月", Months: 1},
			{Cycle: "quarterly", Label: "季付", Unit: "/季", Months: 3},
			{Cycle: "yearly", Label: "年付", Unit: "/年", Months: 12},
		},
	}

	c.JSON(http.StatusOK, config)
}
