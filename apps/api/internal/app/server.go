package app

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/maneki/api/internal/config"
	"github.com/maneki/api/internal/handler"
	"github.com/maneki/api/internal/middleware"
	"github.com/maneki/api/internal/model"
	"github.com/maneki/api/internal/repository"
	"github.com/maneki/api/internal/service"
)

// Server 封装应用服务器及其依赖
type Server struct {
	Engine       *gin.Engine
	Config       *config.Config
	DB           *gorm.DB
	Redis        *redis.Client
	Repositories *Repositories
	Services     *Services
	Handlers     *Handlers
	Middleware   *Middleware
}

// Services 聚合所有服务层依赖
type Services struct {
	AdminAuth     *service.AdminAuthService
	Admin         *service.AdminService
	Audit         *service.AuditService
	User          *service.UserService
	RebateRule    *service.RebateRuleService
	RebateRecord  *service.RebateRecordService
	AntiArbitrage *service.AntiArbitrageService
	RebateStats   *service.RebateStatsService
	Overview      *service.OverviewService
	Signal        *service.SignalService
	Marketplace   *service.MarketplaceService
	Backtest      *service.BacktestService
	SMS           service.SMSService
}

// Handlers 聚合所有处理器
type Handlers struct {
	Auth             *handler.AuthHandler
	AdminAuth        *handler.AdminAuthHandler
	AdminMgmt        *handler.AdminMgmtHandler
	Audit            *handler.AuditHandler
	Agent            *handler.AgentHandler
	Stock            *handler.StockHandler
	Datasource       *handler.DatasourceHandler
	Settings         *handler.SettingsHandler
	Dashboard        *handler.DashboardHandler
	User             *handler.UserHandler
	Notification     *handler.NotificationHandler
	SysNotification  *handler.SystemNotificationHandler
	RebateRule       *handler.RebateRuleHandler
	RebateRecord     *handler.RebateRecordHandler
	AntiArbitrage    *handler.AntiArbitrageHandler
	RebateStats      *handler.RebateStatsHandler
	Pricing          *handler.PricingHandler
	Overview         *handler.OverviewHandler
	Signal           *handler.SignalHandler
	Backtest         *handler.BacktestHandler
}

// Middleware 聚合中间件
type Middleware struct {
	Auth                gin.HandlerFunc
	AdminAuth           gin.HandlerFunc
	AdminRequired       gin.HandlerFunc
	SuperAdminRequired  gin.HandlerFunc
	SVIPAuth            gin.HandlerFunc
	VIPAuth             gin.HandlerFunc
	InternalToken       gin.HandlerFunc
}

// NewServer 创建应用服务器实例
// 该函数被 cmd/main.go 和集成测试共享
func NewServer(cfg *config.Config) (*Server, error) {
	if cfg.Debug {
		gin.SetMode(gin.DebugMode)
	} else {
		gin.SetMode(gin.ReleaseMode)
	}

	// 初始化数据库
	db, err := initDB(cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	// 初始化Redis
	redisClient := initRedis(cfg)

	// 初始化仓库
	repos := initRepositories(db)

	// 初始化数据源
	dataProvider := service.NewDataProvider(cfg, db, redisClient)

	// 初始化服务
	svcs := initServices(cfg, repos, redisClient, dataProvider)

	// 初始化处理器
	handlers := initHandlers(cfg, repos, svcs, db, redisClient, dataProvider)

	// 初始化中间件
	mw := initMiddleware(cfg, redisClient)

	// 创建路由
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(middleware.ErrorHandler())
	r.Use(middleware.Logger())
	r.Use(middleware.CORS(cfg))
	r.Use(middleware.SecurityHeaders())
	r.NoRoute(middleware.NoRouteHandler())
	r.NoMethod(middleware.NoMethodHandler())

	// 健康检查
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status": "ok",
			"time":   time.Now().Format(time.RFC3339),
		})
	})

	// 注册API路由
	registerRoutes(r, handlers, mw)

	return &Server{
		Engine:       r,
		Config:       cfg,
		DB:           db,
		Redis:        redisClient,
		Repositories: repos,
		Services:     svcs,
		Handlers:     handlers,
		Middleware:   mw,
	}, nil
}

