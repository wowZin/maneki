# Quickstart: Agent Marketplace

**Date**: 2026/04/25
**Feature**: Agent Marketplace

## 开发环境准备

### 1. 启动依赖服务

确保 PostgreSQL 和 Redis 已启动（同 homepage-overview）：

```bash
docker-compose up -d postgres redis
```

### 2. 数据库迁移

现有表已存在，无需新增迁移。确保以下表已有数据：
- `agents` — Agent 基础信息
- `agent_subscriptions` — 用户订阅记录
- `agent_performance_snapshots` — Agent 命中率快照（homepage-overview 创建）

```bash
cd apps/api
go run cmd/main.go
```

### 3. 启动后端服务

```bash
cd apps/api
air
```

### 4. 启动前端服务

```bash
cd apps/web
pnpm dev
```

---

## 验证步骤

### 后端 API 验证

```bash
# 1. 验证市场列表（公开接口，支持排序）
curl "http://localhost:8080/api/v1/marketplace/agents?sort_by=accuracy&page=1&page_size=10"

# 2. 验证 Agent 详情（公开接口）
curl "http://localhost:8080/api/v1/marketplace/agents/1"

# 3. 验证订阅（需登录，先获取 token）
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}' | jq -r '.access_token')

# 3a. VIP 用户免费订阅
curl -X POST "http://localhost:8080/api/v1/marketplace/agents/1/subscribe" \
  -H "Authorization: Bearer $TOKEN"

# 3b. 查看我的订阅
curl "http://localhost:8080/api/v1/marketplace/my-subscriptions" \
  -H "Authorization: Bearer $TOKEN"

# 4. 验证创建 Agent（需 SVIP token）
curl -X POST "http://localhost:8080/api/v1/marketplace/agents" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "测试Agent",
    "description": "用于测试的Agent",
    "type": "technical",
    "category": "trend",
    "model": "qwen-plus",
    "prompt": "你是一个趋势分析师"
  }'
```

### 前端页面验证

1. 打开浏览器访问 `http://localhost:5173`
2. 登录后，侧边栏应出现 "Agent 市场" 菜单项
3. 点击进入 marketplace 页面，确认：
   - Agent 卡片列表正常加载，显示名称、作者、评分、准确率
   - 排序切换器（准确率/ popularity / 评分 / 最新）工作正常
   - 类型/分类筛选器工作正常
4. 点击任意 Agent 卡片进入详情页，确认：
   - 详细信息展示完整
   - 订阅按钮状态正确（VIP 显示"免费订阅"，非 VIP 显示价格或升级提示）
5. SVIP 用户在 marketplace 页面应看到右上角 "创建 Agent" 按钮
6. 点击 "创建 Agent" 进入创建表单，确认：
   - 所有字段与 admin-web AgentCreate 一致
   - Markdown 预览功能正常
   - 保存后跳转回 marketplace 并显示新 Agent

---

## 测试数据准备

### 插入测试 Agent 数据

```sql
-- 插入测试 Agent（确保有 owner_id 指向有效用户）
INSERT INTO agents (name, description, type, category, model, prompt, price, price_type, is_active, is_featured, is_official, use_count, rating, rating_count, owner_id, created_at, updated_at)
VALUES
  ('趋势跟踪专家', '基于MA与MACD的趋势识别', 'technical', 'trend', 'qwen-plus', '你是一个趋势分析师', 99.00, 'monthly', true, true, false, 1523, 4.5, 128, 'test-user-uuid', NOW(), NOW()),
  ('情绪分析大师', '基于新闻情绪面分析', 'sentiment', 'sentiment', 'gpt-4o', '你是一个情绪分析师', 0, 'onetime', true, false, true, 892, 4.8, 65, 'admin-user-uuid', NOW(), NOW()),
  ('量价突破探测器', '量能突破策略', 'technical', 'breakout', 'qwen-turbo', '你是一个突破分析师', 49.00, 'monthly', true, false, false, 456, 3.9, 42, 'test-user-uuid', NOW(), NOW());
```

### 插入测试命中率快照

```sql
-- 插入命中率快照（用于 marketplace 准确率展示）
INSERT INTO agent_performance_snapshots (agent_id, period_type, hit_rate, total_predictions, hit_count, calculated_at)
VALUES
  (1, '30d', 78.5, 200, 157, NOW()),
  (2, '30d', 82.3, 150, 123, NOW()),
  (3, '30d', 65.0, 100, 65, NOW());
```

### 插入测试订阅数据

```sql
-- 插入测试订阅（替换 user_id 为实际测试用户）
INSERT INTO agent_subscriptions (user_id, agent_id, start_date, status, price, created_at)
VALUES
  ('test-user-uuid', 1, NOW(), 'active', 0, NOW());
```

---

## 常见问题

### Q: 市场列表中 Agent 的准确率为空？

A: 检查 `agent_performance_snapshots` 表中是否有对应 `agent_id` 且 `period_type = '30d'` 的记录。如果没有， marketplace 会显示 `null` 或 "暂无数据"。

### Q: VIP 用户订阅时提示需要付费？

A: 检查用户 `vip_level` >= 1 且 `vip_expire_at` 未过期。后端通过 `user.IsVIP()` 方法判断。

### Q: SVIP 用户看不到"创建 Agent"按钮？

A: 检查前端 `authStore` 中 `vip_level` >= 2，且后端 `POST /marketplace/agents` 返回 403 时前端是否正确处理。

### Q: Agent 创建成功但没有出现在市场列表？

A: 确认 `is_active = true`。 marketplace 列表只展示 `is_active = true` 的 Agent。
