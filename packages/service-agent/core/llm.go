package core

import (
	"context"
)

// LLMClient LLM 客户端接口
type LLMClient interface {
	// Chat 普通对话
	Chat(ctx context.Context, messages []Message, options *ChatOptions) (*ChatResponse, error)
	// ChatWithTools 带工具调用的对话
	ChatWithTools(ctx context.Context, messages []Message, tools []ToolDefinition, options *ChatOptions) (*ChatResponse, error)
	// StructuredOutput 结构化输出（要求 LLM 返回 JSON）
	StructuredOutput(ctx context.Context, systemPrompt string, userPrompt string, outputSchema string) (map[string]interface{}, error)
}

// Message 消息
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ChatOptions 对话选项
type ChatOptions struct {
	Model       string
	Temperature float32
	MaxTokens   int
}

// ChatResponse 对话响应
type ChatResponse struct {
	Content   string     `json:"content"`
	ToolCalls []ToolCall `json:"tool_calls,omitempty"`
	Usage     Usage      `json:"usage"`
}

// Usage 使用量
type Usage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}
