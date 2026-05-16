package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/maneki/api/internal/model"
	"github.com/maneki/api/internal/repository"
	"github.com/maneki/api/internal/service"
)

// AgentHandler Agent处理器
type AgentHandler struct {
	agentRepo        *repository.AgentRepository
	weightRepo       *repository.AgentWeightRepository
	subscriptionRepo *repository.AgentSubscriptionRepository
	marketplaceSvc   *service.MarketplaceService
}

// NewAgentHandler 创建Agent处理器
func NewAgentHandler(
	agentRepo *repository.AgentRepository,
	weightRepo *repository.AgentWeightRepository,
	subscriptionRepo *repository.AgentSubscriptionRepository,
	marketplaceSvc *service.MarketplaceService,
) *AgentHandler {
	return &AgentHandler{
		agentRepo:        agentRepo,
		weightRepo:       weightRepo,
		subscriptionRepo: subscriptionRepo,
		marketplaceSvc:   marketplaceSvc,
	}
}

// ListAgentsRequest 列出Agent请求
type ListAgentsRequest struct {
	Type       string `form:"type"`
	IsFeatured string `form:"is_featured"`
	Page       int    `form:"page,default=1"`
	PageSize   int    `form:"page_size,default=20"`
}

// AgentResponse Agent响应
type AgentResponse struct {
	ID          uint    `json:"id"`
	Name        string  `json:"name"`
	Description string  `json:"description"`
	Avatar      string  `json:"avatar"`
	Type        string  `json:"type"`
	Category    string  `json:"category"`
	Prompt      string  `json:"prompt"`
	Model       string  `json:"model"`
	Price       float64 `json:"price"`
	PriceType   string  `json:"price_type"`
	IsFeatured  bool    `json:"is_featured"`
	IsOfficial  bool    `json:"is_official"`
	IsActive    bool    `json:"is_active"`
	UseCount    int     `json:"use_count"`
	Rating      float64 `json:"rating"`
	RatingCount int     `json:"rating_count"`
	OwnerID     *string `json:"owner_id,omitempty"`
	CreatedAt   string  `json:"created_at"`
	UpdatedAt   string  `json:"updated_at"`
}

// ListAgents 获取Agent列表
func (h *AgentHandler) ListAgents(c *gin.Context) {
	var req ListAgentsRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	filters := make(map[string]interface{})
	filters["is_active"] = true
	if req.Type != "" {
		filters["type"] = req.Type
	}
	if req.IsFeatured == "true" {
		filters["is_featured"] = true
	}

	agents, total, err := h.agentRepo.List(c.Request.Context(), filters, req.Page, req.PageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch agents"})
		return
	}

	var response []*AgentResponse
	for _, agent := range agents {
		response = append(response, agentToResponse(agent))
	}

	c.JSON(http.StatusOK, gin.H{
		"items": response,
		"total": total,
		"page":  req.Page,
		"size":  req.PageSize,
	})
}

// GetAgent 获取Agent详情
func (h *AgentHandler) GetAgent(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid agent id"})
		return
	}

	agent, err := h.agentRepo.GetByID(c.Request.Context(), uint(id))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch agent"})
		return
	}
	if agent == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "agent not found"})
		return
	}

	c.JSON(http.StatusOK, agentToResponse(agent))
}

// ListFeaturedAgents 获取精选Agent列表
func (h *AgentHandler) ListFeaturedAgents(c *gin.Context) {
	agents, err := h.agentRepo.ListFeatured(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch featured agents"})
		return
	}

	var response []*AgentResponse
	for _, agent := range agents {
		response = append(response, agentToResponse(agent))
	}

	c.JSON(http.StatusOK, gin.H{"data": response})
}

// agentToResponse 将模型转换为响应
func agentToResponse(agent *model.Agent) *AgentResponse {
	resp := &AgentResponse{
		ID:          agent.ID,
		Name:        agent.Name,
		Description: agent.Description,
		Avatar:      agent.Avatar,
		Type:        agent.Type,
		Category:    agent.Category,
		Prompt:      agent.Prompt,
		Model:       agent.Model,
		Price:       agent.Price,
		PriceType:   agent.PriceType,
		IsFeatured:  agent.IsFeatured,
		IsOfficial:  agent.IsOfficial,
		IsActive:    agent.IsActive,
		UseCount:    agent.UseCount,
		Rating:      agent.Rating,
		RatingCount: agent.RatingCount,
		CreatedAt:   agent.CreatedAt.Format("2006-01-02 15:04:05"),
		UpdatedAt:   agent.UpdatedAt.Format("2006-01-02 15:04:05"),
	}
	if agent.OwnerID != nil {
		uid := agent.OwnerID.String()
		resp.OwnerID = &uid
	}
	return resp
}

