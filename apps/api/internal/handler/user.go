package handler

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/maneki/api/internal/middleware"
	"github.com/maneki/api/internal/model"
	"github.com/maneki/api/internal/repository"
	"github.com/maneki/api/internal/service"
	"golang.org/x/crypto/bcrypt"
)

// UserHandler 用户管理处理器
type UserHandler struct {
	userSvc          *service.UserService
	auditSvc         *service.AuditService
	weightRepo       *repository.AgentWeightRepository
	subscriptionRepo *repository.AgentSubscriptionRepository
	userLevelRepo    *repository.UserLevelRepository
	levelMap         map[int]*model.UserLevel
}

// NewUserHandler 创建用户管理处理器
func NewUserHandler(userSvc *service.UserService, auditSvc *service.AuditService, weightRepo *repository.AgentWeightRepository, subscriptionRepo *repository.AgentSubscriptionRepository, userLevelRepo *repository.UserLevelRepository) *UserHandler {
	h := &UserHandler{
		userSvc:          userSvc,
		auditSvc:         auditSvc,
		weightRepo:       weightRepo,
		subscriptionRepo: subscriptionRepo,
		userLevelRepo:    userLevelRepo,
	}
	// 预加载等级字典到内存
	h.reloadLevelMap()
	return h
}

// reloadLevelMap 从数据库重新加载等级字典
func (h *UserHandler) reloadLevelMap() {
	levels, _ := h.userLevelRepo.ListAll(context.Background())
	m := make(map[int]*model.UserLevel, len(levels))
	for i := range levels {
		m[levels[i].LevelValue] = &levels[i]
	}
	h.levelMap = m
}

// vipLevelToLabel 将VIP等级转换为中文标签（从字典表读取）
func (h *UserHandler) vipLevelToLabel(level int) string {
	if l, ok := h.levelMap[level]; ok {
		return l.Name
	}
	return "普通用户"
}

// vipLevelToColor 将VIP等级转换为颜色（从字典表读取）
func (h *UserHandler) vipLevelToColor(level int) string {
	if l, ok := h.levelMap[level]; ok {
		return l.Color
	}
	return "default"
}

// ListUsersRequest 用户列表查询请求
type ListUsersRequest struct {
	Page       int    `form:"page"`
	PageSize   int    `form:"page_size"`
	Search     string `form:"search"`
	IsSuperuser *bool  `form:"is_superuser"`
	IsActive   *bool  `form:"is_active"`
	VIPLevel   *int   `form:"vip_level"`
	VIPLevels  string `form:"vip_levels"`
	SortBy     string `form:"sort_by"`
	SortOrder  string `form:"sort_order"`
}

// CreateUserRequest 创建用户请求
type CreateUserRequest struct {
	Email       string `json:"email" binding:"required,email"`
	Username    string `json:"username" binding:"required,min=3,max=50"`
	Password    string `json:"password" binding:"required,min=6"`
	Nickname    string `json:"nickname"`
	Phone       string `json:"phone"`
	IsSuperuser bool   `json:"is_superuser"`
	IsActive    bool   `json:"is_active"`
}

// UpdateUserRequest 更新用户请求
type UpdateUserRequest struct {
	Email       string `json:"email" binding:"omitempty,email"`
	Username    string `json:"username" binding:"omitempty,min=3,max=50"`
	Nickname    string `json:"nickname"`
	Phone       string `json:"phone"`
	IsSuperuser *bool  `json:"is_superuser"`
	IsActive    *bool  `json:"is_active"`
}

// ResetPasswordRequest 重置密码请求
type ResetPasswordRequest struct {
	NewPassword string `json:"new_password" binding:"required,min=6"`
}

