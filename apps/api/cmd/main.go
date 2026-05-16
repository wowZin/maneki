package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/joho/godotenv"

	"github.com/maneki/api/internal/app"
	"github.com/maneki/api/internal/config"
	"github.com/maneki/api/internal/scheduler"
)

func main() {
	_ = godotenv.Load()

	cfg := config.Load()

	// 创建应用服务器
	server, err := app.NewServer(cfg)
	if err != nil {
		log.Fatalf("Failed to create server: %v", err)
	}

	// 启动T+1结算定时任务
	settlementScheduler := scheduler.NewSettlementScheduler(server.Repositories.RebateRecord)
	settlementScheduler.Start()
	defer settlementScheduler.Stop()

	// 启动回测任务调度器
	backtestScheduler := scheduler.NewBacktestScheduler(server.Repositories.Backtest, server.Services.Backtest)
	backtestScheduler.Start()
	defer backtestScheduler.Stop()

	// 创建HTTP服务器
	srv := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: server.Engine,
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
