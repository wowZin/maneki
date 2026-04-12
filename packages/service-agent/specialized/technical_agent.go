package specialized

import (
	"context"
	"fmt"
	"time"

	"maneki/packages/service-agent/core"
	"maneki/packages/service-agent/prompts"
)

// TechnicalAgent 技术Agent
type TechnicalAgent struct {
	core.BaseAgent
}

// NewTechnicalAgent 创建技术Agent
func NewTechnicalAgent(llmClient core.LLMClient) *TechnicalAgent {
	return &TechnicalAgent{
		BaseAgent: core.BaseAgent{
			Name:        "技术Agent",
			AgentType:   "technical",
			Version:     "1.0.0",
			Description: "分析技术指标、K线形态、量价关系",
			LLMClient:   llmClient,
		},
	}
}

// GetSystemPrompt 获取系统提示词
func (a *TechnicalAgent) GetSystemPrompt() string {
	return prompts.TechnicalSystemPrompt
}

// Run 执行Agent分析
func (a *TechnicalAgent) Run(ctx context.Context, input core.AgentInput) (*core.AgentOutput, error) {
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
  "confidence": 0.82,
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

// gatherInformation 收集技术相关信息
func (a *TechnicalAgent) gatherInformation(ctx context.Context, stockCodes []string) (map[string]interface{}, error) {
	information := make(map[string]interface{})

	for _, code := range stockCodes {
		techInfo := map[string]interface{}{
			"stock_code": code,
			"kline": map[string]interface{}{
				"limit_up_type":      "早盘板",
				"has_upper_shadow":   false,
				"consecutive_limits": 1,
				"price_position":     "low",
				"trend_angle":        30,
			},
			"indicators": map[string]interface{}{
				"ma_trend": "bullish",
				"macd": map[string]interface{}{
					"signal": "golden_cross",
					"diff":   0.5,
					"dea":    0.3,
				},
				"kdj": map[string]interface{}{
					"k": 65,
					"d": 55,
					"j": 85,
				},
				"rsi": 60,
			},
			"volume": map[string]interface{}{
				"turnover_rate":       0.15,
				"volume_ratio":        2.5,
				"limit_up_bid_amount": 150000000,
			},
		}
		information[code] = techInfo
	}

	return information, nil
}

// buildUserPrompt 构建用户提示词
func (a *TechnicalAgent) buildUserPrompt(stockCodes []string, information map[string]interface{}) string {
	prompt := fmt.Sprintf("请分析以下 %d 只股票的技术面情况：\n\n", len(stockCodes))

	for _, code := range stockCodes {
		info, ok := information[code].(map[string]interface{})
		if !ok {
			continue
		}

		prompt += fmt.Sprintf("股票代码: %s\n", code)

		// 添加K线信息
		if kline, ok := info["kline"].(map[string]interface{}); ok {
			prompt += fmt.Sprintf("K线形态: %s, 连板数: %.0f, 位置: %s\n",
				kline["limit_up_type"], kline["consecutive_limits"], kline["price_position"])
		}

		// 添加技术指标
		if indicators, ok := info["indicators"].(map[string]interface{}); ok {
			prompt += fmt.Sprintf("技术指标: 均线趋势=%s, RSI=%.0f\n",
				indicators["ma_trend"], indicators["rsi"])
		}

		// 添加成交量信息
		if volume, ok := info["volume"].(map[string]interface{}); ok {
			prompt += fmt.Sprintf("成交量: 换手率=%.1f%%, 量比=%.1f, 涨停封单=%.0f万\n",
				volume["turnover_rate"].(float64)*100,
				volume["volume_ratio"],
				volume["limit_up_bid_amount"].(float64)/10000)
		}

		prompt += "\n"
	}

	prompt += "请为每只股票给出技术分析决策，以JSON数组格式返回。"

	return prompt
}

// parseDecisions 解析决策结果
func (a *TechnicalAgent) parseDecisions(stockCodes []string, result map[string]interface{}) []core.AgentDecision {
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
				Reasoning:  "技术分析数据不足，建议观望",
			})
		}
	}

	return agentDecisions
}

// parseSingleDecision 解析单条决策
func (a *TechnicalAgent) parseSingleDecision(stockCode string, data map[string]interface{}) core.AgentDecision {
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