// Repositories 聚合所有仓库
type Repositories struct {
	User             *repository.UserRepository
	Admin            *repository.AdminRepository
	AuditLog         *repository.AuditLogRepository
	Agent            *repository.AgentRepository
	AgentWeight      *repository.AgentWeightRepository
	Subscription     *repository.AgentSubscriptionRepository
	News             *repository.NewsRepository
	TopList          *repository.TopListRepository
	TopInst          *repository.TopInstRepository
	HotMoney         *repository.HotMoneyRepository
	Settings         *repository.SettingsRepository
	UserLevel        *repository.UserLevelRepository
	Notification     *repository.NotificationRepository
	SysNotification  *repository.SystemNotificationRepository
	RebateRule       *repository.RebateRuleRepository
	RebateRecord     *repository.RebateRecordRepository
	AntiArbitrage    *repository.AntiArbitrageRuleRepository
	RebateAuditLog   *repository.RebateAuditLogRepository
	Overview         *repository.OverviewRepository
	Signal           *repository.SignalRepository
	Backtest         *repository.BacktestRepository
}

func initRepositories(db *gorm.DB) *Repositories {
	return &Repositories{
		User:            repository.NewUserRepository(db),
		Admin:           repository.NewAdminRepository(db),
		AuditLog:        repository.NewAuditLogRepository(db),
		Agent:           repository.NewAgentRepository(db),
		AgentWeight:     repository.NewAgentWeightRepository(db),
		Subscription:    repository.NewAgentSubscriptionRepository(db),
		News:            repository.NewNewsRepository(db),
		TopList:         repository.NewTopListRepository(db),
		TopInst:         repository.NewTopInstRepository(db),
		HotMoney:        repository.NewHotMoneyRepository(db),
		Settings:        repository.NewSettingsRepository(db),
		UserLevel:       repository.NewUserLevelRepository(db),
		Notification:    repository.NewNotificationRepository(db),
		SysNotification: repository.NewSystemNotificationRepository(db),
		RebateRule:      repository.NewRebateRuleRepository(db),
		RebateRecord:    repository.NewRebateRecordRepository(db),
		AntiArbitrage:   repository.NewAntiArbitrageRuleRepository(db),
		RebateAuditLog:  repository.NewRebateAuditLogRepository(db),
		Overview:        repository.NewOverviewRepository(db),
		Signal:          repository.NewSignalRepository(db),
		Backtest:        repository.NewBacktestRepository(db),
	}
}

func initServices(cfg *config.Config, repos *Repositories, redisClient *redis.Client, dataProvider *service.DataProvider) *Services {
	adminAuthSvc := service.NewAdminAuthService(cfg, repos.Admin, redisClient)
	adminSvc := service.NewAdminService(repos.Admin, redisClient)
	auditSvc := service.NewAuditService(repos.AuditLog)
	userSvc := service.NewUserService(repos.User)
	rebateRuleSvc := service.NewRebateRuleService(repos.RebateRule)
	rebateRecordSvc := service.NewRebateRecordService(repos.RebateRecord, repos.RebateRule, repos.AntiArbitrage, repos.RebateAuditLog, redisClient)
	antiArbitrageSvc := service.NewAntiArbitrageService(repos.AntiArbitrage)
	rebateStatsSvc := service.NewRebateStatsService(repos.RebateRecord)
	overviewSvc := service.NewOverviewService(repos.Overview, redisClient)
	signalSvc := service.NewSignalService(repos.Signal, repos.Overview)
	marketplaceSvc := service.NewMarketplaceService(repos.Agent, repos.Subscription, repos.User)
	backtestSvc := service.NewBacktestService(repos.Backtest, repos.Agent, repos.Subscription, repos.User)

	var smsSvc service.SMSService
	if svc, err := service.NewSMSService(&cfg.SMS, redisClient); err == nil {
		smsSvc = svc
	} else {
		log.Printf("Warning: failed to init SMS service: %v", err)
	}

	return &Services{
		AdminAuth:     adminAuthSvc,
		Admin:         adminSvc,
		Audit:         auditSvc,
		User:          userSvc,
		RebateRule:    rebateRuleSvc,
		RebateRecord:  rebateRecordSvc,
		AntiArbitrage: antiArbitrageSvc,
		RebateStats:   rebateStatsSvc,
		Overview:      overviewSvc,
		Signal:        signalSvc,
		Marketplace:   marketplaceSvc,
		Backtest:      backtestSvc,
		SMS:           smsSvc,
	}
}

