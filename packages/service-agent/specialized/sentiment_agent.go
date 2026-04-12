package specialized

import (
	"context"
	"fmt"
	"time"

	"maneki/packages/service-agent/core"
	"maneki/packages/service-agent/prompts"
)

// SentimentAgent 情绪Agent
type SentimentAgent struct {
	core.BaseAgent
	toolRegistry *core.ToolRegistry
}

// NewSentimentAgent 创建情绪Agent
func NewSentimentAgent(llmClient core.LLMClient) *SentimentAgent {
	return &SentimentAgent{
		BaseAgent: core.BaseAgent{
			Name:        "情绪Agent",
			AgentType:   "sentiment",
			Version:     "1.0.0",
			Description: "分析市场情绪、新闻资讯、舆情热度",
			LLMClient:   llmClient,
		},
		toolRegistry: core.NewToolRegistry(),
	}
}

// GetSystemPrompt 获取系统提示词
func (a *SentimentAgent) GetSystemPrompt() string {
	return prompts.SentimentSystemPrompt
}

// Run 执行Agent分析
func (a *SentimentAgent) Run(ctx context.Context, input core.AgentInput) (*core.AgentOutput, error) {
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
  "confidence": 0.85,
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

// gatherInformation 收集情绪相关信息
func (a *SentimentAgent) gatherInformation(ctx context.Context, stockCodes []string) (map[string]interface{}, error) {
	information := make(map[string]interface{})

	for _, code := range stockCodes {
		stockInfo := map[string]interface{}{
			"stock_code": code,
			"news": []map[string]interface{}{
				{"title": "公司发布重大利好", "sentiment": "positive", "importance": 0.9},
				{"title": "行业政策支持力度加大", "sentiment": "positive", "importance": 0.8},
			},
			"social_sentiment": map[string]interface{}{
				"sentiment_score": 0.75,
				"heat_score":      0.82,
				"mention_count":   1500,
			},
			"sector_sentiment": map[string]interface{}{
				"name":       "科技",
				"sentiment":  0.72,
				"change_pct": 3.5,
				"rank":       2,
			},
		}
		information[code] = stockInfo
	}

	return information, nil
}

// buildUserPrompt 构建用户提示词
func (a *SentimentAgent) buildUserPrompt(stockCodes []string, information map[string]interface{}) string {
	prompt := fmt.Sprintf("请分析以下 %d 只股票的情绪面情况：\n\n", len(stockCodes))

	for _, code := range stockCodes {
		info, ok := information[code].(map[string]interface{})
		if !ok {
			continue
		}

		prompt += fmt.Sprintf("股票代码: %s\n", code)

		// 添加新闻信息
		if news, ok := info["news"].([]map[string]interface{}); ok && len(news) > 0 {
			prompt += "相关新闻:\n"
			for _, n := range news[:2] {
				prompt += fmt.Sprintf("  - %s (情绪: %s, 重要性: %.1f)\n",
					n["title"], n["sentiment"], n["importance"])
			}
		}

		// 添加社交媒体情绪
		if social, ok := info["social_sentiment"].(map[string]interface{}); ok {
			prompt += fmt.Sprintf("社交媒体情绪: %.2f (热度: %.2f)\n",
				social["sentiment_score"], social["heat_score"])
		}

		// 添加板块情绪
		if sector, ok := info["sector_sentiment"].(map[string]interface{}); ok {
			prompt += fmt.Sprintf("所属板块: %s (情绪: %.2f, 涨幅: %.1f%%)\n",
				sector["name"], sector["sentiment"], sector["change_pct"])
		}

		prompt += "\n"
	}

	prompt += "请为每只股票给出情绪分析决策，以JSON数组格式返回。"

	return prompt
}

// parseDecisions 解析LLM返回的决策结果
func (a *SentimentAgent) parseDecisions(stockCodes []string, result map[string]interface{}) []core.AgentDecision {
	// 尝试解析为数组
	decisions, ok := result["decisions"].([]interface{})
	if !ok {
		// 单条结果
		return []core.AgentDecision{a.parseSingleDecision(stockCodes[0], result)}
	}

	agentDecisions := make([]core.AgentDecision, 0, len(decisions))
	for i, d := range decisions {
		if decisionMap, ok := d.(map[string]interface{}); ok {
			code := stockCodes[i]
			if i < len(stockCodes) {
				code = stockCodes[i]
			}
			agentDecisions = append(agentDecisions, a.parseSingleDecision(code, decisionMap))
		}
	}

	// 如果解析失败，为所有股票生成默认决策
	if len(agentDecisions) == 0 {
		for _, code := range stockCodes {
			agentDecisions = append(agentDecisions, core.AgentDecision{
				StockCode:  code,
				Decision:   core.DecisionHold,
				Confidence: 0.5,
				Reasoning:  "情绪分析数据不足，建议观望",
			})
		}
	}

	return agentDecisions
}

// parseSingleDecision 解析单条决策
func (a *SentimentAgent) parseSingleDecision(stockCode string, data map[string]interface{}) core.AgentDecision {
	decision := core.AgentDecision{
		StockCode:   stockCode,
		TimeHorizon: "short",
	}

	// 解析决策类型
	if d, ok := data["decision"].(string); ok {
		decision.Decision = core.DecisionType(d)
	}

	// 解析置信度
	if c, ok := data["confidence"].(float64); ok {
		decision.Confidence = c
	}

	// 解析理由
	if r, ok := data["reasoning"].(string); ok {
		decision.Reasoning = r
	}

	// 解析信号
	if s, ok := data["signals"].([]interface{}); ok {
		for _, signal := range s {
			if str, ok := signal.(string); ok {
				decision.Signals = append(decision.Signals, str)
			}
		}
	}

	// 解析风险因素
	if r, ok := data["risk_factors"].([]interface{}); ok {
		for _, risk := range r {
			if str, ok := risk.(string); ok {
				decision.RiskFactors = append(decision.RiskFactors, str)
			}
		}
	}

	return decision
}
