package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
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

	// 初始化数据源
	dataProvider := initDataProvider(cfg, db, redisClient)

	// 初始化处理器
	authHandler := handler.NewAuthHandler(cfg, userRepo, redisClient)
	agentHandler := handler.NewAgentHandler(agentRepo, weightRepo, subscriptionRepo)
	stockHandler := handler.NewStockHandler(dataProvider)

	// 创建Gin路由
	r := gin.New()

	// 全局中间件
	r.Use(gin.Recovery())
	r.Use(middleware.Logger())
	r.Use(middleware.CORS())
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
			// Agent管理
			admin.POST("/agents/:id/featured", agentHandler.SetFeatured)
			admin.POST("/stocks/:code/sync", stockHandler.SyncStock)

			// 用户管理
			admin.GET("/users", func(c *gin.Context) {
				page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
				pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

				users, total, err := userRepo.List(c.Request.Context(), page, pageSize)
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
					return
				}

				c.JSON(http.StatusOK, gin.H{
					"data":  users,
					"total": total,
					"page":  page,
					"size":  pageSize,
				})
			})
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

	// 自动迁移
	err = db.AutoMigrate(
		&model.User{},
		&model.UserAgent{},
		&model.Stock{},
		&model.KLine{},
		&model.Signal{},
		&model.AgentDecision{},
		&model.Agent{},
		&model.AgentWeight{},
		&model.AgentSubscription{},
	)
	if err != nil {
		return nil, fmt.Errorf("failed to migrate: %w", err)
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
