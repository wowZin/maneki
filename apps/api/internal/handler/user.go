package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/maneki/api/internal/middleware"
	"github.com/maneki/api/internal/model"
	"github.com/maneki/api/internal/service"
)

// UserHandler 用户管理处理器
type UserHandler struct {
	userSvc  *service.UserService
	auditSvc *service.AuditService
}

// NewUserHandler 创建用户管理处理器
func NewUserHandler(userSvc *service.UserService, auditSvc *service.AuditService) *UserHandler {
	return &UserHandler{userSvc: userSvc, auditSvc: auditSvc}
}

// ListUsersRequest 用户列表查询请求
type ListUsersRequest struct {
	Page       int    `form:"page"`
	PageSize   int    `form:"page_size"`
	Search     string `form:"search"`
	IsSuperuser *bool  `form:"is_superuser"`
	IsActive   *bool  `form:"is_active"`
	VIPLevel   *int   `form:"vip_level"`
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
	ID          string `json:"id"`
	Email       string `json:"email"`
	Username    string `json:"username"`
	Nickname    string `json:"nickname"`
	Phone       string `json:"phone"`
	AvatarURL   string `json:"avatar_url"`
	IsActive    bool   `json:"is_active"`
	IsSuperuser bool   `json:"is_superuser"`
	IsVerified  bool   `json:"is_verified"`
	VIPLevel    int    `json:"vip_level"`
	RegisterSource string `json:"register_source"`
	CreatedAt   string `json:"created_at"`
	UpdatedAt   string `json:"updated_at"`
}

// ListUsers 获取用户列表
func (h *UserHandler) ListUsers(c *gin.Context) {
	var req ListUsersRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.userSvc.ListUsers(c.Request.Context(), req.Search, req.IsSuperuser, req.IsActive, req.VIPLevel, req.Page, req.PageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch users"})
		return
	}

	var response []UserResponse
	for _, user := range result.List {
		response = append(response, userToResponse(user))
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  response,
		"total": result.Total,
		"page":  result.Page,
		"size":  result.PageSize,
	})
}

// GetUser 获取单个用户详情
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

	c.JSON(http.StatusOK, userToResponse(user))
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

	c.JSON(http.StatusCreated, userToResponse(user))
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

	c.JSON(http.StatusOK, userToResponse(user))
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
		"user":    userToResponse(user),
	})
}

// userToResponse 将模型转换为响应
func userToResponse(user *model.User) UserResponse {
	return UserResponse{
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
		RegisterSource: user.RegisterSource,
		CreatedAt:      user.CreatedAt.Format("2006-01-02 15:04:05"),
		UpdatedAt:      user.UpdatedAt.Format("2006-01-02 15:04:05"),
	}
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
