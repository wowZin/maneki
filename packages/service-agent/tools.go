package agent

import (
	"context"
	"encoding/json"
	"fmt"

	"maneki/packages/service-agent/core"
)

// StockInfoTool 获取股票信息工具
type StockInfoTool struct{}

// GetDefinition 获取工具定义
func (t *StockInfoTool) GetDefinition() core.ToolDefinition {
	return core.ToolDefinition{
		Name:        "get_stock_info",
		Description: "获取股票的基本信息，包括名称、行业、市值等",
		Parameters: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"stock_code": map[string]interface{}{
					"type":        "string",
					"description": "股票代码，如000001.SZ",
				},
			},
			"required": []string{"stock_code"},
		},
	}
}

// Execute 执行工具
func (t *StockInfoTool) Execute(ctx context.Context, args map[string]interface{}) (string, error) {
	stockCode, ok := args["stock_code"].(string)
	if !ok {
		return "", fmt.Errorf("missing required parameter: stock_code")
	}

	// TODO: 接入真实数据源
	info := map[string]interface{}{
		"stock_code": stockCode,
		"name":       "平安银行",
		"industry":   "银行",
		"market_cap": "2000亿",
	}

	data, _ := json.Marshal(info)
	return string(data), nil
}

// NewsTool 获取新闻工具
type NewsTool struct{}

// GetDefinition 获取工具定义
func (t *NewsTool) GetDefinition() core.ToolDefinition {
	return core.ToolDefinition{
		Name:        "get_news",
		Description: "获取股票相关的新闻资讯",
		Parameters: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"stock_code": map[string]interface{}{
					"type":        "string",
					"description": "股票代码",
				},
				"days": map[string]interface{}{
					"type":        "integer",
					"description": "获取最近几天的新闻，默认3天",
				},
			},
			"required": []string{"stock_code"},
		},
	}
}

// Execute 执行工具
func (t *NewsTool) Execute(ctx context.Context, args map[string]interface{}) (string, error) {
	stockCode, _ := args["stock_code"].(string)
	days := 3
	if d, ok := args["days"].(float64); ok {
		days = int(d)
	}

	// TODO: 接入真实数据源
	news := []map[string]interface{}{
		{
			"title":     "平安银行发布2024年业绩预告",
			"date":      "2024-01-15",
			"sentiment": "positive",
		},
		{
			"title":     "银行板块整体上涨",
			"date":      "2024-01-14",
			"sentiment": "neutral",
		},
	}

	data, _ := json.Marshal(map[string]interface{}{
		"stock_code": stockCode,
		"days":       days,
		"news":       news,
	})
	return string(data), nil
}

// KLineTool 获取K线数据工具
type KLineTool struct{}

// GetDefinition 获取工具定义
func (t *KLineTool) GetDefinition() core.ToolDefinition {
	return core.ToolDefinition{
		Name:        "get_kline",
		Description: "获取股票的K线数据（技术指标）",
		Parameters: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"stock_code": map[string]interface{}{
					"type":        "string",
					"description": "股票代码",
				},
				"period": map[string]interface{}{
					"type":        "string",
					"description": "周期：day/week/month，默认day",
				},
				"days": map[string]interface{}{
					"type":        "integer",
					"description": "获取多少天的数据，默认20",
				},
			},
			"required": []string{"stock_code"},
		},
	}
}

// Execute 执行工具
func (t *KLineTool) Execute(ctx context.Context, args map[string]interface{}) (string, error) {
	stockCode, _ := args["stock_code"].(string)

	// TODO: 接入真实数据源
	data := map[string]interface{}{
		"stock_code": stockCode,
		"latest": map[string]interface{}{
			"close":      12.5,
			"change_pct": 5.2,
			"volume":     1000000,
			"turnover":   0.15,
		},
		"indicators": map[string]interface{}{
			"ma5":  12.0,
			"ma10": 11.8,
			"ma20": 11.5,
			"rsi":  65,
			"macd": "golden_cross",
		},
	}

	result, _ := json.Marshal(data)
	return string(result), nil
}

// CapitalFlowTool 获取资金流向工具
type CapitalFlowTool struct{}

// GetDefinition 获取工具定义
func (t *CapitalFlowTool) GetDefinition() core.ToolDefinition {
	return core.ToolDefinition{
		Name:        "get_capital_flow",
		Description: "获取股票的资金流向数据",
		Parameters: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"stock_code": map[string]interface{}{
					"type":        "string",
					"description": "股票代码",
				},
				"days": map[string]interface{}{
					"type":        "integer",
					"description": "获取几天的数据，默认5",
				},
			},
			"required": []string{"stock_code"},
		},
	}
}

// Execute 执行工具
func (t *CapitalFlowTool) Execute(ctx context.Context, args map[string]interface{}) (string, error) {
	stockCode, _ := args["stock_code"].(string)

	// TODO: 接入真实数据源
	data := map[string]interface{}{
		"stock_code":       stockCode,
		"net_inflow_5d":    50000000,
		"main_force_ratio": 0.65,
		"retail_ratio":     0.35,
	}

	result, _ := json.Marshal(data)
	return string(result), nil
}

// DragonListTool 获取龙虎榜工具
type DragonListTool struct{}

// GetDefinition 获取工具定义
func (t *DragonListTool) GetDefinition() core.ToolDefinition {
	return core.ToolDefinition{
		Name:        "get_dragon_list",
		Description: "获取股票的龙虎榜数据",
		Parameters: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"stock_code": map[string]interface{}{
					"type":        "string",
					"description": "股票代码",
				},
			},
			"required": []string{"stock_code"},
		},
	}
}

// Execute 执行工具
func (t *DragonListTool) Execute(ctx context.Context, args map[string]interface{}) (string, error) {
	stockCode, _ := args["stock_code"].(string)

	// TODO: 接入真实数据源
	data := map[string]interface{}{
		"stock_code": stockCode,
		"on_list":    true,
		"buyers": []map[string]interface{}{
			{"seat": "国泰君安上海江苏路", "amount": 50000000},
			{"seat": "机构专用", "amount": 30000000},
		},
	}

	result, _ := json.Marshal(data)
	return string(result), nil
}

// RegisterDefaultTools 注册默认工具
func RegisterDefaultTools(registry *core.ToolRegistry) {
	registry.Register(&StockInfoTool{})
	registry.Register(&NewsTool{})
	registry.Register(&KLineTool{})
	registry.Register(&CapitalFlowTool{})
	registry.Register(&DragonListTool{})
}
