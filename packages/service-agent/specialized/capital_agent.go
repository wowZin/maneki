package specialized

import (
	"context"
	"fmt"
	"time"

	"maneki/packages/service-agent/core"
	"maneki/packages/service-agent/prompts"
)

// CapitalAgent 资金Agent
type CapitalAgent struct {
	core.BaseAgent
}

// NewCapitalAgent 创建资金Agent
func NewCapitalAgent(llmClient core.LLMClient) *CapitalAgent {
	return &CapitalAgent{
		BaseAgent: core.BaseAgent{
			Name:        "资金Agent",
			AgentType:   "capital",
			Version:     "1.0.0",
			Description: "分析资金流向、主力动向、龙虎榜数据",
			LLMClient:   llmClient,
		},
	}
}

// GetSystemPrompt 获取系统提示词
func (a *CapitalAgent) GetSystemPrompt() string {
	return prompts.CapitalSystemPrompt
}

// Run 执行Agent分析
func (a *CapitalAgent) Run(ctx context.Context, input core.AgentInput) (*core.AgentOutput, error) {
	startTime := time.Now()

	// 收集信息
	information, err := a.gatherInformation(ctx, input.StockCodes)
	if err != nil {
		return nil, fmt.Errorf("failed to gather information: %w", err)
	}

	// 构建用户提示词
	userPrompt := a.buildUserPrompt(input.StockCodes, information)

	// 调用LLM进行分析
	outputSchema := `{
  "decision": "strong_buy|buy|hold|sell|strong_sell|abstain",
  "confidence": 0.88,
  "reasoning": "分析理由",
  "signals": ["信号1", "信号2"],
  "risk_factors": ["风险1", "风险2"]
}`

	result, err := a.LLMClient.StructuredOutput(ctx, a.GetSystemPrompt(), userPrompt, outputSchema)
	if err != nil {
		return nil, fmt.Errorf("llm analysis failed: %w", err)
	}

	// 解析决策结果
	decisions := a.parseDecisions(input.StockCodes, result)

	return &core.AgentOutput{
		AgentName: a.Name,
		AgentType: a.AgentType,
		RequestID: input.RequestID,
		Timestamp: time.Now(),
		Decisions: decisions,
		Metadata: map[string]interface{}{
			"processing_time_seconds": time.Since(startTime).Seconds(),
			"stock_count":             len(input.StockCodes),
		},
	}, nil
}

// gatherInformation 收集资金相关信息
func (a *CapitalAgent) gatherInformation(ctx context.Context, stockCodes []string) (map[string]interface{}, error) {
	information := make(map[string]interface{})

	for _, code := range stockCodes {
		capitalInfo := map[string]interface{}{
			"stock_code": code,
			"capital_flow": map[string]interface{}{
				"net_inflow_5d":           80000000,
				"net_inflow_10d":          120000000,
				"big_order_ratio":         0.65,
				"consecutive_inflow_days": 3,
				"turnover_rate":           0.18,
				"volume_ratio":            3.2,
				"limit_up_bid_amount":     200000000,
			},
			"dragon_list": map[string]interface{}{
				"on_list":          true,
				"famous_youzi":     []string{"章盟主", "方新侠"},
				"institution_buy":  80000000,
				"institution_sell": 20000000,
				"buy_sell_ratio":   2.5,
				"max_buy_ratio":    0.25,
			},
			"main_holders": map[string]interface{}{
				"avg_cost":           15.5,
				"current_price":      18.2,
				"profit_ratio":       0.17,
				"chip_concentration": 0.35,
			},
		}
		information[code] = capitalInfo
	}

	return information, nil
}

// buildUserPrompt 构建用户提示词
func (a *CapitalAgent) buildUserPrompt(stockCodes []string, information map[string]interface{}) string {
	prompt := fmt.Sprintf("请分析以下 %d 只股票的资金面情况：\n\n", len(stockCodes))

	for _, code := range stockCodes {
		info, ok := information[code].(map[string]interface{})
		if !ok {
			continue
		}

		prompt += fmt.Sprintf("股票代码: %s\n", code)

		// 添加资金流向
		if flow, ok := info["capital_flow"].(map[string]interface{}); ok {
			prompt += fmt.Sprintf("资金流向: 近5日净流入=%.0f万, 大单占比=%.0f%%\n",
				flow["net_inflow_5d"].(float64)/10000,
				flow["big_order_ratio"].(float64)*100)
		}

		// 添加龙虎榜
		if dragon, ok := info["dragon_list"].(map[string]interface{}); ok {
			if onList, _ := dragon["on_list"].(bool); onList {
				famousYouzi, _ := dragon["famous_youzi"].([]string)
				instBuy, _ := dragon["institution_buy"].(float64)
				prompt += fmt.Sprintf("龙虎榜: 知名游资=%v, 机构买入=%.0f万\n",
					famousYouzi, instBuy/10000)
			}
		}

		// 添加主力持仓
		if holders, ok := info["main_holders"].(map[string]interface{}); ok {
			prompt += fmt.Sprintf("主力持仓: 成本=%.2f, 当前价=%.2f, 获利比例=%.1f%%\n",
				holders["avg_cost"], holders["current_price"],
				holders["profit_ratio"].(float64)*100)
		}

		prompt += "\n"
	}

	prompt += "请为每只股票给出资金分析决策，以JSON数组格式返回。"

	return prompt
}

// parseDecisions 解析决策结果
func (a *CapitalAgent) parseDecisions(stockCodes []string, result map[string]interface{}) []core.AgentDecision {
	decisions, ok := result["decisions"].([]interface{})
	if !ok {
		return []core.AgentDecision{a.parseSingleDecision(stockCodes[0], result)}
	}

	agentDecisions := make([]core.AgentDecision, 0, len(decisions))
	for i, d := range decisions {
		if decisionMap, ok := d.(map[string]interface{}); ok && i < len(stockCodes) {
			agentDecisions = append(agentDecisions, a.parseSingleDecision(stockCodes[i], decisionMap))
		}
	}

	if len(agentDecisions) == 0 {
		for _, code := range stockCodes {
			agentDecisions = append(agentDecisions, core.AgentDecision{
				StockCode:  code,
				Decision:   core.DecisionHold,
				Confidence: 0.5,
				Reasoning:  "资金分析数据不足，建议观望",
			})
		}
	}

	return agentDecisions
}

// parseSingleDecision 解析单条决策
func (a *CapitalAgent) parseSingleDecision(stockCode string, data map[string]interface{}) core.AgentDecision {
	decision := core.AgentDecision{
		StockCode:   stockCode,
		TimeHorizon: "short",
	}

	if d, ok := data["decision"].(string); ok {
		decision.Decision = core.DecisionType(d)
	}
	if c, ok := data["confidence"].(float64); ok {
		decision.Confidence = c
	}
	if r, ok := data["reasoning"].(string); ok {
		decision.Reasoning = r
	}
	if s, ok := data["signals"].([]interface{}); ok {
		for _, signal := range s {
			if str, ok := signal.(string); ok {
				decision.Signals = append(decision.Signals, str)
			}
		}
	}
	if r, ok := data["risk_factors"].([]interface{}); ok {
		for _, risk := range r {
			if str, ok := risk.(string); ok {
				decision.RiskFactors = append(decision.RiskFactors, str)
			}
		}
	}

	return decision
}
