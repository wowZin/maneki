# Quickstart: 首页概览数据看板

**Date**: 2026/04/25
**Feature**: 首页概览数据看板

## 开发环境准备

### 1. 启动依赖服务

确保 PostgreSQL 和 Redis 已启动:

```bash
# 使用 Docker Compose (推荐)
docker-compose up -d postgres redis

# 或本地服务
brew services start postgresql@15
brew services start redis
```

### 2. 数据库迁移

```bash
cd apps/api
go run cmd/main.go
# 启动时会自动执行 AutoMigrate，创建新表:
# - user_stock_trackings
# - agent_performance_snapshots
# - hot_stocks
```

### 3. 启动后端服务

```bash
cd apps/api
# 开发模式（热重载）
air

# 或标准模式
go run cmd/main.go
```

后端默认运行在 `:8080`。

### 4. 启动前端服务

```bash
cd apps/web
pnpm dev
```

前端默认运行在 `:5173`。

---

## 验证步骤

### 后端 API 验证

```bash
# 1. 验证正确率趋势（公开接口）
curl "http://localhost:8080/api/v1/overview/accuracy-trend?period=7d"

# 2. 验证 Agent 命中率（公开接口）
curl "http://localhost:8080/api/v1/overview/agent-performance?period=7d"

# 3. 验证热门股票（公开接口）
curl "http://localhost:8080/api/v1/overview/hot-stocks?limit=10"

# 4. 验证实时信号（公开接口）
curl "http://localhost:8080/api/v1/overview/realtime-signals?limit=10"

# 5. 验证用户选中趋势（需登录，先获取 token）
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}' | jq -r '.access_token')

curl "http://localhost:8080/api/v1/overview/user-tracking-trend?period=7d" \
  -H "Authorization: Bearer $TOKEN"

curl "http://localhost:8080/api/v1/overview/user-tracking-detail?date=2026-04-25" \
  -H "Authorization: Bearer $TOKEN"
```

### 前端页面验证

1. 打开浏览器访问 `http://localhost:5173`
2. 登录后进入首页 (Dashboard)
3. 确认以下模块正常加载：
   - 打板预测正确率趋势图表（ECharts 折线图）
   - 用户选中涨停股票趋势卡片（含"查看明细"按钮）
   - Agent 命中率排名表格
   - 热门股票列表
   - 实时信号流卡片

---

## 测试数据准备

### 插入测试信号数据

```sql
-- 插入测试信号（用于正确率统计）
INSERT INTO signals (code, signal_type, confidence, is_valid, created_at)
VALUES
  ('000001', 'watch', 0.92, true, NOW() - INTERVAL '1 day'),
  ('000002', 'watch', 0.85, false, NOW() - INTERVAL '1 day'),
  ('300001', 'watch', 0.88, true, NOW() - INTERVAL '2 days');

-- 插入测试 Agent 决策
INSERT INTO agent_decisions (signal_id, agent_type, decision, score)
VALUES
  (1, 'technical', 'buy', 0.92),
  (2, 'technical', 'buy', 0.85),
  (3, 'fundamental', 'buy', 0.88);
```

### 插入测试用户追踪数据

```sql
-- 插入测试用户股票追踪（替换 user_id 为实际测试用户 ID）
INSERT INTO user_stock_trackings (user_id, stock_code, track_date, hit_status, created_at)
VALUES
  ('test-user-uuid', '000001', CURRENT_DATE, true, NOW()),
  ('test-user-uuid', '000002', CURRENT_DATE, false, NOW()),
  ('test-user-uuid', '300001', CURRENT_DATE - INTERVAL '1 day', true, NOW());
```

### 插入测试热门股票

```sql
INSERT INTO hot_stocks (stock_code, heat_score, rank, change_pct, volume, calculated_at)
VALUES
  ('300001', 95.32, 1, 19.98, 152345678, NOW()),
  ('000001', 88.15, 2, 10.02, 89234125, NOW()),
  ('000002', 76.50, 3, 5.30, 65432100, NOW());
```

---

## 常见问题

### Q: 首页加载慢，数据模块一直转圈？

A: 检查以下几点：
1. 后端服务是否正常启动 (`curl http://localhost:8080/health`)
2. 数据库连接是否正常（查看后端日志）
3. 前端代理配置是否正确（`apps/web/vite.config.ts` 中的 proxy 设置）
4. Redis 是否已连接（非阻塞，但缓存未命中会增加 DB 压力）

### Q: Agent 命中率为 0 或数据为空？

A: 
1. 确认 `agent_performance_snapshots` 表已有数据（需等待定时任务执行或手动触发计算）
2. 检查 `signals` 和 `agent_decisions` 表是否有数据
3. 确认 `period` 参数与快照表中的 `period_type` 匹配

### Q: 用户选中趋势没有数据？

A: 
1. 确认当前用户已在 `user_stock_trackings` 表中有记录
2. 当前功能需要用户主动"选中/关注"股票，若用户未操作过则展示空状态

### Q: 热门股票数据过时？

A:
1. 热门股票依赖定时任务更新，检查 `hot_stocks.calculated_at` 字段
2. 开发环境可手动执行更新 SQL 或重启后端触发初始化
