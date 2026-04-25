package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/maneki/api/internal/model"
	"github.com/maneki/api/internal/repository"
)

// MarketplaceService Agent市场服务
type MarketplaceService struct {
	agentRepo        *repository.AgentRepository
	subscriptionRepo *repository.AgentSubscriptionRepository
	userRepo         *repository.UserRepository
}

// NewMarketplaceService 创建市场服务
func NewMarketplaceService(agentRepo *repository.AgentRepository, subscriptionRepo *repository.AgentSubscriptionRepository, userRepo *repository.UserRepository) *MarketplaceService {
	return &MarketplaceService{
		agentRepo:        agentRepo,
		subscriptionRepo: subscriptionRepo,
		userRepo:         userRepo,
	}
}

// ============================================
// 市场列表与详情 (US1)
// ============================================

// MarketplaceAgentItem 市场列表项
type MarketplaceAgentItem struct {
	ID          uint    `json:"id"`
	Name        string  `json:"name"`
	Description string  `json:"description"`
	Avatar      string  `json:"avatar"`
	Type        string  `json:"type"`
	Category    string  `json:"category"`
	Price       float64 `json:"price"`
	PriceType   string  `json:"price_type"`
	IsFeatured  bool    `json:"is_featured"`
	IsOfficial  bool    `json:"is_official"`
	UseCount    int     `json:"use_count"`
	Rating      float64 `json:"rating"`
	RatingCount int     `json:"rating_count"`
	Accuracy    *float64 `json:"accuracy"`
	AuthorName  string  `json:"author_name"`
	CreatedAt   string  `json:"created_at"`
}

// MarketplaceListResult 市场列表结果
type MarketplaceListResult struct {
	Items []*MarketplaceAgentItem `json:"items"`
	Total int64                   `json:"total"`
	Page  int                     `json:"page"`
	Size  int                     `json:"size"`
}

// GetMarketplaceList 获取市场列表
func (s *MarketplaceService) GetMarketplaceList(ctx context.Context, filters map[string]interface{}, sortBy, sortOrder string, page, pageSize int) (*MarketplaceListResult, error) {
	agents, total, err := s.agentRepo.ListWithSorting(ctx, filters, sortBy, sortOrder, page, pageSize)
	if err != nil {
		return nil, fmt.Errorf("failed to list agents: %w", err)
	}

	items := make([]*MarketplaceAgentItem, 0, len(agents))
	for _, agent := range agents {
		item := &MarketplaceAgentItem{
			ID:          agent.ID,
			Name:        agent.Name,
			Description: agent.Description,
			Avatar:      agent.Avatar,
			Type:        agent.Type,
			Category:    agent.Category,
			Price:       agent.Price,
			PriceType:   agent.PriceType,
			IsFeatured:  agent.IsFeatured,
			IsOfficial:  agent.IsOfficial,
			UseCount:    agent.UseCount,
			Rating:      agent.Rating,
			RatingCount: agent.RatingCount,
			CreatedAt:   agent.CreatedAt.Format("2006-01-02 15:04:05"),
		}

		// 获取作者名称
		if agent.Owner != nil {
			item.AuthorName = agent.Owner.DisplayName()
		}

		// 获取准确率
		hitRate, _, _, err := s.agentRepo.GetAccuracyByAgentID(ctx, agent.ID)
		if err == nil {
			item.Accuracy = hitRate
		}

		items = append(items, item)
	}

	// 如果按准确率排序，需要手动排序（因为准确率来自快照表）
	if sortBy == "accuracy" {
		items = sortByAccuracy(items, sortOrder)
	}

	return &MarketplaceListResult{
		Items: items,
		Total: total,
		Page:  page,
		Size:  pageSize,
	}, nil
}

// sortByAccuracy 按准确率排序
func sortByAccuracy(items []*MarketplaceAgentItem, order string) []*MarketplaceAgentItem {
	// 简单实现：使用冒泡排序（数据量小）
	for i := 0; i < len(items); i++ {
		for j := i + 1; j < len(items); j++ {
			var swap bool
			if order == "asc" {
				swap = compareAccuracy(items[i].Accuracy, items[j].Accuracy) > 0
			} else {
				swap = compareAccuracy(items[i].Accuracy, items[j].Accuracy) < 0
			}
			if swap {
				items[i], items[j] = items[j], items[i]
			}
		}
	}
	return items
}

// compareAccuracy 比较两个准确率（nil 视为最小）
func compareAccuracy(a, b *float64) int {
	if a == nil && b == nil {
		return 0
	}
	if a == nil {
		return -1
	}
	if b == nil {
		return 1
	}
	if *a < *b {
		return -1
	}
	if *a > *b {
		return 1
	}
	return 0
}

// AgentAuthor 作者信息
type AgentAuthor struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	AvatarURL string `json:"avatar_url"`
}

