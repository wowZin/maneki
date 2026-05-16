// Package testutil 提供集成测试的基础设施支持。
//
// 使用方式：
//
//	func TestSomething(t *testing.T) {
//		server := testutil.NewTestServer(t)
//		defer server.Cleanup()
//
//		resp, err := server.Client().Post(...)
//		...
//	}
//
package testutil

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"

	"github.com/maneki/api/internal/app"
	"github.com/maneki/api/internal/config"
)

// TestServer 封装测试服务器及其依赖
type TestServer struct {
	T          *testing.T
	Server     *app.Server
	HTTPServer *httptest.Server
	DB         *gorm.DB
	Redis      *redis.Client
	Config     *config.Config
}

// Cleanup 清理测试数据
func (ts *TestServer) Cleanup() {
	if ts.HTTPServer != nil {
		ts.HTTPServer.Close()
	}
	if ts.Redis != nil {
		_ = ts.Redis.FlushDB(context.Background()).Err()
	}
	if ts.DB != nil {
		// 清理所有表数据（保留表结构）
		cleanTables(ts.DB)
	}
}

// Client 返回配置好的 HTTP 客户端
func (ts *TestServer) Client() *http.Client {
	return ts.HTTPServer.Client()
}

// BaseURL 返回测试服务器基础地址
func (ts *TestServer) BaseURL() string {
	return ts.HTTPServer.URL
}

// PostJSON 发送 JSON POST 请求
func (ts *TestServer) PostJSON(path string, body interface{}) (*http.Response, error) {
	jsonBody, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}
	return ts.Client().Post(
		ts.BaseURL()+path,
		"application/json",
		bytes.NewReader(jsonBody),
	)
}

// Get 发送 GET 请求
func (ts *TestServer) Get(path string, headers map[string]string) (*http.Response, error) {
	req, err := http.NewRequest("GET", ts.BaseURL()+path, nil)
	if err != nil {
		return nil, err
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	return ts.Client().Do(req)
}

// NewTestServer 创建测试服务器
// 自动加载 .env.test 配置，初始化数据库和 Redis
func NewTestServer(t *testing.T) *TestServer {
	t.Helper()

	// 设置项目根目录，确保能找到 .env.test 和 migrations
	apiDir := setProjectRoot(t)

	// 加载测试环境变量（使用绝对路径）
	envPath := filepath.Join(apiDir, ".env.test")
	if err := godotenv.Load(envPath); err != nil {
		t.Fatalf("加载 .env.test 失败: %v", err)
	}

	// 强制测试模式
	dbname := os.Getenv("DB_NAME")
	if dbname != "stock_test" {
		t.Fatalf("测试必须使用 stock_test 数据库，当前: %s。请检查 .env.test 配置", dbname)
	}

	cfg := config.Load()

	// 使用 ReleaseMode 减少测试日志噪音
	gin.SetMode(gin.TestMode)

	// 创建应用服务器
	server, err := app.NewServer(cfg)
	require.NoError(t, err, "创建应用服务器失败")

	// 创建 HTTP 测试服务器
	httpServer := httptest.NewServer(server.Engine)

	ts := &TestServer{
		T:          t,
		Server:     server,
		HTTPServer: httpServer,
		DB:         server.DB,
		Redis:      server.Redis,
		Config:     cfg,
	}

	// 注册测试清理
	t.Cleanup(func() {
		ts.Cleanup()
	})

	return ts
}

// setProjectRoot 设置工作目录为 apps/api 目录，返回该目录路径
func setProjectRoot(t *testing.T) string {
	_, filename, _, _ := runtime.Caller(0)
	// internal/testutil/testutil.go -> 回到 apps/api 目录
	apiDir := filepath.Dir(filepath.Dir(filepath.Dir(filename)))
	// 切换到 apps/api 目录，这样相对路径 (.env.test, migrations/) 才能正确解析
	if err := os.Chdir(apiDir); err != nil {
		t.Fatalf("切换工作目录失败: %v", err)
	}
	return apiDir
}

// cleanTables 清理所有业务表数据
func cleanTables(db *gorm.DB) {
	tables := []string{
		"backtest_day_results",
		"backtest_results",
		"backtest_jobs",
		"rebate_audit_logs",
		"anti_arbitrage_rules",
		"rebate_records",
		"rebate_rules",
		"system_notifications",
		"notifications",
		"user_stock_trackings",
		"agent_performance_snapshots",
		"hot_stocks",
		"user_levels",
		"agent_subscriptions",
		"agent_weights",
		"agents",
		"signals",
		"agent_decisions",
		"klines",
		"stocks",
		"hot_money",
		"top_inst",
		"top_lists",
		"news",
		"audit_logs",
		"settings",
		"users",
		"admins",
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	for _, table := range tables {
		_ = db.WithContext(ctx).Exec(fmt.Sprintf("TRUNCATE TABLE %s CASCADE", table))
	}
}