// UserResponse 用户响应（不包含敏感信息）
type UserResponse struct {
	ID             string          `json:"id"`
	Email          string          `json:"email"`
	Username       string          `json:"username"`
	Nickname       string          `json:"nickname"`
	Phone          string          `json:"phone"`
	AvatarURL      string          `json:"avatar_url"`
	IsActive       bool            `json:"is_active"`
	IsSuperuser    bool            `json:"is_superuser"`
	IsVerified     bool            `json:"is_verified"`
	VIPLevel       int             `json:"vip_level"`
	VIPLevelLabel  string          `json:"vip_level_label"`
	VIPLevelColor  string          `json:"vip_level_color"`
	VIPExpireAt    *string         `json:"vip_expire_at,omitempty"`
	BoardAccuracy  *float64        `json:"board_accuracy,omitempty"`
	RegisterSource string          `json:"register_source"`
	CreatedAt      string          `json:"created_at"`
	UpdatedAt      string          `json:"updated_at"`
	Agents         []UserAgentItem `json:"agents,omitempty"`
}

// UserAgentItem 用户关联的Agent数据
type UserAgentItem struct {
	AgentID             uint    `json:"agent_id"`
	AgentName           string  `json:"agent_name"`
	AgentType           string  `json:"agent_type"`
	SubscriptionStatus  string  `json:"subscription_status"`
	SubscriptionEndDate *string `json:"subscription_end_date,omitempty"`
	Weight              float64 `json:"weight"`
	IsWeightEnabled     bool    `json:"is_weight_enabled"`
	AgentRating         float64 `json:"agent_rating"`
	AgentUseCount       int     `json:"agent_use_count"`
}

// ListUsers 获取用户列表
func (h *UserHandler) ListUsers(c *gin.Context) {
	var req ListUsersRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 解析多选VIP等级
	var vipLevels []int
	if req.VIPLevels != "" {
		parts := strings.Split(req.VIPLevels, ",")
		for _, p := range parts {
			p = strings.TrimSpace(p)
			if p == "" {
				continue
			}
			lvl, err := strconv.Atoi(p)
			if err == nil {
				vipLevels = append(vipLevels, lvl)
			}
		}
	}

	result, err := h.userSvc.ListUsers(c.Request.Context(), req.Search, req.IsSuperuser, req.IsActive, req.VIPLevel, vipLevels, req.SortBy, req.SortOrder, req.Page, req.PageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch users"})
		return
	}

	var response []UserResponse
	for _, user := range result.List {
		response = append(response, h.userToResponse(user))
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  response,
		"total": result.Total,
		"page":  result.Page,
		"size":  result.PageSize,
	})
}

// GetUser 获取单个用户详情（包含Agent数据）
func (h *UserHandler) GetUser(c *gin.Context) {
	userID := c.Param("id")

	id, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	user, err := h.userSvc.GetUser(c.Request.Context(), id)
	if err != nil {
		if err.Error() == "user not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch user"})
		return
	}

	resp := h.userToResponse(user)

	// 聚合Agent数据
	agents, err := h.buildUserAgents(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch user agents"})
		return
	}
	resp.Agents = agents

	c.JSON(http.StatusOK, resp)
}

