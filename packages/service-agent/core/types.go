package core

import (
	"context"
	"time"
)

// DecisionType 决策类型
type DecisionType string

const (
	DecisionStrongBuy  DecisionType = "strong_buy"  // 强烈推荐买入（涨停概率>80%）
	DecisionBuy        DecisionType = "buy"         // 推荐买入（涨停概率>60%）
	DecisionHold       DecisionType = "hold"        // 观望（涨停概率40-60%）
	DecisionSell       DecisionType = "sell"        // 建议卖出（涨停概率<40%）
	DecisionStrongSell DecisionType = "strong_sell" // 强烈建议卖出（涨停概率<20%）
	DecisionAbstain    DecisionType = "abstain"     // 放弃（信息不足）
)

// AgentInput Agent 输入
type AgentInput struct {
	StockCodes    []string               `json:"stock_codes"`    // 股票代码列表
	MarketContext map[string]interface{} `json:"market_context"` // 市场环境信息
	RequestID     string                 `json:"request_id"`     // 请求唯一标识
	Timestamp     time.Time              `json:"timestamp"`      // 请求时间戳
	ExtraParams   map[string]interface{} `json:"extra_params"`   // 额外参数
}

// AgentDecision 单个股票的决策结果
type AgentDecision struct {
	StockCode   string       `json:"stock_code"`   // 股票代码
	Decision    DecisionType `json:"decision"`     // 决策类型
	Confidence  float64      `json:"confidence"`   // 置信度（0-1）
	Reasoning   string       `json:"reasoning"`    // 决策理由
	Signals     []string     `json:"signals"`      // 关键信号列表
	RiskFactors []string     `json:"risk_factors"` // 风险因素
	TimeHorizon string       `json:"time_horizon"` // 时间周期（short/medium/long）
}

// AgentOutput Agent 输出结果
type AgentOutput struct {
	AgentName string                 `json:"agent_name"` // Agent名称
	AgentType string                 `json:"agent_type"` // Agent类型标识
	RequestID string                 `json:"request_id"` // 对应请求ID
	Timestamp time.Time              `json:"timestamp"`  // 决策时间戳
	Decisions []AgentDecision        `json:"decisions"`  // 股票决策结果列表
	Metadata  map[string]interface{} `json:"metadata"`   // 元数据
}

// GetDecisionForStock 获取特定股票的决策
func (o *AgentOutput) GetDecisionForStock(stockCode string) *AgentDecision {
	for i := range o.Decisions {
		if o.Decisions[i].StockCode == stockCode {
			return &o.Decisions[i]
		}
	}
	return nil
}

// GetBullishStocks 获取看涨的股票列表
func (o *AgentOutput) GetBullishStocks() []string {
	var stocks []string
	for _, d := range o.Decisions {
		if d.Decision == DecisionBuy || d.Decision == DecisionStrongBuy {
			stocks = append(stocks, d.StockCode)
		}
	}
	return stocks
}

// GetConfidenceScore 获取平均置信度
func (o *AgentOutput) GetConfidenceScore() float64 {
	if len(o.Decisions) == 0 {
		return 0
	}
	var sum float64
	for _, d := range o.Decisions {
		sum += d.Confidence
	}
	return sum / float64(len(o.Decisions))
}

// Agent Agent 接口
type Agent interface {
	// GetName 获取Agent名称
	GetName() string
	// GetType 获取Agent类型
	GetType() string
	// GetDescription 获取Agent描述
	GetDescription() string
	// GetSystemPrompt 获取系统提示词
	GetSystemPrompt() string
	// Run 执行Agent分析
	Run(ctx context.Context, input AgentInput) (*AgentOutput, error)
}

// BaseAgent Agent 基类
type BaseAgent struct {
	Name        string
	AgentType   string
	Version     string
	Description string
	LLMClient   LLMClient
}

// GetName 获取Agent名称
func (b *BaseAgent) GetName() string {
	return b.Name
}

// GetType 获取Agent类型
func (b *BaseAgent) GetType() string {
	return b.AgentType
}

// GetDescription 获取Agent描述
func (b *BaseAgent) GetDescription() string {
	return b.Description
}

// ToolDefinition 工具定义
type ToolDefinition struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Parameters  map[string]interface{} `json:"parameters"`
}

// ToolCall 工具调用
type ToolCall struct {
	ID        string                 `json:"id"`
	Name      string                 `json:"name"`
	Arguments map[string]interface{} `json:"arguments"`
}

// Tool Tool 接口
type Tool interface {
	GetDefinition() ToolDefinition
	Execute(ctx context.Context, args map[string]interface{}) (string, error)
}

// ToolResult 工具执行结果
type ToolResult struct {
	ToolCallID string
	Name       string
	Output     string
	Error      error
}

// ToolRegistry 工具注册表
type ToolRegistry struct {
	Tools map[string]Tool
}

// NewToolRegistry 创建工具注册表
func NewToolRegistry() *ToolRegistry {
	return &ToolRegistry{
		Tools: make(map[string]Tool),
	}
}

// Register 注册工具
func (r *ToolRegistry) Register(tool Tool) {
	def := tool.GetDefinition()
	r.Tools[def.Name] = tool
}

// Get 获取工具
func (r *ToolRegistry) Get(name string) (Tool, bool) {
	tool, ok := r.Tools[name]
	return tool, ok
}

// GetDefinitions 获取所有工具定义
func (r *ToolRegistry) GetDefinitions() []ToolDefinition {
	defs := make([]ToolDefinition, 0, len(r.Tools))
	for _, tool := range r.Tools {
		defs = append(defs, tool.GetDefinition())
	}
	return defs
}

// MultiAgentResult 多Agent决策结果
type MultiAgentResult struct {
	StockCode         string                   `json:"stock_code"`
	FinalDecision     DecisionType             `json:"final_decision"`
	FinalConfidence   float64                  `json:"final_confidence"`
	AgentResults      map[string]AgentDecision `json:"agent_results"`
	AggregationMethod string                   `json:"aggregation_method"`
	Reasoning         string                   `json:"reasoning"`
	Timestamp         time.Time                `json:"timestamp"`
}

// GetBullishAgents 获取看涨的Agent列表
func (r *MultiAgentResult) GetBullishAgents() []string {
	var agents []string
	for agentType, decision := range r.AgentResults {
		if decision.Decision == DecisionBuy || decision.Decision == DecisionStrongBuy {
			agents = append(agents, agentType)
		}
	}
	return agents
}

// GetBearishAgents 获取看跌的Agent列表
func (r *MultiAgentResult) GetBearishAgents() []string {
	var agents []string
	for agentType, decision := range r.AgentResults {
		if decision.Decision == DecisionSell || decision.Decision == DecisionStrongSell {
			agents = append(agents, agentType)
		}
	}
	return agents
}