func initHandlers(cfg *config.Config, repos *Repositories, svcs *Services, db *gorm.DB, redisClient *redis.Client, dataProvider *service.DataProvider) *Handlers {
	return &Handlers{
		Auth:            handler.NewAuthHandler(cfg, repos.User, redisClient, svcs.SMS),
		AdminAuth:       handler.NewAdminAuthHandler(svcs.AdminAuth, svcs.Audit),
		AdminMgmt:       handler.NewAdminMgmtHandler(svcs.Admin, svcs.Audit),
		Audit:           handler.NewAuditHandler(svcs.Audit),
		Agent:           handler.NewAgentHandler(repos.Agent, repos.AgentWeight, repos.Subscription, svcs.Marketplace),
		Stock:           handler.NewStockHandler(dataProvider),
		Datasource:      handler.NewDatasourceHandler(cfg, repos.News, repos.TopList, repos.TopInst, repos.HotMoney),
		Settings:        handler.NewSettingsHandler(repos.Settings),
		Dashboard:       handler.NewDashboardHandler(db, repos.User, repos.Agent, repos.RebateRecord),
		User:            handler.NewUserHandler(svcs.User, svcs.Audit, repos.AgentWeight, repos.Subscription, repos.UserLevel),
		Notification:    handler.NewNotificationHandler(repos.Notification),
		SysNotification: handler.NewSystemNotificationHandler(repos.SysNotification),
		RebateRule:      handler.NewRebateRuleHandler(svcs.RebateRule),
		RebateRecord:    handler.NewRebateRecordHandler(svcs.RebateRecord),
		AntiArbitrage:   handler.NewAntiArbitrageHandler(svcs.AntiArbitrage),
		RebateStats:     handler.NewRebateStatsHandler(svcs.RebateStats),
		Pricing:         handler.NewPricingHandler(),
		Overview:        handler.NewOverviewHandler(svcs.Overview),
		Signal:          handler.NewSignalHandler(svcs.Signal),
		Backtest:        handler.NewBacktestHandler(svcs.Backtest),
	}
}

func initMiddleware(cfg *config.Config, redisClient *redis.Client) *Middleware {
	return &Middleware{
		Auth:               middleware.AuthMiddleware(cfg),
		AdminAuth:          middleware.AdminSystemAuthMiddleware(cfg, redisClient),
		AdminRequired:      middleware.AdminRequiredMiddleware(),
		SuperAdminRequired: middleware.SuperAdminRequiredMiddleware(),
		SVIPAuth:           middleware.SVIPAuthMiddleware(),
		VIPAuth:            middleware.VIPAuthMiddleware(),
		InternalToken:      middleware.InternalTokenMiddleware(),
	}
}