// buildUserAgents 构建用户关联的Agent数据
func (h *UserHandler) buildUserAgents(ctx context.Context, userID uuid.UUID) ([]UserAgentItem, error) {
	// 获取订阅列表
	subs, err := h.subscriptionRepo.GetUserSubscriptions(ctx, userID, "")
	if err != nil {
		return nil, err
	}

	// 获取权重配置
	weights, err := h.weightRepo.GetUserWeights(ctx, userID)
	if err != nil {
		return nil, err
	}

	// 构建权重查找map
	weightMap := make(map[uint]*model.AgentWeight)
	for _, w := range weights {
		weightMap[w.AgentID] = w
	}

	var items []UserAgentItem
	for _, sub := range subs {
		if sub.Agent.ID == 0 {
			continue
		}

		item := UserAgentItem{
			AgentID:            sub.Agent.ID,
			AgentName:          sub.Agent.Name,
			AgentType:          sub.Agent.Type,
			SubscriptionStatus: sub.Status,
			AgentRating:        sub.Agent.Rating,
			AgentUseCount:      sub.Agent.UseCount,
			Weight:             1.0,
			IsWeightEnabled:    true,
		}

		if sub.EndDate != nil {
			endDate := sub.EndDate.Format("2006-01-02 15:04:05")
			item.SubscriptionEndDate = &endDate
		}

		if w, ok := weightMap[sub.AgentID]; ok {
			item.Weight = w.Weight
			item.IsWeightEnabled = w.IsEnabled
		}

		items = append(items, item)
	}

	// 补充有权重配置但没有订阅的Agent（权重配置可能存在于免费Agent）
	for _, w := range weights {
		hasSub := false
		for _, sub := range subs {
			if sub.AgentID == w.AgentID {
				hasSub = true
				break
			}
		}
		if !hasSub && w.Agent.ID != 0 {
			item := UserAgentItem{
				AgentID:            w.Agent.ID,
				AgentName:          w.Agent.Name,
				AgentType:          w.Agent.Type,
				SubscriptionStatus: "",
				AgentRating:        w.Agent.Rating,
				AgentUseCount:      w.Agent.UseCount,
				Weight:             w.Weight,
				IsWeightEnabled:    w.IsEnabled,
			}
			items = append(items, item)
		}
	}

	return items, nil
}

// CreateUser 创建新用户（管理员功能）
func (h *UserHandler) CreateUser(c *gin.Context) {
	var req CreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := h.userSvc.CreateUser(c.Request.Context(), &service.CreateUserRequest{
		Email:       req.Email,
		Username:    req.Username,
		Password:    req.Password,
		Nickname:    req.Nickname,
		Phone:       req.Phone,
		IsSuperuser: req.IsSuperuser,
		IsActive:    req.IsActive,
	})
	if err != nil {
		if err.Error() == "email already exists" {
			c.JSON(http.StatusConflict, gin.H{"error": "email already exists"})
			return
		}
		if err.Error() == "username already exists" {
			c.JSON(http.StatusConflict, gin.H{"error": "username already exists"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create user"})
		return
	}

	c.JSON(http.StatusCreated, h.userToResponse(user))
}

// UpdateUser 更新用户信息
func (h *UserHandler) UpdateUser(c *gin.Context) {
	userID := c.Param("id")

	id, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	var req UpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := h.userSvc.UpdateUser(c.Request.Context(), id, &service.UpdateUserRequest{
		Email:       req.Email,
		Username:    req.Username,
		Nickname:    req.Nickname,
		Phone:       req.Phone,
		IsSuperuser: req.IsSuperuser,
		IsActive:    req.IsActive,
	})
	if err != nil {
		if err.Error() == "user not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
			return
		}
		if err.Error() == "cannot remove the last superuser" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "cannot remove the last superuser"})
			return
		}
		if err.Error() == "email already exists" {
			c.JSON(http.StatusConflict, gin.H{"error": "email already exists"})
			return
		}
		if err.Error() == "username already exists" {
			c.JSON(http.StatusConflict, gin.H{"error": "username already exists"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update user"})
		return
	}

	c.JSON(http.StatusOK, h.userToResponse(user))
}

// DeleteUser 删除用户
func (h *UserHandler) DeleteUser(c *gin.Context) {
	userID := c.Param("id")

	id, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	// 不能删除自己
	currentUserID, _ := c.Get("user_id")
	if currentUserID == userID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot delete yourself"})
		return
	}

	if err := h.userSvc.DeleteUser(c.Request.Context(), id); err != nil {
		if err.Error() == "user not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
			return
		}
		if err.Error() == "cannot delete the last superuser" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "cannot delete the last superuser"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete user"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "user deleted successfully"})
}

// ResetPassword 重置用户密码
func (h *UserHandler) ResetPassword(c *gin.Context) {
	userID := c.Param("id")

	id, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	var req ResetPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := h.userSvc.GetUser(c.Request.Context(), id)
	if err != nil {
		if err.Error() == "user not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch user"})
		return
	}

	if err := h.userSvc.ResetPassword(c.Request.Context(), id, req.NewPassword); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to reset password"})
		return
	}

	// 记录审计日志
	if h.auditSvc != nil {
		adminID, _ := middleware.GetCurrentAdminID(c)
		adminName, _ := middleware.GetCurrentAdminName(c)
		_ = h.auditSvc.RecordAuditLog(c.Request.Context(), adminID, adminName, model.AuditActionResetUserPassword, model.AuditTargetUser, nil, user.Username, "")
	}

	c.JSON(http.StatusOK, gin.H{"message": "password reset successfully"})
}

