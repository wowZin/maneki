package agent

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/sashabaranov/go-openai"
	"maneki/packages/service-agent/core"
)

// OpenAIClient OpenAI 客户端实现
type OpenAIClient struct {
	client *openai.Client
	model  string
}

// NewOpenAIClient 创建 OpenAI 客户端
func NewOpenAIClient(apiKey string, model string) *OpenAIClient {
	if model == "" {
		model = openai.GPT4oMini // 默认使用 GPT-4o-mini
	}
	return &OpenAIClient{
		client: openai.NewClient(apiKey),
		model:  model,
	}
}

// Chat 普通对话
func (c *OpenAIClient) Chat(ctx context.Context, messages []core.Message, options *core.ChatOptions) (*core.ChatResponse, error) {
	if options == nil {
		options = &core.ChatOptions{}
	}

	model := options.Model
	if model == "" {
		model = c.model
	}

	// 转换消息格式
	openaiMessages := make([]openai.ChatCompletionMessage, len(messages))
	for i, msg := range messages {
		openaiMessages[i] = openai.ChatCompletionMessage{
			Role:    msg.Role,
			Content: msg.Content,
		}
	}

	req := openai.ChatCompletionRequest{
		Model:       model,
		Messages:    openaiMessages,
		Temperature: options.Temperature,
		MaxTokens:   options.MaxTokens,
	}

	resp, err := c.client.CreateChatCompletion(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("chat completion failed: %w", err)
	}

	if len(resp.Choices) == 0 {
		return nil, fmt.Errorf("no choices in response")
	}

	choice := resp.Choices[0]

	return &core.ChatResponse{
		Content: choice.Message.Content,
		Usage: core.Usage{
			PromptTokens:     resp.Usage.PromptTokens,
			CompletionTokens: resp.Usage.CompletionTokens,
			TotalTokens:      resp.Usage.TotalTokens,
		},
	}, nil
}

// ChatWithTools 带工具调用的对话
func (c *OpenAIClient) ChatWithTools(ctx context.Context, messages []core.Message, tools []core.ToolDefinition, options *core.ChatOptions) (*core.ChatResponse, error) {
	if options == nil {
		options = &core.ChatOptions{}
	}

	model := options.Model
	if model == "" {
		model = c.model
	}

	// 转换消息格式
	openaiMessages := make([]openai.ChatCompletionMessage, len(messages))
	for i, msg := range messages {
		openaiMessages[i] = openai.ChatCompletionMessage{
			Role:    msg.Role,
			Content: msg.Content,
		}
	}

	// 转换工具格式
	openaiTools := make([]openai.Tool, len(tools))
	for i, tool := range tools {
		openaiTools[i] = openai.Tool{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:        tool.Name,
				Description: tool.Description,
				Parameters:  tool.Parameters,
			},
		}
	}

	req := openai.ChatCompletionRequest{
		Model:       model,
		Messages:    openaiMessages,
		Tools:       openaiTools,
		Temperature: options.Temperature,
		MaxTokens:   options.MaxTokens,
	}

	resp, err := c.client.CreateChatCompletion(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("chat completion with tools failed: %w", err)
	}

	if len(resp.Choices) == 0 {
		return nil, fmt.Errorf("no choices in response")
	}

	choice := resp.Choices[0]

	// 解析工具调用
	var toolCalls []core.ToolCall
	for _, tc := range choice.Message.ToolCalls {
		var args map[string]interface{}
		if err := json.Unmarshal([]byte(tc.Function.Arguments), &args); err != nil {
			// 如果解析失败，使用原始字符串
			args = map[string]interface{}{"raw": tc.Function.Arguments}
		}

		toolCalls = append(toolCalls, core.ToolCall{
			ID:        tc.ID,
			Name:      tc.Function.Name,
			Arguments: args,
		})
	}

	return &core.ChatResponse{
		Content:   choice.Message.Content,
		ToolCalls: toolCalls,
		Usage: core.Usage{
			PromptTokens:     resp.Usage.PromptTokens,
			CompletionTokens: resp.Usage.CompletionTokens,
			TotalTokens:      resp.Usage.TotalTokens,
		},
	}, nil
}

// SimpleChat 简单对话（不需要 Function Call 的场景）
func (c *OpenAIClient) SimpleChat(ctx context.Context, systemPrompt string, userPrompt string) (string, error) {
	messages := []core.Message{
		{Role: "system", Content: systemPrompt},
		{Role: "user", Content: userPrompt},
	}

	resp, err := c.Chat(ctx, messages, &core.ChatOptions{
		Temperature: 0.7,
	})
	if err != nil {
		return "", err
	}

	return resp.Content, nil
}

// StructuredOutput 结构化输出（要求 LLM 返回 JSON）
func (c *OpenAIClient) StructuredOutput(ctx context.Context, systemPrompt string, userPrompt string, outputSchema string) (map[string]interface{}, error) {
	// 在 system prompt 中添加 JSON 输出要求
	if outputSchema != "" {
		systemPrompt += "\n\n请以JSON格式输出，格式如下：\n" + outputSchema + "\n注意：只返回JSON，不要其他文字。"
	} else {
		systemPrompt += "\n\n请以JSON格式输出，只返回JSON，不要其他文字。"
	}

	messages := []core.Message{
		{Role: "system", Content: systemPrompt},
		{Role: "user", Content: userPrompt},
	}

	resp, err := c.Chat(ctx, messages, &core.ChatOptions{
		Temperature: 0.2, // 结构化输出使用低温度
	})
	if err != nil {
		return nil, err
	}

	// 解析 JSON
	var result map[string]interface{}
	if err := json.Unmarshal([]byte(resp.Content), &result); err != nil {
		// 尝试提取 JSON 部分
		return extractJSON(resp.Content)
	}

	return result, nil
}

// extractJSON 从文本中提取 JSON
func extractJSON(text string) (map[string]interface{}, error) {
	// 查找第一个 { 和最后一个 }
	start := -1
	end := -1
	depth := 0

	for i, ch := range text {
		if ch == '{' {
			if depth == 0 {
				start = i
			}
			depth++
		} else if ch == '}' {
			depth--
			if depth == 0 && start != -1 {
				end = i + 1
				break
			}
		}
	}

	if start == -1 || end == -1 {
		return nil, fmt.Errorf("no JSON found in text: %s", text)
	}

	var result map[string]interface{}
	if err := json.Unmarshal([]byte(text[start:end]), &result); err != nil {
		return nil, fmt.Errorf("failed to parse JSON: %w", err)
	}

	return result, nil
}