func registerRoutes(r *gin.Engine, h *Handlers, mw *Middleware) {
	v1 := r.Group("/api/v1")
	{
		// 公开路由 - 用户端
		v1.POST("/auth/register", h.Auth.Register)
		v1.POST("/auth/login", h.Auth.PasswordLogin)
		v1.POST("/auth/refresh", h.Auth.RefreshToken)
		v1.POST("/auth/phone/token", h.Auth.GetPhoneAuthToken)
		v1.POST("/auth/phone/verify", h.Auth.VerifyPhoneLogin)
		v1.POST("/auth/phone/send-code", h.Auth.SendPhoneCode)
		v1.POST("/auth/phone/login-by-code", h.Auth.LoginByPhoneCode)
		v1.POST("/auth/forgot-password/send-code", h.Auth.SendForgotPasswordCode)
		v1.POST("/auth/forgot-password/reset", h.Auth.ResetPassword)

		// 公开路由 - 管理后台
		v1.POST("/admin/auth/login", h.AdminAuth.AdminLogin)

		// Agent公开路由
		v1.GET("/agents", h.Agent.ListAgents)
		v1.GET("/agents/featured", h.Agent.ListFeaturedAgents)
		v1.GET("/agents/:id", h.Agent.GetAgent)

		// Marketplace公开路由
		v1.GET("/marketplace/agents", h.Agent.GetMarketplaceAgents)
		v1.GET("/marketplace/agents/:id", h.Agent.GetMarketplaceAgentDetail)

		// 股票公开路由
		v1.GET("/stocks/:code/kline", h.Stock.GetKLine)
		v1.GET("/stocks/quotes", h.Stock.GetRealtimeQuote)

		// 用户等级字典
		v1.GET("/user-levels", h.User.ListUserLevels)

		// 定价配置
		v1.GET("/pricing/config", h.Pricing.GetPricingConfig)

		// 首页概览公开路由
		v1.GET("/overview/accuracy-trend", h.Overview.GetAccuracyTrend)
		v1.GET("/overview/agent-performance", h.Overview.GetAgentPerformance)
		v1.GET("/overview/hot-stocks", h.Overview.GetHotStocks)
		v1.GET("/overview/realtime-signals", h.Overview.GetRealtimeSignals)

		// 信号中心公开路由
		v1.GET("/signals", h.Signal.GetSignals)

		// 需要认证的路由
		auth := v1.Group("/")
		auth.Use(mw.Auth)
		{
			auth.GET("/auth/me", h.Auth.GetMe)
			auth.POST("/auth/logout", h.Auth.Logout)
			auth.GET("/users/me", h.User.GetMeProfile)
			auth.PUT("/users/me", h.User.UpdateMe)
			auth.POST("/users/me/avatar", h.User.UploadAvatar)
			auth.POST("/users/me/password", h.User.ChangePassword)
			auth.GET("/users/me/rebate", h.User.GetMyRebate)
			auth.GET("/overview/user-tracking-trend", h.Overview.GetUserTrackingTrend)
			auth.GET("/overview/user-tracking-detail", h.Overview.GetUserTrackingDetail)
			auth.POST("/signals/:id/follow", h.Signal.FollowSignal)
			auth.DELETE("/signals/:id/follow", h.Signal.UnfollowSignal)
			auth.GET("/signals/my-follows", h.Signal.GetMyFollows)
			auth.GET("/signals/my-stats", h.Signal.GetMyStats)
			auth.GET("/agents/weights/my", h.Agent.GetMyAgentWeights)
			auth.PUT("/agents/:id/weight", h.Agent.UpdateAgentWeight)
			auth.GET("/subscriptions/my", h.Agent.GetMySubscriptions)
			auth.POST("/marketplace/agents/:id/subscribe", h.Agent.SubscribeAgent)
			auth.GET("/marketplace/my-subscriptions", h.Agent.GetMySubscriptions)
			auth.POST("/marketplace/agents", mw.SVIPAuth, h.Agent.CreateMarketplaceAgent)
			auth.GET("/notifications", h.SysNotification.ListUser)
			auth.GET("/notifications/:id", h.SysNotification.GetUser)
			auth.GET("/backtests", mw.VIPAuth, h.Backtest.ListBacktests)
			auth.POST("/backtests", mw.VIPAuth, h.Backtest.CreateBacktest)
			auth.GET("/backtests/:id", mw.VIPAuth, h.Backtest.GetBacktest)
			auth.GET("/backtests/:id/progress", mw.VIPAuth, h.Backtest.GetBacktestProgress)
		}

		// 管理后台认证路由
		adminAuth := v1.Group("/admin/auth")
		adminAuth.Use(mw.AdminAuth)
		{
			adminAuth.POST("/logout", h.AdminAuth.AdminLogout)
			adminAuth.POST("/change-password", h.AdminAuth.AdminChangePassword)
			adminAuth.GET("/me", h.AdminAuth.AdminMe)
		}

		// 管理员路由
		admin := v1.Group("/admin")
		admin.Use(mw.AdminAuth, mw.AdminRequired)
		{
			admin.GET("/dashboard/stats", h.Dashboard.GetDashboardStats)
			admin.GET("/agents", h.Agent.ListAgentsAdmin)
			admin.POST("/agents", h.Agent.CreateAgentAdmin)
			admin.PUT("/agents/:id", h.Agent.UpdateAgentAdmin)
			admin.DELETE("/agents/:id", h.Agent.DeleteAgentAdmin)
			admin.POST("/agents/:id/featured", h.Agent.SetFeatured)
			admin.POST("/stocks/:code/sync", h.Stock.SyncStock)
			admin.GET("/datasource/news", h.Datasource.GetNewsList)
			admin.GET("/datasource/news/:id", h.Datasource.GetNewsById)
			admin.DELETE("/datasource/news/:id", h.Datasource.DeleteNews)
			admin.POST("/datasource/news/batch-delete", h.Datasource.BatchDeleteNews)
			admin.POST("/datasource/news/sync", h.Datasource.SyncNews)
			admin.GET("/datasource/status", h.Datasource.GetDataSourceStatus)
			admin.GET("/datasource/stats", h.Datasource.GetStats)
			admin.GET("/datasource/top-list", h.Datasource.GetTopList)
			admin.DELETE("/datasource/top-list/:id", h.Datasource.DeleteTopList)
			admin.POST("/datasource/top-list/batch-delete", h.Datasource.BatchDeleteTopList)
			admin.POST("/datasource/top-list/sync", h.Datasource.SyncTopList)
			admin.GET("/datasource/top-list/stats", h.Datasource.GetTopListStats)
			admin.GET("/datasource/top-inst", h.Datasource.GetTopInstList)
			admin.DELETE("/datasource/top-inst/:id", h.Datasource.DeleteTopInst)
			admin.POST("/datasource/top-inst/batch-delete", h.Datasource.BatchDeleteTopInst)
			admin.POST("/datasource/top-inst/sync", h.Datasource.SyncTopInst)
			admin.GET("/datasource/top-inst/stats", h.Datasource.GetTopInstStats)
			admin.GET("/datasource/hot-money", h.Datasource.GetHotMoneyList)
			admin.DELETE("/datasource/hot-money/:id", h.Datasource.DeleteHotMoney)
			admin.POST("/datasource/hot-money/batch-delete", h.Datasource.BatchDeleteHotMoney)
			admin.POST("/datasource/hot-money/sync", h.Datasource.SyncHotMoney)
			admin.GET("/datasource/hot-money/stats", h.Datasource.GetHotMoneyStats)
			admin.GET("/settings/news-sync", h.Settings.GetNewsSyncSettings)
			admin.POST("/settings/news-sync", h.Settings.SaveNewsSyncSettings)
			admin.GET("/settings/top-list-sync", h.Settings.GetTopListSyncSettings)
			admin.POST("/settings/top-list-sync", h.Settings.SaveTopListSyncSettings)
			admin.GET("/settings/top-inst-sync", h.Settings.GetTopInstSyncSettings)
			admin.POST("/settings/top-inst-sync", h.Settings.SaveTopInstSyncSettings)
			admin.GET("/settings/hot-money-sync", h.Settings.GetHotMoneySyncSettings)
			admin.POST("/settings/hot-money-sync", h.Settings.SaveHotMoneySyncSettings)
			admin.GET("/settings", h.Settings.GetSettings)
			admin.PUT("/settings", h.Settings.UpdateSettings)
			admin.GET("/pricing-settings", h.Settings.GetPricingSettings)
			admin.PUT("/pricing-settings", h.Settings.SavePricingSettings)
			admin.GET("/admins", mw.SuperAdminRequired, h.AdminMgmt.ListAdmins)
			admin.POST("/admins", mw.SuperAdminRequired, h.AdminMgmt.CreateAdmin)
			admin.POST("/admins/:id/disable", mw.SuperAdminRequired, h.AdminMgmt.DisableAdmin)
			admin.POST("/admins/:id/enable", mw.SuperAdminRequired, h.AdminMgmt.EnableAdmin)
			admin.GET("/users", h.User.ListUsers)
			admin.GET("/users/stats", h.User.GetUserStats)
			admin.POST("/users", h.User.CreateUser)
			admin.GET("/users/:id", h.User.GetUser)
			admin.PUT("/users/:id", h.User.UpdateUser)
			admin.DELETE("/users/:id", h.User.DeleteUser)
			admin.POST("/users/:id/reset-password", h.User.ResetPassword)
			admin.POST("/users/:id/toggle/:action", h.User.ToggleUserStatus)
			admin.GET("/audit-logs", h.Audit.ListAuditLogs)
			admin.GET("/audit-logs/export", h.Audit.ExportAuditLogs)
			admin.GET("/notifications/stats", h.Notification.GetNotificationStats)
			admin.POST("/notifications/:id/read", h.Notification.MarkRead)
			admin.POST("/notifications/read-all", h.Notification.MarkAllRead)
			admin.GET("/notifications", h.SysNotification.ListAdmin)
			admin.GET("/notifications/:id", h.SysNotification.GetAdmin)
			admin.POST("/notifications", h.SysNotification.Create)
			admin.PUT("/notifications/:id", h.SysNotification.Update)
			admin.POST("/notifications/:id/disable", h.SysNotification.Disable)
			admin.POST("/notifications/:id/duplicate", h.SysNotification.Duplicate)
			admin.GET("/rebate-rules", h.RebateRule.ListRebateRules)
			admin.GET("/rebate-rules/:id", h.RebateRule.GetRebateRule)
			admin.POST("/rebate-rules", h.RebateRule.CreateRebateRule)
			admin.PUT("/rebate-rules/:id", h.RebateRule.UpdateRebateRule)
			admin.POST("/rebate-rules/:id/toggle", h.RebateRule.ToggleRebateRuleStatus)
			admin.DELETE("/rebate-rules/:id", h.RebateRule.DeleteRebateRule)
			admin.GET("/rebate-records", h.RebateRecord.ListRecords)
			admin.GET("/rebate-records/:id", h.RebateRecord.GetRecord)
			admin.POST("/rebate-records/:id/review", h.RebateRecord.ReviewRecord)
			admin.GET("/anti-arbitrage-rules", h.AntiArbitrage.ListRules)
			admin.GET("/anti-arbitrage-rules/:id", h.AntiArbitrage.GetRule)
			admin.POST("/anti-arbitrage-rules", h.AntiArbitrage.CreateRule)
			admin.PUT("/anti-arbitrage-rules/:id", h.AntiArbitrage.UpdateRule)
			admin.POST("/anti-arbitrage-rules/:id/toggle", h.AntiArbitrage.ToggleStatus)
			admin.DELETE("/anti-arbitrage-rules/:id", h.AntiArbitrage.DeleteRule)
			admin.GET("/rebate-stats/dashboard", h.RebateStats.GetDashboardStats)
			admin.GET("/rebate-stats/trend", h.RebateStats.GetTrend)
			admin.GET("/rebate-stats/creators", h.RebateStats.GetCreatorRanking)
			admin.GET("/rebate-stats/agents", h.RebateStats.GetAgentStats)
		}

		// 内部服务路由
		internal := v1.Group("/internal")
		internal.Use(mw.InternalToken)
		{
			internal.POST("/notifications", h.Notification.CreateNotification)
			internal.POST("/rebate/calculate", h.RebateRecord.CalculateRebate)
		}
	}
}

