package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/maneki/api/internal/model"
	"github.com/maneki/api/internal/repository"
	"golang.org/x/crypto/bcrypt"
)

// UserHandler 用户管理处理器
type UserHandler struct {
	userRepo *repository.UserRepository
}

// NewUserHandler 创建用户管理处理器
func NewUserHandler(userRepo *repository.UserRepository) *UserHandler {
	return &UserHandler{userRepo: userRepo}
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

	// 设置默认值
	if req.Page < 1 {
		req.Page = 1
	}
	if req.PageSize < 1 || req.PageSize > 100 {
		req.PageSize = 20
	}

	ctx := c.Request.Context()

	var users []*model.User
	var total int64
	var err error

	// 构建查询条件
	if req.Search != "" || req.IsSuperuser != nil || req.IsActive != nil || req.VIPLevel != nil {
		// 使用搜索功能
		users, total, err = h.userRepo.SearchWithFilters(ctx, req.Search, req.IsSuperuser, req.IsActive, req.VIPLevel, req.Page, req.PageSize)
	} else {
		// 普通列表
		users, total, err = h.userRepo.List(ctx, req.Page, req.PageSize)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch users"})
		return
	}

	// 转换为响应格式
	var response []UserResponse
	for _, user := range users {
		response = append(response, userToResponse(user))
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  response,
		"total": total,
		"page":  req.Page,
		"size":  req.PageSize,
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

	user, err := h.userRepo.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch user"})
		return
	}

	if user == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
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

	ctx := c.Request.Context()

	// 检查邮箱是否已存在
	existingUser, _ := h.userRepo.GetByEmail(ctx, req.Email)
	if existingUser != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "email already exists"})
		return
	}

	// 检查用户名是否已存在
	existingUser, _ = h.userRepo.GetByUsername(ctx, req.Username)
	if existingUser != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "username already exists"})
		return
	}

	// 加密密码
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to hash password"})
		return
	}

	// 创建用户
	user := &model.User{
		Email:          req.Email,
		Username:       req.Username,
		Nickname:       req.Nickname,
		Phone:          req.Phone,
		HashedPassword: string(hashedPassword),
		IsActive:       req.IsActive,
		IsSuperuser:    req.IsSuperuser,
		IsVerified:     true, // 管理员创建的用户默认已验证
		RegisterSource: "admin",
		VIPLevel:       0,
	}

	if err := h.userRepo.Create(ctx, user); err != nil {
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

	ctx := c.Request.Context()

	// 获取现有用户
	user, err := h.userRepo.GetByID(ctx, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch user"})
		return
	}

	if user == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	// 检查是否尝试修改最后一个超管
	if req.IsSuperuser != nil && !*req.IsSuperuser && user.IsSuperuser {
		// 检查是否是最后一个超管
		count, err := h.userRepo.CountSuperusers(ctx)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check superuser count"})
			return
		}
		if count <= 1 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "cannot remove the last superuser"})
			return
		}
	}

	// 如果修改邮箱，检查是否已存在
	if req.Email != "" && req.Email != user.Email {
		existingUser, _ := h.userRepo.GetByEmail(ctx, req.Email)
		if existingUser != nil {
			c.JSON(http.StatusConflict, gin.H{"error": "email already exists"})
			return
		}
		user.Email = req.Email
	}

	// 如果修改用户名，检查是否已存在
	if req.Username != "" && req.Username != user.Username {
		existingUser, _ := h.userRepo.GetByUsername(ctx, req.Username)
		if existingUser != nil {
			c.JSON(http.StatusConflict, gin.H{"error": "username already exists"})
			return
		}
		user.Username = req.Username
	}

	// 更新字段
	if req.Nickname != "" {
		user.Nickname = req.Nickname
	}
	if req.Phone != "" {
		user.Phone = req.Phone
	}
	if req.IsSuperuser != nil {
		user.IsSuperuser = *req.IsSuperuser
	}
	if req.IsActive != nil {
		user.IsActive = *req.IsActive
	}

	if err := h.userRepo.Update(ctx, user); err != nil {
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

	ctx := c.Request.Context()

	// 获取用户
	user, err := h.userRepo.GetByID(ctx, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch user"})
		return
	}

	if user == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	// 不能删除自己
	currentUserID, _ := c.Get("user_id")
	if currentUserID == user.ID.String() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot delete yourself"})
		return
	}

	// 如果是超管，检查是否是最后一个
	if user.IsSuperuser {
		count, err := h.userRepo.CountSuperusers(ctx)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check superuser count"})
			return
		}
		if count <= 1 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "cannot delete the last superuser"})
			return
		}
	}

	if err := h.userRepo.Delete(ctx, id); err != nil {
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

	ctx := c.Request.Context()

	// 获取用户
	user, err := h.userRepo.GetByID(ctx, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch user"})
		return
	}

	if user == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	// 加密新密码
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to hash password"})
		return
	}

	// 更新密码
	user.HashedPassword = string(hashedPassword)
	if err := h.userRepo.Update(ctx, user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to reset password"})
		return
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

	ctx := c.Request.Context()

	// 获取用户
	user, err := h.userRepo.GetByID(ctx, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch user"})
		return
	}

	if user == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	// 不能禁用自己
	currentUserID, _ := c.Get("user_id")
	if currentUserID == user.ID.String() && action == "disable" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot disable yourself"})
		return
	}

	// 设置新状态
	newStatus := action == "enable"

	// 如果是超管，检查是否是最后一个活跃的超管
	if user.IsSuperuser && !newStatus {
		activeCount, err := h.userRepo.CountActiveSuperusers(ctx)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check active superuser count"})
			return
		}
		if activeCount <= 1 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "cannot disable the last active superuser"})
			return
		}
	}

	user.IsActive = newStatus
	if err := h.userRepo.Update(ctx, user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update user status"})
		return
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
	ctx := c.Request.Context()

	stats, err := h.userRepo.GetStats(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get stats"})
		return
	}

	c.JSON(http.StatusOK, stats)
}
