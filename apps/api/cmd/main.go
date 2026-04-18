package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
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

func main() {
	_ = godotenv.Load()

	cfg := config.Load()

	if cfg.Debug {
		gin.SetMode(gin.DebugMode)
	} else {
		gin.SetMode(gin.ReleaseMode)
	}

	// 初始化数据库
	db, err := initDB(cfg)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// 初始化Redis
	redisClient := initRedis(cfg)

	// 初始化仓库
	userRepo := repository.NewUserRepository(db)
	agentRepo := repository.NewAgentRepository(db)
	weightRepo := repository.NewAgentWeightRepository(db)
	subscriptionRepo := repository.NewAgentSubscriptionRepository(db)
	newsRepo := repository.NewNewsRepository(db)
	topListRepo := repository.NewTopListRepository(db)
	topInstRepo := repository.NewTopInstRepository(db)
	hotMoneyRepo := repository.NewHotMoneyRepository(db)
	settingsRepo := repository.NewSettingsRepository(db)
	notificationRepo := repository.NewNotificationRepository(db)

	// 初始化数据源
	dataProvider := initDataProvider(cfg, db, redisClient)

	// 初始化处理器
	authHandler := handler.NewAuthHandler(cfg, userRepo, redisClient)
	agentHandler := handler.NewAgentHandler(agentRepo, weightRepo, subscriptionRepo)
	stockHandler := handler.NewStockHandler(dataProvider)
	datasourceHandler := handler.NewDatasourceHandler(cfg, newsRepo, topListRepo, topInstRepo, hotMoneyRepo)
	settingsHandler := handler.NewSettingsHandler(settingsRepo)
	dashboardHandler := handler.NewDashboardHandler(db, userRepo, agentRepo)
	userHandler := handler.NewUserHandler(userRepo)
	notificationHandler := handler.NewNotificationHandler(notificationRepo)

	// 创建Gin路由
	r := gin.New()

	// 全局中间件
	r.Use(gin.Recovery())
	r.Use(middleware.Logger())
	r.Use(middleware.CORS(cfg))
	r.Use(middleware.SecurityHeaders())

	// 健康检查
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status": "ok",
			"time":   time.Now().Format(time.RFC3339),
		})
	})

	// API v1
	v1 := r.Group("/api/v1")
	{
		// 公开路由
		v1.POST("/auth/register", authHandler.Register)
		v1.POST("/auth/login", authHandler.Login)
		v1.POST("/auth/refresh", authHandler.RefreshToken)

		// Agent公开路由
		v1.GET("/agents", agentHandler.ListAgents)
		v1.GET("/agents/featured", agentHandler.ListFeaturedAgents)
		v1.GET("/agents/:id", agentHandler.GetAgent)

		// 股票公开路由
		v1.GET("/stocks/:code/kline", stockHandler.GetKLine)
		v1.GET("/stocks/quotes", stockHandler.GetRealtimeQuote)

		// 需要认证的路由
		auth := v1.Group("/")
		auth.Use(middleware.AuthMiddleware(cfg))
		{
			// 用户相关
			auth.GET("/auth/me", authHandler.GetMe)
			auth.POST("/auth/logout", authHandler.Logout)

			// Agent管理
			auth.POST("/agents", agentHandler.CreateAgent)
			auth.PUT("/agents/:id", agentHandler.UpdateAgent)
			auth.DELETE("/agents/:id", agentHandler.DeleteAgent)

			// Agent权重
			auth.GET("/agents/weights/my", agentHandler.GetMyAgentWeights)
			auth.PUT("/agents/:id/weight", agentHandler.UpdateAgentWeight)

			// 订阅管理
			auth.GET("/subscriptions/my", agentHandler.ListMySubscriptions)
		}

		// 管理员路由
		admin := v1.Group("/admin")
		admin.Use(middleware.AuthMiddleware(cfg))
		admin.Use(middleware.AdminAuthMiddleware())
		{
			// Dashboard
			admin.GET("/dashboard/stats", dashboardHandler.GetDashboardStats)

			// Agent管理
			admin.GET("/agents", agentHandler.ListAgentsAdmin)
			admin.POST("/agents", agentHandler.CreateAgent)
			admin.PUT("/agents/:id", agentHandler.UpdateAgent)
			admin.DELETE("/agents/:id", agentHandler.DeleteAgent)
			admin.POST("/agents/:id/featured", agentHandler.SetFeatured)
			admin.POST("/stocks/:code/sync", stockHandler.SyncStock)

			// 数据源管理 - 新闻
			admin.GET("/datasource/news", datasourceHandler.GetNewsList)
			admin.GET("/datasource/news/:id", datasourceHandler.GetNewsById)
			admin.DELETE("/datasource/news/:id", datasourceHandler.DeleteNews)
			admin.POST("/datasource/news/batch-delete", datasourceHandler.BatchDeleteNews)
			admin.POST("/datasource/news/sync", datasourceHandler.SyncNews)
			admin.GET("/datasource/status", datasourceHandler.GetDataSourceStatus)
			admin.GET("/datasource/stats", datasourceHandler.GetStats)

			// 数据源管理 - 龙虎榜
			admin.GET("/datasource/top-list", datasourceHandler.GetTopList)
			admin.DELETE("/datasource/top-list/:id", datasourceHandler.DeleteTopList)
			admin.POST("/datasource/top-list/batch-delete", datasourceHandler.BatchDeleteTopList)
			admin.POST("/datasource/top-list/sync", datasourceHandler.SyncTopList)
			admin.GET("/datasource/top-list/stats", datasourceHandler.GetTopListStats)

			// 数据源管理 - 龙虎榜机构交易名单
			admin.GET("/datasource/top-inst", datasourceHandler.GetTopInstList)
			admin.DELETE("/datasource/top-inst/:id", datasourceHandler.DeleteTopInst)
			admin.POST("/datasource/top-inst/batch-delete", datasourceHandler.BatchDeleteTopInst)
			admin.POST("/datasource/top-inst/sync", datasourceHandler.SyncTopInst)
			admin.GET("/datasource/top-inst/stats", datasourceHandler.GetTopInstStats)

			// 数据源管理 - 游资名录
			admin.GET("/datasource/hot-money", datasourceHandler.GetHotMoneyList)
			admin.DELETE("/datasource/hot-money/:id", datasourceHandler.DeleteHotMoney)
			admin.POST("/datasource/hot-money/batch-delete", datasourceHandler.BatchDeleteHotMoney)
			admin.POST("/datasource/hot-money/sync", datasourceHandler.SyncHotMoney)
			admin.GET("/datasource/hot-money/stats", datasourceHandler.GetHotMoneyStats)

			// 系统设置
			// 系统设置 - 新闻同步
			admin.GET("/settings/news-sync", settingsHandler.GetNewsSyncSettings)
			admin.POST("/settings/news-sync", settingsHandler.SaveNewsSyncSettings)

			// 系统设置 - 龙虎榜同步
			admin.GET("/settings/top-list-sync", settingsHandler.GetTopListSyncSettings)
			admin.POST("/settings/top-list-sync", settingsHandler.SaveTopListSyncSettings)

			// 系统设置 - 龙虎榜机构交易名单同步
			admin.GET("/settings/top-inst-sync", settingsHandler.GetTopInstSyncSettings)
			admin.POST("/settings/top-inst-sync", settingsHandler.SaveTopInstSyncSettings)

			// 系统设置 - 游资名录同步
			admin.GET("/settings/hot-money-sync", settingsHandler.GetHotMoneySyncSettings)
			admin.POST("/settings/hot-money-sync", settingsHandler.SaveHotMoneySyncSettings)

			// 用户管理
			admin.GET("/users", userHandler.ListUsers)
			admin.GET("/users/stats", userHandler.GetUserStats) // 必须在 /users/:id 之前
			admin.POST("/users", userHandler.CreateUser)
			admin.GET("/users/:id", userHandler.GetUser)
			admin.PUT("/users/:id", userHandler.UpdateUser)
			admin.DELETE("/users/:id", userHandler.DeleteUser)
			admin.POST("/users/:id/reset-password", userHandler.ResetPassword)
			admin.POST("/users/:id/toggle/:action", userHandler.ToggleUserStatus)

			// 通知管理
			admin.GET("/notifications", notificationHandler.GetNotifications)
			admin.POST("/notifications/:id/read", notificationHandler.MarkRead)
			admin.POST("/notifications/read-all", notificationHandler.MarkAllRead)
			admin.GET("/notifications/stats", notificationHandler.GetNotificationStats)
		}

		// 内部服务路由（供 data-service 调用，使用 X-Internal-Token 认证）
		internal := v1.Group("/internal")
		internal.Use(middleware.InternalTokenMiddleware())
		{
			internal.POST("/notifications", notificationHandler.CreateNotification)
		}
	}

	// 创建HTTP服务器
	srv := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: r,
	}

	// 优雅关闭
	go func() {
		log.Printf("Server starting on port %s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// 等待中断信号
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")

	// 优雅关闭，给予5秒超时
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited")
}

// initDB 初始化数据库连接
func initDB(cfg *config.Config) (*gorm.DB, error) {
	db, err := gorm.Open(postgres.Open(cfg.Database.DSN()), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		return nil, err
	}

	// 自动迁移（跳过外键约束）
	migrator := db.Migrator()

	// 逐个检查并迁移表
	models := []interface{}{
		&model.User{},
		&model.UserAgent{},
		&model.Stock{},
		&model.KLine{},
		&model.Signal{},
		&model.AgentDecision{},
		&model.Agent{},
		&model.AgentWeight{},
		&model.AgentSubscription{},
		&model.News{},
		&model.TopList{},
		&model.TopInst{},
		&model.HotMoney{},
		&model.Settings{},
		&model.Notification{},
	}

	for _, m := range models {
		if !migrator.HasTable(m) {
			if err := migrator.CreateTable(m); err != nil {
				return nil, fmt.Errorf("failed to create table: %w", err)
			}
		} else {
			// 表已存在，只添加缺失的列
			if err := migrator.AutoMigrate(m); err != nil {
				// 忽略外键约束错误
				log.Printf("Warning: AutoMigrate warning for %T: %v", m, err)
			}
		}
	}

	return db, nil
}

// initRedis 初始化Redis连接
func initRedis(cfg *config.Config) *redis.Client {
	client := redis.NewClient(&redis.Options{
		Addr:     cfg.Redis.Addr(),
		Password: cfg.Redis.Password,
		DB:       cfg.Redis.DB,
	})

	// 测试连接
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		log.Printf("Warning: Redis connection failed: %v", err)
	}

	return client
}

// initDataProvider 初始化数据源提供者
func initDataProvider(cfg *config.Config, db *gorm.DB, redis *redis.Client) *service.DataProvider {
	return service.NewDataProvider(cfg, db, redis)
}
