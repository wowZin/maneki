package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/maneki/api/internal/model"
	"github.com/maneki/api/internal/repository"
	"gorm.io/gorm"
)

// DashboardHandler 仪表盘处理器
type DashboardHandler struct {
	db               *gorm.DB
	userRepo         *repository.UserRepository
	agentRepo        *repository.AgentRepository
	rebateRecordRepo *repository.RebateRecordRepository
}

// NewDashboardHandler 创建仪表盘处理器
func NewDashboardHandler(db *gorm.DB, userRepo *repository.UserRepository, agentRepo *repository.AgentRepository, rebateRecordRepo *repository.RebateRecordRepository) *DashboardHandler {
	return &DashboardHandler{
		db:               db,
		userRepo:         userRepo,
		agentRepo:        agentRepo,
		rebateRecordRepo: rebateRecordRepo,
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
	AgentName    string  `json:"agent_name"`
	RebateAmount float64 `json:"rebate_amount"`
	Status       string  `json:"status"`
	CreatedAt    string  `json:"created_at"`
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
	now := time.Now()
	today := now.Format("2006-01-02")
	yesterday := now.Add(-24 * time.Hour).Format("2006-01-02")
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	lastMonthStart := monthStart.AddDate(0, -1, 0)

	// 统计总用户数
	var totalUsers int64
	h.db.Model(&User{}).Count(&totalUsers)

	// 统计今日新增用户
	var newUsersToday int64
	h.db.Model(&User{}).Where("DATE(created_at) = ?", today).Count(&newUsersToday)

	// 统计昨日新增用户（用于增长率）
	var newUsersYesterday int64
	h.db.Model(&User{}).Where("DATE(created_at) = ?", yesterday).Count(&newUsersYesterday)

	// 统计VIP用户数
	var vipUsers int64
	h.db.Model(&User{}).Where("vip_level > ?", 0).Count(&vipUsers)

	// 统计昨日VIP新增（用于增长率）
	var vipUsersYesterday int64
	h.db.Model(&User{}).Where("vip_level > ? AND DATE(created_at) = ?", 0, yesterday).Count(&vipUsersYesterday)

	// 统计Agent总数
	var totalAgents int64
	h.db.Model(&Agent{}).Count(&totalAgents)

	// 统计昨日新增Agent（用于增长率）
	var totalAgentsYesterday int64
	h.db.Model(&Agent{}).Where("DATE(created_at) = ?", yesterday).Count(&totalAgentsYesterday)

	// 本月返佣统计
	var monthlyRebate float64
	h.db.Model(&model.RebateRecord{}).Select("COALESCE(SUM(amount), 0)").Where("created_at >= ?", monthStart).Scan(&monthlyRebate)

	// 上月返佣（用于增长率）
	var lastMonthRebate float64
	h.db.Model(&model.RebateRecord{}).Select("COALESCE(SUM(amount), 0)").Where("created_at >= ? AND created_at < ?", lastMonthStart, monthStart).Scan(&lastMonthRebate)

	// 待结算返佣
	var pendingRebate float64
	h.db.Model(&model.RebateRecord{}).Select("COALESCE(SUM(amount), 0)").Where("status = ?", "pending").Scan(&pendingRebate)

	// 获取最近注册用户
	var recentUsers []RecentUser
	h.db.Raw(`
		SELECT id, email, vip_level, created_at::text as created_at
		FROM users
		ORDER BY created_at DESC
		LIMIT 5
	`).Scan(&recentUsers)

	// 获取热门Agent（真实数据）
	var hotAgents []HotAgent
	h.db.Raw(`
		SELECT id::text, name, use_count, rating
		FROM agents
		ORDER BY use_count DESC
		LIMIT 3
	`).Scan(&hotAgents)

	// 获取最近返佣记录
	var recentRebates []RecentRebate
	h.db.Raw(`
		SELECT a.name as agent_name, r.amount as rebate_amount, r.status, r.created_at::text as created_at
		FROM rebate_records r
		JOIN agents a ON r.agent_id = a.id
		ORDER BY r.created_at DESC
		LIMIT 5
	`).Scan(&recentRebates)

	// 组装响应数据
	stats := DashboardStats{
		TotalUsers:    totalUsers,
		NewUsersToday: newUsersToday,
		VIPUsers:      vipUsers,
		TotalAgents:   totalAgents,
		MonthlyRebate: monthlyRebate,
		PendingRebate: pendingRebate,
		UserGrowth:    calcGrowthRate(float64(newUsersToday), float64(newUsersYesterday)),
		VIPGrowth:     calcGrowthRate(float64(vipUsers), float64(vipUsersYesterday)),
		AgentGrowth:   calcGrowthRate(float64(totalAgents), float64(totalAgentsYesterday)),
		RebateGrowth:  calcGrowthRate(monthlyRebate, lastMonthRebate),
		RecentUsers:   recentUsers,
		RecentRebates: recentRebates,
		HotAgents:     hotAgents,
	}

	c.JSON(http.StatusOK, stats)
}

// calcGrowthRate 计算增长率，避免除以零
func calcGrowthRate(current, previous float64) float64 {
	if previous == 0 {
		if current == 0 {
			return 0
		}
		return 100.0
	}
	return ((current - previous) / previous) * 100
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
