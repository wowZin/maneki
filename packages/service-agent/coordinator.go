package agent

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"maneki/packages/service-agent/core"
)

// MultiAgentCoordinator 多Agent协调器
type MultiAgentCoordinator struct {
	agents    []core.Agent
	llmClient core.LLMClient
	weights   map[string]float64
}

// NewMultiAgentCoordinator 创建多Agent协调器
func NewMultiAgentCoordinator(llmClient core.LLMClient, agentTypes []string) *MultiAgentCoordinator {
	// 默认权重配置
	weights := map[string]float64{
		"sentiment":   0.25,
		"technical":   0.30,
		"capital":     0.30,
		"fundamental": 0.15,
	}

	return &MultiAgentCoordinator{
		agents:    make([]core.Agent, 0),
		llmClient: llmClient,
		weights:   weights,
	}
}

// RegisterAgent 注册Agent
func (c *MultiAgentCoordinator) RegisterAgent(agent core.Agent) {
	c.agents = append(c.agents, agent)
}

// SetWeights 设置权重
func (c *MultiAgentCoordinator) SetWeights(weights map[string]float64) {
	c.weights = weights
}

// Analyze 执行多Agent分析
func (c *MultiAgentCoordinator) Analyze(ctx context.Context, input core.AgentInput) (map[string]*core.MultiAgentResult, error) {
	if len(c.agents) == 0 {
		return nil, fmt.Errorf("no agents registered")
	}

	// 并行执行所有Agent
	results := c.runAgentsParallel(ctx, input)

	// 聚合每个股票的决策
	aggregatedResults := make(map[string]*core.MultiAgentResult)
	for _, stockCode := range input.StockCodes {
		result := c.aggregateDecisions(stockCode, results)
		aggregatedResults[stockCode] = result
	}

	return aggregatedResults, nil
}

// runAgentsParallel 并行执行所有Agent
func (c *MultiAgentCoordinator) runAgentsParallel(ctx context.Context, input core.AgentInput) map[string]*core.AgentOutput {
	results := make(map[string]*core.AgentOutput)
	var mu sync.Mutex
	var wg sync.WaitGroup

	for _, agent := range c.agents {
		wg.Add(1)
		go func(a core.Agent) {
			defer wg.Done()

			output, err := a.Run(ctx, input)
			if err != nil {
				// 记录错误，但不中断其他Agent
				output = &core.AgentOutput{
					AgentName: a.GetName(),
					AgentType: a.GetType(),
					RequestID: input.RequestID,
					Timestamp: time.Now(),
					Decisions: c.createErrorDecisions(input.StockCodes, err),
					Metadata: map[string]interface{}{
						"error": err.Error(),
					},
				}
			}

			mu.Lock()
			results[a.GetType()] = output
			mu.Unlock()
		}(agent)
	}

	wg.Wait()
	return results
}

// createErrorDecisions 创建错误决策
func (c *MultiAgentCoordinator) createErrorDecisions(stockCodes []string, err error) []core.AgentDecision {
	decisions := make([]core.AgentDecision, len(stockCodes))
	for i, code := range stockCodes {
		decisions[i] = core.AgentDecision{
			StockCode:  code,
			Decision:   core.DecisionAbstain,
			Confidence: 0,
			Reasoning:  fmt.Sprintf("Agent执行失败: %v", err),
		}
	}
	return decisions
}

// aggregateDecisions 聚合多个Agent的决策
func (c *MultiAgentCoordinator) aggregateDecisions(stockCode string, agentOutputs map[string]*core.AgentOutput) *core.MultiAgentResult {
	agentResults := make(map[string]core.AgentDecision)

	// 收集各Agent的决策
	for agentType, output := range agentOutputs {
		decision := output.GetDecisionForStock(stockCode)
		if decision != nil {
			agentResults[agentType] = *decision
		}
	}

	// 计算加权分数
	decisionScores := make(map[core.DecisionType]float64)
	totalWeight := 0.0

	for agentType, decision := range agentResults {
		weight := c.weights[agentType]
		if weight == 0 {
			weight = 0.25 // 默认权重
		}

		decisionScores[decision.Decision] += weight * decision.Confidence
		totalWeight += weight
	}

	// 选择得分最高的决策
	var bestDecision core.DecisionType
	bestScore := 0.0

	for decision, score := range decisionScores {
		if score > bestScore {
			bestScore = score
			bestDecision = decision
		}
	}

	// 计算最终置信度
	finalConfidence := c.calculateFinalConfidence(agentResults, bestDecision)

	// 构建综合理由
	reasoning := c.buildAggregatedReasoning(stockCode, agentResults)

	return &core.MultiAgentResult{
		StockCode:         stockCode,
		FinalDecision:     bestDecision,
		FinalConfidence:   finalConfidence,
		AgentResults:      agentResults,
		AggregationMethod: "weighted_voting",
		Reasoning:         reasoning,
		Timestamp:         time.Now(),
	}
}

