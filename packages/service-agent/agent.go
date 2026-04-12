// Package agent 提供多Agent决策系统
//
// 基础使用示例：
//
//	// 创建LLM客户端
//	llmClient := agent.NewOpenAIClient("your-api-key", "gpt-4o-mini")
//
//	// 创建协调器
//	coordinator := agent.NewMultiAgentCoordinator(llmClient, nil)
//
//	// 注册Agent
//	coordinator.RegisterAgent(specialized.NewSentimentAgent(llmClient))
//	coordinator.RegisterAgent(specialized.NewTechnicalAgent(llmClient))
//	coordinator.RegisterAgent(specialized.NewCapitalAgent(llmClient))
//
//	// 执行分析
//	input := agent.AgentInput{
//	    StockCodes: []string{"000001.SZ", "600519.SH"},
//	}
//	results, err := coordinator.Analyze(ctx, input)
//
// 单个Agent使用：
//
//	import "maneki/packages/service-agent/specialized"
//	agent := specialized.NewSentimentAgent(llmClient)
//	output, err := agent.Run(ctx, input)
//
package agent

import (
	"maneki/packages/service-agent/core"
)

// 导出核心类型
type (
	Agent                = core.Agent
	AgentInput           = core.AgentInput
	AgentOutput          = core.AgentOutput
	AgentDecision        = core.AgentDecision
	DecisionType         = core.DecisionType
	MultiAgentResult     = core.MultiAgentResult
	LLMClient            = core.LLMClient
	Tool                 = core.Tool
	ToolDefinition       = core.ToolDefinition
	ToolCall             = core.ToolCall
	ToolRegistry         = core.ToolRegistry
	Message              = core.Message
	ChatOptions          = core.ChatOptions
	ChatResponse         = core.ChatResponse
	Usage                = core.Usage
	BaseAgent            = core.BaseAgent
)

// 导出决策类型常量
const (
	DecisionStrongBuy  = core.DecisionStrongBuy
	DecisionBuy        = core.DecisionBuy
	DecisionHold       = core.DecisionHold
	DecisionSell       = core.DecisionSell
	DecisionStrongSell = core.DecisionStrongSell
	DecisionAbstain    = core.DecisionAbstain
)