// ToggleUserStatus 切换用户启用/禁用状态
func (h *UserHandler) ToggleUserStatus(c *gin.Context) {
	userID := c.Param("id")
	action := c.Param("action")

	if action != "enable" && action != "disable" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid action, use 'enable' or 'disable'"})
		return
	}

	id, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	// 不能禁用自己
	currentUserID, _ := c.Get("user_id")
	if currentUserID == userID && action == "disable" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot disable yourself"})
		return
	}

	newStatus := action == "enable"
	user, err := h.userSvc.ToggleUserStatus(c.Request.Context(), id, newStatus)
	if err != nil {
		if err.Error() == "user not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
			return
		}
		if err.Error() == "cannot disable the last active superuser" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "cannot disable the last active superuser"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update user status"})
		return
	}

	// 记录审计日志
	if h.auditSvc != nil {
		adminID, _ := middleware.GetCurrentAdminID(c)
		adminName, _ := middleware.GetCurrentAdminName(c)
		var auditAction model.AuditAction
		if newStatus {
			auditAction = model.AuditActionEnableUser
		} else {
			auditAction = model.AuditActionDisableUser
		}
		_ = h.auditSvc.RecordAuditLog(c.Request.Context(), adminID, adminName, auditAction, model.AuditTargetUser, nil, user.Username, "")
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "user " + action + "d successfully",
		"user":    h.userToResponse(user),
	})
}

// userToResponse 将模型转换为响应
func (h *UserHandler) userToResponse(user *model.User) UserResponse {
	resp := UserResponse{
		ID:             user.ID.String(),
		Email:          user.Email,
		Username:       user.Username,
		Nickname:       user.Nickname,
		Phone:          user.Phone,
		AvatarURL:      user.AvatarURL,
		IsActive:       user.IsActive,
		IsSuperuser:    user.IsSuperuser,
		IsVerified:     user.IsVerified,
		VIPLevel:       user.VIPLevel,
		VIPLevelLabel:  h.vipLevelToLabel(user.VIPLevel),
		VIPLevelColor:  h.vipLevelToColor(user.VIPLevel),
		BoardAccuracy:  user.BoardAccuracy,
		RegisterSource: user.RegisterSource,
		CreatedAt:      user.CreatedAt.Format("2006-01-02 15:04:05"),
		UpdatedAt:      user.UpdatedAt.Format("2006-01-02 15:04:05"),
	}
	if user.VIPExpireAt != nil {
		expireAt := user.VIPExpireAt.Format("2006-01-02 15:04:05")
		resp.VIPExpireAt = &expireAt
	}
	return resp
}

// ListUserLevels 获取用户等级字典列表
func (h *UserHandler) ListUserLevels(c *gin.Context) {
	levels, err := h.userLevelRepo.ListActive(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get user levels"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": levels})
}

// GetUserStats 获取用户统计信息
func (h *UserHandler) GetUserStats(c *gin.Context) {
	stats, err := h.userSvc.GetUserStats(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get stats"})
		return
	}

	c.JSON(http.StatusOK, stats)
}

// ==================== 用户端个人信息接口 ====================

