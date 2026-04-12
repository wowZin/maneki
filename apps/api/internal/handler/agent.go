package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/maneki/api/internal/model"
	"github.com/maneki/api/internal/repository"
)

// AgentHandler Agent处理器
type AgentHandler struct {
	agentRepo       *repository.AgentRepository
	weightRepo      *repository.AgentWeightRepository
	subscriptionRepo *repository.AgentSubscriptionRepository
}

// NewAgentHandler 创建Agent处理器
func NewAgentHandler(
	agentRepo *repository.AgentRepository,
	weightRepo *repository.AgentWeightRepository,
	subscriptionRepo *repository.AgentSubscriptionRepository,
) *AgentHandler {
	return &AgentHandler{
		agentRepo:        agentRepo,
		weightRepo:       weightRepo,
		subscriptionRepo: subscriptionRepo,
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
	Price       float64 `json:"price"`
	PriceType   string  `json:"price_type"`
	IsFeatured  bool    `json:"is_featured"`
	IsOfficial  bool    `json:"is_official"`
	UseCount    int     `json:"use_count"`
	Rating      float64 `json:"rating"`
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
		response = append(response, &AgentResponse{
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
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  response,
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

	c.JSON(http.StatusOK, AgentResponse{
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
	})
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
		response = append(response, &AgentResponse{
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
		})
	}

	c.JSON(http.StatusOK, gin.H{"data": response})
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

// ListMySubscriptions 获取我的订阅列表
func (h *AgentHandler) ListMySubscriptions(c *gin.Context) {
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

	status := c.Query("status")
	subscriptions, err := h.subscriptionRepo.GetUserSubscriptions(c.Request.Context(), uid, status)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch subscriptions"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": subscriptions})
}

// CreateAgentRequest 创建Agent请求
type CreateAgentRequest struct {
	Name           string     `json:"name" binding:"required,max=100"`
	Description    string     `json:"description"`
	Avatar         string     `json:"avatar"`
	Type           string     `json:"type" binding:"required,max=30"`
	Category       string     `json:"category"`
	Price          float64    `json:"price"`
	PriceType      string     `json:"price_type"`
	StrategyConfig model.JSON `json:"strategy_config"`
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

	agent := &model.Agent{
		Name:           req.Name,
		Description:    req.Description,
		Avatar:         req.Avatar,
		Type:           req.Type,
		Category:       req.Category,
		Price:          req.Price,
		PriceType:      req.PriceType,
		StrategyConfig: req.StrategyConfig,
		IsActive:       true,
		OwnerID:        &uid,
	}

	if err := h.agentRepo.Create(c.Request.Context(), agent); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create agent"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id":      agent.ID,
		"message": "agent created successfully",
	})
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