// calculateFinalConfidence 计算最终置信度
func (c *MultiAgentCoordinator) calculateFinalConfidence(agentResults map[string]core.AgentDecision, finalDecision core.DecisionType) float64 {
	if len(agentResults) == 0 {
		return 0
	}

	// 支持最终决策的Agent的加权置信度
	supportingConfidence := 0.0
	totalWeight := 0.0

	for agentType, decision := range agentResults {
		weight := c.weights[agentType]
		if weight == 0 {
			weight = 0.25
		}
		totalWeight += weight

		// 判断是否支持最终决策
		if isSupporting(decision.Decision, finalDecision) {
			supportingConfidence += weight * decision.Confidence
		}
	}

	if totalWeight > 0 {
		return supportingConfidence / totalWeight
	}
	return 0
}

// isSupporting 判断decision是否支持target决策
func isSupporting(decision, target core.DecisionType) bool {
	// 同向决策视为支持
	bullish := []core.DecisionType{core.DecisionBuy, core.DecisionStrongBuy}
	bearish := []core.DecisionType{core.DecisionSell, core.DecisionStrongSell}
	neutral := []core.DecisionType{core.DecisionHold, core.DecisionAbstain}

	if contains(bullish, target) && contains(bullish, decision) {
		return true
	}
	if contains(bearish, target) && contains(bearish, decision) {
		return true
	}
	if contains(neutral, target) && contains(neutral, decision) {
		return true
	}
	return false
}

// contains 检查切片是否包含元素
func contains(slice []core.DecisionType, item core.DecisionType) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}

// buildAggregatedReasoning 构建综合理由
func (c *MultiAgentCoordinator) buildAggregatedReasoning(stockCode string, agentResults map[string]core.AgentDecision) string {
	var parts []string
	parts = append(parts, fmt.Sprintf("【%s综合分析】", stockCode))

	// 统计各方向
	var bullish, bearish, neutral []string
	for agentType, decision := range agentResults {
		display := fmt.Sprintf("%s(%.0f%%)", agentType, decision.Confidence*100)
		switch decision.Decision {
		case core.DecisionStrongBuy, core.DecisionBuy:
			bullish = append(bullish, display)
		case core.DecisionStrongSell, core.DecisionSell:
			bearish = append(bearish, display)
		default:
			neutral = append(neutral, display)
		}
	}

	if len(bullish) > 0 {
		parts = append(parts, fmt.Sprintf("看涨: %s", strings.Join(bullish, ", ")))
	}
	if len(bearish) > 0 {
		parts = append(parts, fmt.Sprintf("看跌: %s", strings.Join(bearish, ", ")))
	}
	if len(neutral) > 0 {
		parts = append(parts, fmt.Sprintf("观望: %s", strings.Join(neutral, ", ")))
	}

	// 添加各Agent的关键信号
	parts = append(parts, "\n关键信号:")
	for agentType, decision := range agentResults {
		if len(decision.Signals) > 0 {
			signals := strings.Join(decision.Signals[:min(2, len(decision.Signals))], ", ")
			parts = append(parts, fmt.Sprintf("  [%s] %s", agentType, signals))
		}
	}

	return strings.Join(parts, "\n")
}

// min 返回较小值
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// GetAgentInfo 获取Agent信息
func (c *MultiAgentCoordinator) GetAgentInfo() []map[string]string {
	info := make([]map[string]string, len(c.agents))
	for i, agent := range c.agents {
		info[i] = map[string]string{
			"type":        agent.GetType(),
			"name":        agent.GetName(),
			"description": agent.GetDescription(),
		}
	}
	return info
}
