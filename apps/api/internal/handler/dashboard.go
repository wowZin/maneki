package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/maneki/api/internal/repository"
	"gorm.io/gorm"
)

// DashboardHandler 仪表盘处理器
type DashboardHandler struct {
	db           *gorm.DB
	userRepo     *repository.UserRepository
	agentRepo    *repository.AgentRepository
}

// NewDashboardHandler 创建仪表盘处理器
func NewDashboardHandler(db *gorm.DB, userRepo *repository.UserRepository, agentRepo *repository.AgentRepository) *DashboardHandler {
	return &DashboardHandler{
		db:        db,
		userRepo:  userRepo,
		agentRepo: agentRepo,
	}
}

// DashboardStats 仪表盘统计数据
type DashboardStats struct {
	TotalUsers     int64   `json:"total_users"`
	NewUsersToday  int64   `json:"new_users_today"`
	VIPUsers       int64   `json:"vip_users"`
	TotalAgents    int64   `json:"total_agents"`
	MonthlyRebate  float64 `json:"monthly_rebate"`
	PendingRebate  float64 `json:"pending_rebate"`
	UserGrowth     float64 `json:"user_growth"`
	VIPGrowth      float64 `json:"vip_growth"`
	AgentGrowth    float64 `json:"agent_growth"`
	RebateGrowth   float64 `json:"rebate_growth"`
	RecentUsers    []RecentUser `json:"recent_users"`
	RecentRebates  []RecentRebate `json:"recent_rebates"`
	HotAgents      []HotAgent `json:"hot_agents"`
}

// RecentUser 最近注册用户
type RecentUser struct {
	ID        string `json:"id"`
	Email     string `json:"email"`
	VIPLevel  int    `json:"vip_level"`
	CreatedAt string `json:"created_at"`
}

// RecentRebate 最近返佣记录
type RecentRebate struct {
	OwnerEmail    string  `json:"owner_email"`
	RebateAmount  float64 `json:"rebate_amount"`
	Status        string  `json:"status"`
	CreatedAt     string  `json:"created_at"`
}

// HotAgent 热门Agent
type HotAgent struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	UsageCount  int     `json:"usage_count"`
	Rating      float64 `json:"rating"`
}

// GetDashboardStats 获取仪表盘统计数据
func (h *DashboardHandler) GetDashboardStats(c *gin.Context) {
	// 统计总用户数
	var totalUsers int64
	h.db.Model(&User{}).Count(&totalUsers)

	// 统计今日新增用户
	today := time.Now().Format("2006-01-02")
	var newUsersToday int64
	h.db.Model(&User{}).Where("DATE(created_at) = ?", today).Count(&newUsersToday)

	// 统计VIP用户数
	var vipUsers int64
	h.db.Model(&User{}).Where("vip_level > ?", 0).Count(&vipUsers)

	// 统计Agent总数
	var totalAgents int64
	h.db.Model(&Agent{}).Count(&totalAgents)

	// 获取最近注册用户
	var recentUsers []RecentUser
	h.db.Raw(`
		SELECT id, email, vip_level, created_at::text as created_at
		FROM users
		ORDER BY created_at DESC
		LIMIT 5
	`).Scan(&recentUsers)

	// 获取热门Agent（示例数据）
	hotAgents := []HotAgent{
		{ID: "1", Name: "技术分析助手", UsageCount: 1234, Rating: 4.8},
		{ID: "2", Name: "基本面分析助手", UsageCount: 892, Rating: 4.6},
		{ID: "3", Name: "量化策略助手", UsageCount: 756, Rating: 4.5},
	}

	// 组装响应数据
	stats := DashboardStats{
		TotalUsers:    totalUsers,
		NewUsersToday: newUsersToday,
		VIPUsers:      vipUsers,
		TotalAgents:   totalAgents,
		MonthlyRebate: 1234.56,
		PendingRebate: 567.89,
		UserGrowth:    12.5,
		VIPGrowth:     8.3,
		AgentGrowth:   15.2,
		RebateGrowth:  23.1,
		RecentUsers:   recentUsers,
		RecentRebates: []RecentRebate{
			{OwnerEmail: "user1@example.com", RebateAmount: 99.99, Status: "settled", CreatedAt: time.Now().Add(-24 * time.Hour).Format("2006-01-02 15:04")},
			{OwnerEmail: "user2@example.com", RebateAmount: 150.00, Status: "pending", CreatedAt: time.Now().Add(-48 * time.Hour).Format("2006-01-02 15:04")},
		},
		HotAgents: hotAgents,
	}

	c.JSON(http.StatusOK, stats)
}

// User 简化用户模型（用于统计）
type User struct {
	ID        string `gorm:"type:uuid"`
	Email     string
	VIPLevel  int `gorm:"column:vip_level"`
	CreatedAt time.Time
}

func (User) TableName() string {
	return "users"
}

// Agent 简化Agent模型（用于统计）
type Agent struct {
	ID   uint
	Name string
}

func (Agent) TableName() string {
	return "agents"
}