// AgentDetailResult Agent详情结果
type AgentDetailResult struct {
	ID             uint         `json:"id"`
	Name           string       `json:"name"`
	Description    string       `json:"description"`
	Avatar         string       `json:"avatar"`
	Type           string       `json:"type"`
	Category       string       `json:"category"`
	Prompt         string       `json:"prompt"`
	Model          string       `json:"model"`
	Price          float64      `json:"price"`
	PriceType      string       `json:"price_type"`
	IsFeatured     bool         `json:"is_featured"`
	IsOfficial     bool         `json:"is_official"`
	IsActive       bool         `json:"is_active"`
	UseCount       int          `json:"use_count"`
	Rating         float64      `json:"rating"`
	RatingCount    int          `json:"rating_count"`
	Accuracy       *float64     `json:"accuracy"`
	AccuracyPeriod string       `json:"accuracy_period"`
	Author         AgentAuthor  `json:"author"`
	IsSubscribed   bool         `json:"is_subscribed"`
	CanSubscribeFree bool      `json:"can_subscribe_free"`
	CreatedAt      string       `json:"created_at"`
	UpdatedAt      string       `json:"updated_at"`
}

// GetAgentDetail 获取Agent详情
func (s *MarketplaceService) GetAgentDetail(ctx context.Context, agentID uint, currentUserID *uuid.UUID) (*AgentDetailResult, error) {
	agent, err := s.agentRepo.GetByIDWithOwner(ctx, agentID)
	if err != nil {
		return nil, fmt.Errorf("failed to get agent: %w", err)
	}
	if agent == nil {
		return nil, nil
	}

	result := &AgentDetailResult{
		ID:             agent.ID,
		Name:           agent.Name,
		Description:    agent.Description,
		Avatar:         agent.Avatar,
		Type:           agent.Type,
		Category:       agent.Category,
		Prompt:         agent.Prompt,
		Model:          agent.Model,
		Price:          agent.Price,
		PriceType:      agent.PriceType,
		IsFeatured:     agent.IsFeatured,
		IsOfficial:     agent.IsOfficial,
		IsActive:       agent.IsActive,
		UseCount:       agent.UseCount,
		Rating:         agent.Rating,
		RatingCount:    agent.RatingCount,
		AccuracyPeriod: "30d",
		CreatedAt:      agent.CreatedAt.Format("2006-01-02 15:04:05"),
		UpdatedAt:      agent.UpdatedAt.Format("2006-01-02 15:04:05"),
	}

	// 获取作者信息
	if agent.Owner != nil {
		result.Author = AgentAuthor{
			ID:        agent.Owner.ID.String(),
			Name:      agent.Owner.DisplayName(),
			AvatarURL: agent.Owner.AvatarURL,
		}
	}

	// 获取准确率
	hitRate, _, _, err := s.agentRepo.GetAccuracyByAgentID(ctx, agent.ID)
	if err == nil {
		result.Accuracy = hitRate
	}

	// 检查当前用户订阅状态
	if currentUserID != nil {
		isSubscribed, _ := s.subscriptionRepo.CheckExistingSubscription(ctx, *currentUserID, agent.ID)
		result.IsSubscribed = isSubscribed

		// 是否可以免费订阅：用户是VIP 且 Agent不是免费（非官方非精选 或 价格>0）
		user, _ := s.userRepo.GetByID(ctx, *currentUserID)
		if user != nil && user.IsVIP() {
			if !agent.IsOfficial && !agent.IsFeatured && agent.Price > 0 {
				result.CanSubscribeFree = true
			}
		}
		// 官方和精选Agent对所有人免费
		if agent.IsOfficial || agent.IsFeatured {
			result.CanSubscribeFree = true
		}
	}

	return result, nil
}

// ============================================
// VIP 订阅 (US2)
// ============================================

// SubscribeResult 订阅结果
type SubscribeResult struct {
	SubscriptionID uint    `json:"subscription_id"`
	AgentID        uint    `json:"agent_id"`
	Status         string  `json:"status"`
	Price          float64 `json:"price"`
	StartDate      string  `json:"start_date"`
	Message        string  `json:"message"`
}