// GetMyAgentWeights 获取用户的Agent权重配置
func (h *AgentHandler) GetMyAgentWeights(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	id, err := uuid.Parse(userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "invalid user id"})
		return
	}

	weights, err := h.weightRepo.GetUserWeights(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch agent weights"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": weights})
}

// UpdateAgentWeight 更新Agent权重
func (h *AgentHandler) UpdateAgentWeight(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	uid, err := uuid.Parse(userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "invalid user id"})
		return
	}

	agentID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid agent id"})
		return
	}

	var req struct {
		Weight      float64 `json:"weight" binding:"min=0,max=2"`
		IsEnabled   bool    `json:"is_enabled"`
		CustomConfig model.JSON `json:"custom_config"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	weight := &model.AgentWeight{
		UserID:       uid,
		AgentID:      uint(agentID),
		Weight:       req.Weight,
		IsEnabled:    req.IsEnabled,
		CustomConfig: req.CustomConfig,
	}

	if err := h.weightRepo.CreateOrUpdate(c.Request.Context(), weight); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update agent weight"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "weight updated successfully"})
}

// CreateAgentRequest 创建Agent请求
type CreateAgentRequest struct {
	Name           string     `json:"name" binding:"required,max=30"`
	Description    string     `json:"description" binding:"max=300"`
	Avatar         string     `json:"avatar"`
	Type           string     `json:"type" binding:"required,max=30"`
	Category       string     `json:"category"`
	Prompt         string     `json:"prompt"`
	Model          string     `json:"model"`
	Price          float64    `json:"price"`
	PriceType      string     `json:"price_type"`
	StrategyConfig model.JSON `json:"strategy_config"`
	IsActive       *bool      `json:"is_active"`
	IsFeatured     *bool      `json:"is_featured"`
	IsOfficial     *bool      `json:"is_official"`
}

// CreateAgent 创建Agent（需要登录）
func (h *AgentHandler) CreateAgent(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	uid, err := uuid.Parse(userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "invalid user id"})
		return
	}

	var req CreateAgentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 检查名称是否已存在
	existing, err := h.agentRepo.GetByName(c.Request.Context(), req.Name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check agent name"})
		return
	}
	if existing != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "agent name already exists"})
		return
	}

	isSuperuser, _ := c.Get("is_superuser")
	isOfficial := false
	if isSuperuser != nil && isSuperuser.(bool) {
		isOfficial = true
	}

	agent := &model.Agent{
		Name:           req.Name,
		Description:    req.Description,
		Avatar:         req.Avatar,
		Type:           req.Type,
		Category:       req.Category,
		Prompt:         req.Prompt,
		Model:          req.Model,
		Price:          req.Price,
		PriceType:      req.PriceType,
		StrategyConfig: req.StrategyConfig,
		IsActive:       true,
		IsOfficial:     isOfficial,
		OwnerID:        &uid,
	}

	if err := h.agentRepo.Create(c.Request.Context(), agent); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create agent"})
		return
	}

	c.JSON(http.StatusCreated, agentToResponse(agent))
}

// UpdateAgent 更新Agent
func (h *AgentHandler) UpdateAgent(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid agent id"})
		return
	}

	agent, err := h.agentRepo.GetByID(c.Request.Context(), uint(id))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch agent"})
		return
	}
	if agent == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "agent not found"})
		return
	}

	// 检查权限
	userID, _ := c.Get("user_id")
	isSuperuser, _ := c.Get("is_superuser")

	if agent.OwnerID != nil && agent.OwnerID.String() != userID.(string) && !isSuperuser.(bool) {
		c.JSON(http.StatusForbidden, gin.H{"error": "permission denied"})
		return
	}

	var req CreateAgentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	agent.Name = req.Name
	agent.Description = req.Description
	agent.Avatar = req.Avatar
	agent.Type = req.Type
	agent.Category = req.Category
	agent.Prompt = req.Prompt
	agent.Model = req.Model
	agent.Price = req.Price
	agent.PriceType = req.PriceType
	agent.StrategyConfig = req.StrategyConfig

	if err := h.agentRepo.Update(c.Request.Context(), agent); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update agent"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "agent updated successfully"})
}

// DeleteAgent 删除Agent
func (h *AgentHandler) DeleteAgent(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid agent id"})
		return
	}

	agent, err := h.agentRepo.GetByID(c.Request.Context(), uint(id))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch agent"})
		return
	}
	if agent == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "agent not found"})
		return
	}

	// 检查权限
	userID, _ := c.Get("user_id")
	isSuperuser, _ := c.Get("is_superuser")

	if agent.OwnerID != nil && agent.OwnerID.String() != userID.(string) && !isSuperuser.(bool) {
		c.JSON(http.StatusForbidden, gin.H{"error": "permission denied"})
		return
	}

	if err := h.agentRepo.Delete(c.Request.Context(), uint(id)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete agent"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "agent deleted successfully"})
}

// CreateAgentAdmin 管理员创建Agent（官方Agent，无需用户归属）
func (h *AgentHandler) CreateAgentAdmin(c *gin.Context) {
	var req CreateAgentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 检查名称是否已存在
	existing, err := h.agentRepo.GetByName(c.Request.Context(), req.Name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check agent name"})
		return
	}
	if existing != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "agent name already exists"})
		return
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}
	isOfficial := true
	if req.IsOfficial != nil {
		isOfficial = *req.IsOfficial
	}
	isFeatured := false
	if req.IsFeatured != nil {
		isFeatured = *req.IsFeatured
	}

	agent := &model.Agent{
		Name:           req.Name,
		Description:    req.Description,
		Avatar:         req.Avatar,
		Type:           req.Type,
		Category:       req.Category,
		Prompt:         req.Prompt,
		Model:          req.Model,
		Price:          req.Price,
		PriceType:      req.PriceType,
		StrategyConfig: req.StrategyConfig,
		IsActive:       isActive,
		IsFeatured:     isFeatured,
		IsOfficial:     isOfficial,
	}

	if err := h.agentRepo.Create(c.Request.Context(), agent); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create agent"})
		return
	}

	c.JSON(http.StatusCreated, agentToResponse(agent))
}

// UpdateAgentAdminRequest 管理员更新Agent请求（所有字段可选）
type UpdateAgentAdminRequest struct {
	Name           string     `json:"name" binding:"omitempty,min=1,max=30"`
	Description    string     `json:"description" binding:"max=300"`
	Avatar         string     `json:"avatar"`
	Type           string     `json:"type" binding:"omitempty,max=30"`
	Category       string     `json:"category"`
	Prompt         string     `json:"prompt"`
	Model          string     `json:"model"`
	Price          float64    `json:"price"`
	PriceType      string     `json:"price_type"`
	StrategyConfig model.JSON `json:"strategy_config"`
	IsActive       *bool      `json:"is_active"`
	IsFeatured     *bool      `json:"is_featured"`
}

// UpdateAgentAdmin 管理员更新Agent（无需所有权检查）
func (h *AgentHandler) UpdateAgentAdmin(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid agent id"})
		return
	}

	agent, err := h.agentRepo.GetByID(c.Request.Context(), uint(id))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch agent"})
		return
	}
	if agent == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "agent not found"})
		return
	}

	var req UpdateAgentAdminRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Name != "" {
		agent.Name = req.Name
	}
	agent.Description = req.Description
	agent.Avatar = req.Avatar
	if req.Type != "" {
		agent.Type = req.Type
	}
	agent.Category = req.Category
	agent.Prompt = req.Prompt
	agent.Model = req.Model
	agent.Price = req.Price
	agent.PriceType = req.PriceType
	agent.StrategyConfig = req.StrategyConfig
	if req.IsActive != nil {
		agent.IsActive = *req.IsActive
	}
	if req.IsFeatured != nil {
		agent.IsFeatured = *req.IsFeatured
	}

	if err := h.agentRepo.Update(c.Request.Context(), agent); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update agent"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "agent updated successfully"})
}

// DeleteAgentAdmin 管理员删除Agent（无需所有权检查）
func (h *AgentHandler) DeleteAgentAdmin(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid agent id"})
		return
	}

	agent, err := h.agentRepo.GetByID(c.Request.Context(), uint(id))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch agent"})
		return
	}
	if agent == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "agent not found"})
		return
	}

	if err := h.agentRepo.Delete(c.Request.Context(), uint(id)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete agent"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "agent deleted successfully"})
}

// ListAgentsAdmin 管理员获取Agent列表（支持搜索、返回所有状态）
func (h *AgentHandler) ListAgentsAdmin(c *gin.Context) {
	var req struct {
		Search   string `form:"search"`
		Page     int    `form:"page,default=1"`
		PageSize int    `form:"page_size,default=20"`
	}
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	filters := make(map[string]interface{})
	if req.Search != "" {
		filters["search"] = req.Search
	}

	agents, total, err := h.agentRepo.ListAdmin(c.Request.Context(), filters, req.Page, req.PageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch agents"})
		return
	}

	var response []*AgentResponse
	for _, agent := range agents {
		response = append(response, agentToResponse(agent))
	}

	c.JSON(http.StatusOK, gin.H{
		"items": response,
		"total": total,
		"page":  req.Page,
		"size":  req.PageSize,
	})
}

// ============================================
// Marketplace 端点
// ============================================

// GetMarketplaceAgents 获取市场Agent列表
func (h *AgentHandler) GetMarketplaceAgents(c *gin.Context) {
	var req struct {
		SortBy    string `form:"sort_by,default=use_count"`
		SortOrder string `form:"sort_order,default=desc"`
		Type      string `form:"type"`
		Category  string `form:"category"`
		Page      int    `form:"page,default=1"`
		PageSize  int    `form:"page_size,default=20"`
	}
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	filters := make(map[string]interface{})
	if req.Type != "" {
		filters["type"] = req.Type
	}
	if req.Category != "" {
		filters["category"] = req.Category
	}

	result, err := h.marketplaceSvc.GetMarketplaceList(c.Request.Context(), filters, req.SortBy, req.SortOrder, req.Page, req.PageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

// GetMarketplaceAgentDetail 获取市场Agent详情
func (h *AgentHandler) GetMarketplaceAgentDetail(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid agent id"})
		return
	}

	var currentUserID *uuid.UUID
	if userIDStr, exists := c.Get("user_id"); exists {
		uid, err := uuid.Parse(userIDStr.(string))
		if err == nil {
			currentUserID = &uid
		}
	}

	result, err := h.marketplaceSvc.GetAgentDetail(c.Request.Context(), uint(id), currentUserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if result == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "agent not found"})
		return
	}

	c.JSON(http.StatusOK, result)
}

// SubscribeAgent 订阅Agent
func (h *AgentHandler) SubscribeAgent(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	uid, err := uuid.Parse(userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "invalid user id"})
		return
	}

	agentID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid agent id"})
		return
	}

	result, err := h.marketplaceSvc.SubscribeAgent(c.Request.Context(), uid, uint(agentID))
	if err != nil {
		if err.Error() == "agent not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		if err.Error() == "already subscribed" {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		if err.Error() == "vip required for free subscription" {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error(), "upgrade_url": "/pricing"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

// GetMySubscriptions 获取我的订阅列表
func (h *AgentHandler) GetMySubscriptions(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	uid, err := uuid.Parse(userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "invalid user id"})
		return
	}

	var req struct {
		Status   string `form:"status,default=active"`
		Page     int    `form:"page,default=1"`
		PageSize int    `form:"page_size,default=20"`
	}
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.marketplaceSvc.GetMySubscriptions(c.Request.Context(), uid, req.Status, req.Page, req.PageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

// CreateMarketplaceAgentRequest 创建Agent请求（市场端）
type CreateMarketplaceAgentRequest struct {
	Name        string     `json:"name" binding:"required,max=30"`
	Description string     `json:"description" binding:"max=300"`
	Type        string     `json:"type" binding:"required,max=30"`
	Category    string     `json:"category"`
	Model       string     `json:"model"`
	Prompt      string     `json:"prompt"`
	Price       float64    `json:"price"`
	PriceType   string     `json:"price_type"`
}

// CreateMarketplaceAgent 创建Agent（SVIP）
func (h *AgentHandler) CreateMarketplaceAgent(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	uid, err := uuid.Parse(userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "invalid user id"})
		return
	}

	var req CreateMarketplaceAgentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	agent, err := h.marketplaceSvc.CreateMarketplaceAgent(c.Request.Context(), uid, &service.CreateMarketplaceAgentRequest{
		Name:        req.Name,
		Description: req.Description,
		Type:        req.Type,
		Category:    req.Category,
		Model:       req.Model,
		Prompt:      req.Prompt,
		Price:       req.Price,
		PriceType:   req.PriceType,
	})
	if err != nil {
		if err.Error() == "agent name already exists" {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, agentToResponse(agent))
}

// SetFeatured 设置Agent为精选（管理员）
func (h *AgentHandler) SetFeatured(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid agent id"})
		return
	}

	agent, err := h.agentRepo.GetByID(c.Request.Context(), uint(id))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch agent"})
		return
	}
	if agent == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "agent not found"})
		return
	}

	var req struct {
		IsFeatured bool `json:"is_featured"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	agent.IsFeatured = req.IsFeatured
	if err := h.agentRepo.Update(c.Request.Context(), agent); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update agent"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "agent featured status updated"})
}