// ProfileResponse 用户个人信息响应
 type ProfileResponse struct {
	ID            string  `json:"id"`
	Nickname      string  `json:"nickname"`
	AvatarURL     string  `json:"avatar_url"`
	Phone         string  `json:"phone"`
	VIPLevel      int     `json:"vip_level"`
	VIPLevelName  string  `json:"vip_level_name"`
	VIPLevelColor string  `json:"vip_level_color"`
	VIPExpireAt   *string `json:"vip_expire_at,omitempty"`
	CreatedAt     string  `json:"created_at"`
}

// MaskPhone 手机号脱敏
func MaskPhone(phone string) string {
	if len(phone) < 7 {
		return phone
	}
	return phone[:3] + "****" + phone[len(phone)-4:]
}

// GetMeProfile 获取当前用户个人信息
func (h *UserHandler) GetMeProfile(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未登录"})
		return
	}

	id, err := uuid.Parse(userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "invalid user id"})
		return
	}

	user, err := h.userSvc.GetUser(c.Request.Context(), id)
	if err != nil {
		if err.Error() == "user not found" {
			c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "用户不存在"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "获取用户信息失败"})
		return
	}

	resp := ProfileResponse{
		ID:            user.ID.String(),
		Nickname:      user.Nickname,
		AvatarURL:     user.AvatarURL,
		Phone:         MaskPhone(user.Phone),
		VIPLevel:      user.VIPLevel,
		VIPLevelName:  h.vipLevelToLabel(user.VIPLevel),
		VIPLevelColor: h.vipLevelToColor(user.VIPLevel),
		CreatedAt:     user.CreatedAt.Format("2006-01-02 15:04:05"),
	}
	if user.VIPExpireAt != nil {
		expireAt := user.VIPExpireAt.Format("2006-01-02 15:04:05")
		resp.VIPExpireAt = &expireAt
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "success", "data": resp})
}

// UpdateMeRequest 修改个人信息请求
type UpdateMeRequest struct {
	Nickname string `json:"nickname" binding:"required,min=2,max=20"`
}

// UpdateMe 修改当前用户昵称
func (h *UserHandler) UpdateMe(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未登录"})
		return
	}

	id, err := uuid.Parse(userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "invalid user id"})
		return
	}

	var req UpdateMeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "昵称格式错误：2-20个字符"})
		return
	}

	// 正则校验：中文/字母/数字/下划线
	re := regexp.MustCompile("^[\\u4e00-\\u9fa5a-zA-Z0-9_]+$")
	if !re.MatchString(req.Nickname) {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "昵称只能包含中文、字母、数字或下划线"})
		return
	}

	// 检查昵称唯一性
	existing, err := h.userSvc.GetUser(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "查询用户失败"})
		return
	}
	if existing == nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "用户不存在"})
		return
	}

	// 如果昵称没变，直接返回
	if existing.Nickname == req.Nickname {
		c.JSON(http.StatusOK, gin.H{"code": 0, "message": "success", "data": gin.H{"id": id.String(), "nickname": req.Nickname}})
		return
	}

	// 更新昵称
	_, err = h.userSvc.UpdateUser(c.Request.Context(), id, &service.UpdateUserRequest{
		Nickname: req.Nickname,
	})
	if err != nil {
		if err.Error() == "user not found" {
			c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "用户不存在"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "更新失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "success", "data": gin.H{"id": id.String(), "nickname": req.Nickname}})
}

// UploadAvatar 上传用户头像
func (h *UserHandler) UploadAvatar(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未登录"})
		return
	}

	id, err := uuid.Parse(userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "invalid user id"})
		return
	}

	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "请选择要上传的文件"})
		return
	}

	// 校验文件大小 (5MB)
	const maxSize = 5 * 1024 * 1024
	if file.Size > maxSize {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "文件大小不能超过5MB"})
		return
	}

	// 校验文件类型
	ext := strings.ToLower(filepath.Ext(file.Filename))
	if ext != ".jpg" && ext != ".jpeg" && ext != ".png" {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "仅支持 jpg/png 格式"})
		return
	}

	// 打开上传文件
	src, err := file.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "读取文件失败"})
		return
	}
	defer src.Close()

	// 读取前512字节检测MIME类型
	buffer := make([]byte, 512)
	n, err := src.Read(buffer)
	if err != nil && err != io.EOF {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "读取文件失败"})
		return
	}
	mimeType := http.DetectContentType(buffer[:n])
	if !strings.HasPrefix(mimeType, "image/jpeg") && !strings.HasPrefix(mimeType, "image/png") {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "仅支持 jpg/png 格式"})
		return
	}

	// 确保上传目录存在
	uploadDir := "uploads/avatars"
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "创建上传目录失败"})
		return
	}

	// 生成唯一文件名
	filename := fmt.Sprintf("%s_%d%s", id.String(), time.Now().Unix(), ext)
	dstPath := filepath.Join(uploadDir, filename)

	// 保存文件
	dst, err := os.Create(dstPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "保存文件失败"})
		return
	}
	defer dst.Close()

	// 将已读取的头部写回
	if _, err := dst.Write(buffer[:n]); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "保存文件失败"})
		return
	}

	// 复制剩余内容
	if _, err := io.Copy(dst, src); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "保存文件失败"})
		return
	}

	// 构建访问URL
	avatarURL := fmt.Sprintf("/uploads/avatars/%s", filename)

	// 更新用户头像
	user, err := h.userSvc.GetUser(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "查询用户失败"})
		return
	}
	user.AvatarURL = avatarURL
	if err := h.userSvc.UpdateUserRaw(c.Request.Context(), user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "更新头像失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "success", "data": gin.H{"avatar_url": avatarURL}})
}