// SubscribeAgent 订阅Agent
func (s *MarketplaceService) SubscribeAgent(ctx context.Context, userID uuid.UUID, agentID uint) (*SubscribeResult, error) {
	// 检查Agent是否存在
	agent, err := s.agentRepo.GetByID(ctx, agentID)
	if err != nil {
		return nil, fmt.Errorf("failed to get agent: %w", err)
	}
	if agent == nil {
		return nil, fmt.Errorf("agent not found")
	}

	// 检查是否已订阅
	exists, err := s.subscriptionRepo.CheckExistingSubscription(ctx, userID, agentID)
	if err != nil {
		return nil, fmt.Errorf("failed to check subscription: %w", err)
	}
	if exists {
		return nil, fmt.Errorf("already subscribed")
	}

	// 获取用户信息检查VIP
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	// 判断价格
	price := agent.Price
	if agent.IsOfficial || agent.IsFeatured || (user != nil && user.IsVIP()) {
		price = 0
	}
	if price > 0 {
		return nil, fmt.Errorf("vip required for free subscription")
	}

	// 创建订阅
	sub := &model.AgentSubscription{
		UserID:    userID,
		AgentID:   agentID,
		StartDate: time.Now(),
		Status:    "active",
		Price:     price,
	}

	if err := s.subscriptionRepo.Create(ctx, sub); err != nil {
		return nil, fmt.Errorf("failed to create subscription: %w", err)
	}

	return &SubscribeResult{
		SubscriptionID: sub.ID,
		AgentID:        agentID,
		Status:         "active",
		Price:          price,
		StartDate:      sub.StartDate.Format(time.RFC3339),
		Message:        "订阅成功",
	}, nil
}

// MySubscriptionItem 我的订阅项
type MySubscriptionItem struct {
	SubscriptionID uint    `json:"subscription_id"`
	AgentID        uint    `json:"agent_id"`
	AgentName      string  `json:"agent_name"`
	AgentAvatar    string  `json:"agent_avatar"`
	Status         string  `json:"status"`
	Price          float64 `json:"price"`
	StartDate      string  `json:"start_date"`
	EndDate        *string `json:"end_date"`
}

// MySubscriptionsResult 我的订阅结果
type MySubscriptionsResult struct {
	Items []*MySubscriptionItem `json:"items"`
	Total int64                 `json:"total"`
	Page  int                   `json:"page"`
	Size  int                   `json:"size"`
}

// GetMySubscriptions 获取我的订阅列表
func (s *MarketplaceService) GetMySubscriptions(ctx context.Context, userID uuid.UUID, status string, page, pageSize int) (*MySubscriptionsResult, error) {
	subs, err := s.subscriptionRepo.GetUserSubscriptions(ctx, userID, status)
	if err != nil {
		return nil, fmt.Errorf("failed to get subscriptions: %w", err)
	}

	items := make([]*MySubscriptionItem, 0, len(subs))
	for _, sub := range subs {
		item := &MySubscriptionItem{
			SubscriptionID: sub.ID,
			AgentID:        sub.AgentID,
			Status:         sub.Status,
			Price:          sub.Price,
			StartDate:      sub.StartDate.Format("2006-01-02 15:04:05"),
		}
		if sub.EndDate != nil {
			endDate := sub.EndDate.Format("2006-01-02 15:04:05")
			item.EndDate = &endDate
		}
		if sub.Agent.ID != 0 {
			item.AgentName = sub.Agent.Name
			item.AgentAvatar = sub.Agent.Avatar
		}
		items = append(items, item)
	}

	// 手动分页
	total := int64(len(items))
	start := (page - 1) * pageSize
	end := start + pageSize
	if start > len(items) {
		start = len(items)
	}
	if end > len(items) {
		end = len(items)
	}
	pagedItems := items[start:end]

	return &MySubscriptionsResult{
		Items: pagedItems,
		Total: total,
		Page:  page,
		Size:  pageSize,
	}, nil
}

// ============================================
// SVIP 创建 Agent (US3)
// ============================================

// CreateMarketplaceAgentRequest 创建Agent请求
type CreateMarketplaceAgentRequest struct {
	Name           string
	Description    string
	Type           string
	Category       string
	Model          string
	Prompt         string
	Price          float64
	PriceType      string
	StrategyConfig model.JSON
}

// CreateMarketplaceAgent 创建Agent（SVIP）
func (s *MarketplaceService) CreateMarketplaceAgent(ctx context.Context, userID uuid.UUID, req *CreateMarketplaceAgentRequest) (*model.Agent, error) {
	// 检查名称是否已存在
	existing, err := s.agentRepo.GetByName(ctx, req.Name)
	if err != nil {
		return nil, fmt.Errorf("failed to check agent name: %w", err)
	}
	if existing != nil {
		return nil, fmt.Errorf("agent name already exists")
	}

	agent := &model.Agent{
		Name:           req.Name,
		Description:    req.Description,
		Type:           req.Type,
		Category:       req.Category,
		Model:          req.Model,
		Prompt:         req.Prompt,
		Price:          req.Price,
		PriceType:      req.PriceType,
		StrategyConfig: req.StrategyConfig,
		IsActive:       true,
		OwnerID:        &userID,
	}

	if err := s.agentRepo.Create(ctx, agent); err != nil {
		return nil, fmt.Errorf("failed to create agent: %w", err)
	}

	return agent, nil
}
