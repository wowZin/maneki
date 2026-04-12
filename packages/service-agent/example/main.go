package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"strings"

	"maneki/packages/service-agent"
	"maneki/packages/service-agent/core"
	"maneki/packages/service-agent/specialized"
)

func main() {
	// 从环境变量获取API Key
	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey == "" {
		log.Println("警告: OPENAI_API_KEY 未设置，使用模拟模式")
		apiKey = "dummy-key"
	}

	ctx := context.Background()

	// 创建LLM客户端
	llmClient := agent.NewOpenAIClient(apiKey, "gpt-4o-mini")

	fmt.Println(strings.Repeat("=", 60))
	fmt.Println("Go Agent 框架示例")
	fmt.Println(strings.Repeat("=", 60))

	// 示例1: 单个Agent使用
	fmt.Println("\n【示例1】单个Agent分析")
	fmt.Println(strings.Repeat("-", 40))

	sentimentAgent := specialized.NewSentimentAgent(llmClient)
	input := agent.AgentInput{
		StockCodes:    []string{"000001.SZ"},
		MarketContext: map[string]interface{}{"market_sentiment": "bullish"},
	}

	output, err := sentimentAgent.Run(ctx, input)
	if err != nil {
		log.Printf("Agent执行失败: %v", err)
	} else {
		fmt.Printf("Agent: %s\n", output.AgentName)
		fmt.Printf("股票数: %d\n", len(output.Decisions))
		for _, d := range output.Decisions {
			fmt.Printf("  %s: %s (置信度: %.0f%%)\n", d.StockCode, d.Decision, d.Confidence*100)
			fmt.Printf("  理由: %s\n", d.Reasoning)
		}
	}

	// 示例2: 多Agent协调器
	fmt.Println("\n【示例2】多Agent协调分析")
	fmt.Println(strings.Repeat("-", 40))

	// 创建协调器
	coordinator := agent.NewMultiAgentCoordinator(llmClient, nil)

	// 注册多个Agent
	coordinator.RegisterAgent(specialized.NewSentimentAgent(llmClient))
	coordinator.RegisterAgent(specialized.NewTechnicalAgent(llmClient))
	coordinator.RegisterAgent(specialized.NewCapitalAgent(llmClient))

	// 执行多Agent分析
	multiInput := agent.AgentInput{
		StockCodes: []string{"000001.SZ", "600519.SH"},
	}

	results, err := coordinator.Analyze(ctx, multiInput)
	if err != nil {
		log.Fatalf("多Agent分析失败: %v", err)
	}

	// 输出结果
	for code, result := range results {
		fmt.Printf("\n股票: %s\n", code)
		fmt.Printf("最终决策: %s (置信度: %.0f%%)\n", result.FinalDecision, result.FinalConfidence*100)
		fmt.Printf("看涨Agent: %v\n", result.GetBullishAgents())
		fmt.Printf("看跌Agent: %v\n", result.GetBearishAgents())

		fmt.Println("各Agent详细结果:")
		for agentType, decision := range result.AgentResults {
			fmt.Printf("  [%s] %s (%.0f%%)\n", agentType, decision.Decision, decision.Confidence*100)
		}
	}

	// 示例3: 工具使用
	fmt.Println("\n【示例3】工具使用")
	fmt.Println(strings.Repeat("-", 40))

	registry := core.NewToolRegistry()
	agent.RegisterDefaultTools(registry)

	fmt.Printf("已注册 %d 个工具:\n", len(registry.GetDefinitions()))
	for _, def := range registry.GetDefinitions() {
		fmt.Printf("  - %s: %s\n", def.Name, def.Description)
	}

	fmt.Println("\n" + strings.Repeat("=", 60))
	fmt.Println("示例完成!")
	fmt.Println(strings.Repeat("=", 60))
}