func initDB(cfg *config.Config) (*gorm.DB, error) {
	db, err := gorm.Open(postgres.Open(cfg.Database.DSN()), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		return nil, err
	}

	migrator := db.Migrator()

	// 按依赖顺序排列：被引用的表先创建
	models := []interface{}{
		// 基础表（无外键依赖）
		&model.User{},
		&model.Admin{},
		&model.Stock{},
		&model.Agent{},
		&model.News{},
		&model.TopList{},
		&model.TopInst{},
		&model.HotMoney{},
		&model.UserLevel{},
		&model.Settings{},
		&model.SystemNotification{},
		&model.RebateRule{},
		&model.IncentiveRule{},
		&model.AntiArbitrageRule{},
		&model.BacktestJob{},
		&model.HotStock{},
		&model.AuditLog{},
		&model.Notification{},

		// 依赖表（有外键约束）
		&model.UserAgent{},       // FK: users, agents
		&model.AgentWeight{},     // FK: users, agents
		&model.AgentSubscription{}, // FK: users, agents
		&model.KLine{},           // FK: stocks
		&model.Signal{},          // FK: stocks, agents
		&model.AgentDecision{},   // FK: agents, stocks
		&model.UserStockTracking{}, // FK: users, stocks
		&model.AgentPerformanceSnapshot{}, // FK: agents
		&model.RebateRecord{},    // FK: users, rebate_rules
		&model.RebateAuditLog{},  // FK: rebate_records
		&model.BacktestResult{},  // FK: backtest_jobs
		&model.BacktestDayResult{}, // FK: backtest_results
	}

	for _, m := range models {
		if !migrator.HasTable(m) {
			if err := migrator.CreateTable(m); err != nil {
				return nil, fmt.Errorf("failed to create table: %w", err)
			}
		} else {
			if err := migrator.AutoMigrate(m); err != nil {
				log.Printf("Warning: AutoMigrate warning for %T: %v", m, err)
			}
		}
	}

	if err := createRebateRuleIndexes(db); err != nil {
		log.Printf("Warning: failed to create rebate rule indexes: %v", err)
	}

	if err := createPhoneUniqueIndex(db); err != nil {
		log.Printf("Warning: failed to create phone unique index: %v", err)
	}

	if err := migrate007Auth(db); err != nil {
		log.Printf("Warning: failed to run 007 auth migration: %v", err)
	}

	return db, nil
}