// ChangePasswordRequest 修改密码请求
type ChangePasswordRequest struct {
	OldPassword     string `json:"old_password" binding:"required"`
	NewPassword     string `json:"new_password" binding:"required,min=6"`
	ConfirmPassword string `json:"confirm_password" binding:"required"`
}

// ChangePassword 修改当前用户密码
func (h *UserHandler) ChangePassword(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未登录"})
		return
	}

	id, err := uuid.Parse(userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "invalid user id"})
		return
	}

	var req ChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "参数校验失败：新密码至少6位"})
		return
	}

	// 确认密码一致性
	if req.NewPassword != req.ConfirmPassword {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "两次输入的新密码不一致"})
		return
	}

	// 获取用户
	user, err := h.userSvc.GetUser(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "查询用户失败"})
		return
	}
	if user == nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "用户不存在"})
		return
	}

	// 验证旧密码
	if err := bcrypt.CompareHashAndPassword([]byte(user.HashedPassword), []byte(req.OldPassword)); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"code": 403, "message": "旧密码错误"})
		return
	}

	// 更新密码
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "密码加密失败"})
		return
	}

	user.HashedPassword = string(hashedPassword)
	if err := h.userSvc.UpdateUserRaw(c.Request.Context(), user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "密码修改失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "密码修改成功"})
}

// RebateSummaryResponse 返佣汇总响应
type RebateSummaryResponse struct {
	TotalRebate   float64 `json:"total_rebate"`
	PendingRebate float64 `json:"pending_rebate"`
	SettledRebate float64 `json:"settled_rebate"`
	Currency      string  `json:"currency"`
}

// GetMyRebate 获取当前用户返佣汇总（仅SVIP）
func (h *UserHandler) GetMyRebate(c *gin.Context) {
	vipLevel, exists := c.Get("vip_level")
	if !exists || vipLevel.(int) < 2 {
		c.JSON(http.StatusForbidden, gin.H{"code": 403, "message": "仅SVIP用户可查看返佣数据"})
		return
	}

	// TODO: 当前 rebate_records 表的 creator_id 为 uint 类型，
	// 与 users 表的 uuid 主键不兼容。需要建立映射后才能查询真实数据。
	// 目前返回零值，前端可正常渲染。
	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data": RebateSummaryResponse{
			TotalRebate:   0,
			PendingRebate: 0,
			SettledRebate: 0,
			Currency:      "¥",
		},
	})
}
