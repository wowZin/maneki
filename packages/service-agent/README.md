# Agent Service (Go)

轻量级的 Go Agent 服务，支持多 Agent 协同决策，用于股票涨停预测分析。

## 特性

- 🚀 **轻量级**：无外部框架依赖，纯 Go 实现
- 🔧 **可扩展**：易于添加新的 Agent 类型
- 🤖 **LLM 集成**：内置 OpenAI 客户端，支持 Function Call
- ⚡ **并行执行**：多 Agent 并行分析，提高性能
- 📊 **决策聚合**：加权投票算法聚合多 Agent 决策

## 目录结构

```
packages/service-agent/
├── types.go              # 核心类型定义
├── llm.go                # LLM 客户端封装
├── tools.go              # Function Call 工具系统
├── coordinator.go        # 多 Agent 协调器
├── prompts/              # 系统提示词
│   ├── sentiment_prompt.go   # 情绪 Agent 提示词
│   ├── technical_prompt.go   # 技术 Agent 提示词
│   └── capital_prompt.go     # 资金 Agent 提示词
├── specialized/          # 具体 Agent 实现
│   ├── sentiment_agent.go    # 情绪 Agent
│   ├── technical_agent.go    # 技术 Agent
│   └── capital_agent.go      # 资金 Agent
├── example/              # 使用示例
│   └── main.go
└── go.mod                # Go 模块
```

## 快速开始

### 1. 基础使用

```go
package main

import (
    "context"
    "maneki/packages/service-agent"
    "maneki/packages/service-agent/specialized"
)

func main() {
    ctx := context.Background()

    // 创建 LLM 客户端
    llmClient := agent.NewOpenAIClient("your-api-key", "gpt-4o-mini")

    // 创建单个 Agent
    sentimentAgent := specialized.NewSentimentAgent(llmClient)

    // 执行分析
    input := agent.AgentInput{
        StockCodes: []string{"000001.SZ", "600519.SH"},
    }

    output, err := sentimentAgent.Run(ctx, input)
    if err != nil {
        panic(err)
    }

    // 处理结果
    for _, decision := range output.Decisions {
        fmt.Printf("%s: %s (%.0f%%)\n",
            decision.StockCode,
            decision.Decision,
            decision.Confidence*100)
    }
}
```

### 2. 多 Agent 协调使用

```go
// 创建协调器
coordinator := agent.NewMultiAgentCoordinator(llmClient, nil)

// 注册多个 Agent
coordinator.RegisterAgent(specialized.NewSentimentAgent(llmClient))
coordinator.RegisterAgent(specialized.NewTechnicalAgent(llmClient))
coordinator.RegisterAgent(specialized.NewCapitalAgent(llmClient))

// 执行分析
results, err := coordinator.Analyze(ctx, input)
if err != nil {
    panic(err)
}

// 处理聚合结果
for code, result := range results {
    fmt.Printf("股票: %s\n", code)
    fmt.Printf("最终决策: %s (置信度: %.0f%%)\n",
        result.FinalDecision,
        result.FinalConfidence*100)
    fmt.Printf("看涨 Agent: %v\n", result.GetBullishAgents())
}
```

### 3. 自定义 Agent

```go
type MyAgent struct {
    agent.BaseAgent
}

func NewMyAgent(llmClient agent.LLMClient) *MyAgent {
    return &MyAgent{
        BaseAgent: agent.BaseAgent{
            Name:        "我的Agent",
            AgentType:   "my_agent",
            Version:     "1.0.0",
            Description: "自定义Agent描述",
            LLMClient:   llmClient,
        },
    }
}

func (a *MyAgent) GetSystemPrompt() string {
    return "你是一个专业的..."
}

func (a *MyAgent) Run(ctx context.Context, input agent.AgentInput) (*agent.AgentOutput, error) {
    // 1. 收集信息
    // 2. 构建提示词
    // 3. 调用 LLM
    // 4. 解析结果
    // 5. 返回决策
}
```

## 决策类型

| 类型 | 说明 | 涨停概率 |
|------|------|----------|
| `strong_buy` | 强烈推荐买入 | > 80% |
| `buy` | 推荐买入 | 60-80% |
| `hold` | 观望 | 40-60% |
| `sell` | 建议卖出 | < 40% |
| `strong_sell` | 强烈建议卖出 | < 20% |
| `abstain` | 放弃 | 不确定 |

## 内置 Agent

### 情绪 Agent (sentiment)

分析维度：
- 新闻舆情分析 (40%)
- 社交媒体情绪 (30%)
- 板块效应 (20%)
- 时机判断 (10%)

### 技术 Agent (technical)

分析维度：
- 涨停形态 (35%)
- 趋势结构 (25%)
- 量价配合 (25%)
- 技术指标 (15%)

### 资金 Agent (capital)

分析维度：
- 主力资金流入 (40%)
- 龙虎榜质量 (25%)
- 成交量健康度 (20%)
- 资金成本分析 (15%)

## 决策聚合

默认权重配置：

```go
weights := map[string]float64{
    "sentiment":   0.25,
    "technical":   0.30,
    "capital":     0.30,
    "fundamental": 0.15,
}
```

可自定义权重：

```go
coordinator.SetWeights(map[string]float64{
    "sentiment": 0.4,
    "technical": 0.3,
    "capital":   0.3,
})
```

## 工具系统 (Function Call)

内置工具：
- `get_stock_info` - 获取股票基本信息
- `get_news` - 获取新闻资讯
- `get_kline` - 获取K线数据
- `get_capital_flow` - 获取资金流向
- `get_dragon_list` - 获取龙虎榜数据

自定义工具：

```go
type MyTool struct{}

func (t *MyTool) GetDefinition() agent.ToolDefinition {
    return agent.ToolDefinition{
        Name:        "my_tool",
        Description: "工具描述",
        Parameters: map[string]interface{}{
            "type": "object",
            "properties": map[string]interface{}{
                "param1": map[string]interface{}{
                    "type":        "string",
                    "description": "参数1描述",
                },
            },
            "required": []string{"param1"},
        },
    }
}

func (t *MyTool) Execute(ctx context.Context, args map[string]interface{}) (string, error) {
    // 执行逻辑
    return "结果", nil
}
```

## 运行示例

```bash
cd packages/service-agent/example
go run main.go
```

## 环境变量

- `OPENAI_API_KEY` - OpenAI API 密钥
- `OPENAI_MODEL` - 模型名称 (默认: gpt-4o-mini)

## 依赖

```go
require (
    github.com/sashabaranov/go-openai v1.x
)
```

## 后续计划

- [ ] 接入真实数据源（东方财富、AKShare 等）
- [ ] 实现基本面 Agent
- [ ] 添加 Agent 决策持久化
- [ ] 实现 Agent 决策可解释性报告
- [ ] 支持更多 LLM 提供商（Claude、文心一言等）
- [ ] 添加 Agent 性能评估和回测