func createPhoneUniqueIndex(db *gorm.DB) error {
	return db.Exec(`
		CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone
		ON users (phone)
		WHERE phone IS NOT NULL AND phone <> ''
	`).Error
}

func migrate007Auth(db *gorm.DB) error {
	sqlBytes, err := os.ReadFile("migrations/007_user_sms_login.sql")
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	return db.Exec(string(sqlBytes)).Error
}

func createRebateRuleIndexes(db *gorm.DB) error {
	if err := db.Exec(`
		CREATE UNIQUE INDEX IF NOT EXISTS idx_rebate_rules_active_global
		ON rebate_rules (status)
		WHERE status = 'active' AND agent_id IS NULL
	`).Error; err != nil {
		return err
	}

	if err := db.Exec(`
		CREATE UNIQUE INDEX IF NOT EXISTS idx_rebate_rules_active_agent
		ON rebate_rules (agent_id, status)
		WHERE status = 'active' AND agent_id IS NOT NULL
	`).Error; err != nil {
		return err
	}

	return db.Exec(`
		CREATE UNIQUE INDEX IF NOT EXISTS idx_rebate_records_subscription_id
		ON rebate_records (subscription_id)
	`).Error
}

func initRedis(cfg *config.Config) *redis.Client {
	client := redis.NewClient(&redis.Options{
		Addr:     cfg.Redis.Addr(),
		Password: cfg.Redis.Password,
		DB:       cfg.Redis.DB,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		log.Printf("Warning: Redis connection failed: %v", err)
	}

	return client
}


