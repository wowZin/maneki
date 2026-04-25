# API Contracts: Agent Marketplace

**Date**: 2026/04/25
**Feature**: Agent Marketplace

## Endpoints Overview

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/marketplace/agents` | No | 获取 Agent 市场列表（支持排序、筛选、分页） |
| GET | `/api/v1/marketplace/agents/:id` | No | 获取 Agent 详情（含作者、准确率、订阅状态） |
| POST | `/api/v1/marketplace/agents/:id/subscribe` | Yes | 订阅 Agent（VIP 免费） |
| GET | `/api/v1/marketplace/my-subscriptions` | Yes | 获取当前用户的订阅列表 |
| POST | `/api/v1/marketplace/agents` | Yes | 创建 Agent（需 SVIP） |

---

## 1. GET /api/v1/marketplace/agents

**Description**: 获取 Agent 市场列表，支持排序、筛选和分页。

**Auth**: None (public)

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `sort_by` | string | No | `use_count` | 排序字段：`accuracy` / `use_count` / `rating` / `created_at` |
| `sort_order` | string | No | `desc` | 排序方向：`asc` / `desc` |
| `type` | string | No | — | 筛选 Agent 类型 |
| `category` | string | No | — | 筛选分类 |
| `page` | int | No | `1` | 页码 |
| `page_size` | int | No | `20` | 每页数量（max 100） |

### Response 200 OK

```json
{
  "items": [
    {
      "id": 1,
      "name": "趋势跟踪专家",
      "description": "基于移动平均线与MACD的趋势识别Agent",
      "avatar": "https://cdn.example.com/avatars/agent1.png",
      "type": "technical",
      "category": "trend",
      "price": 99.00,
      "price_type": "monthly",
      "is_featured": true,
      "is_official": false,
      "use_count": 1523,
      "rating": 4.5,
      "rating_count": 128,
      "accuracy": 78.5,
      "author_name": "量化小王",
      "created_at": "2026-03-15 10:30:00"
    }
  ],
  "total": 45,
  "page": 1,
  "size": 20
}
```

**Notes**:
- `accuracy` 从 `agent_performance_snapshots` 表取 `period_type = '30d'` 的最新 `hit_rate`；若无数据则为 `null`。
- `author_name` 为 `owner` 关联用户的 `DisplayName()`。
- 仅返回 `is_active = true` 的 Agent。

---

## 2. GET /api/v1/marketplace/agents/:id

**Description**: 获取单个 Agent 的详细信息，含作者信息、预测准确率和当前用户的订阅状态（如果已登录）。

**Auth**: Optional (public, but authenticated users get `is_subscribed`)

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | uint | Agent ID |

### Response 200 OK

```json
{
  "id": 1,
  "name": "趋势跟踪专家",
  "description": "基于移动平均线与MACD的趋势识别Agent",
  "avatar": "https://cdn.example.com/avatars/agent1.png",
  "type": "technical",
  "category": "trend",
  "prompt": "## 角色\n你是一个专业的趋势跟踪分析师...",
  "model": "qwen-plus",
  "price": 99.00,
  "price_type": "monthly",
  "is_featured": true,
  "is_official": false,
  "is_active": true,
  "use_count": 1523,
  "rating": 4.5,
  "rating_count": 128,
  "accuracy": 78.5,
  "accuracy_period": "30d",
  "author": {
    "id": "uuid-string",
    "name": "量化小王",
    "avatar_url": "https://cdn.example.com/avatars/user1.png"
  },
  "is_subscribed": false,
  "can_subscribe_free": false,
  "created_at": "2026-03-15 10:30:00",
  "updated_at": "2026-04-20 14:00:00"
}
```

**Field Descriptions**:
- `is_subscribed`: 当前登录用户是否已订阅此 Agent（未登录始终为 `false`）。
- `can_subscribe_free`: 当前登录用户是否可以免费订阅（VIP 且 Agent 非免费时为 `true`）。

### Response 404 Not Found

```json
{
  "error": "agent not found"
}
```

---

## 3. POST /api/v1/marketplace/agents/:id/subscribe

**Description**: 订阅指定 Agent。VIP 用户免费订阅（price = 0）；非 VIP 用户对于付费 Agent 返回升级提示。

**Auth**: Required (JWT)

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | uint | Agent ID |

### Request Body

Empty body for VIP free subscription. Future paid subscriptions may include payment fields.

### Response 200 OK (VIP Free Subscribe)

```json
{
  "subscription_id": 42,
  "agent_id": 1,
  "status": "active",
  "price": 0,
  "start_date": "2026-04-25T10:00:00Z",
  "message": "订阅成功"
}
```

### Response 403 Forbidden (Non-VIP, paid agent)

```json
{
  "error": "vip required for free subscription",
  "agent_price": 99.00,
  "upgrade_url": "/pricing"
}
```

### Response 409 Conflict (Already subscribed)

```json
{
  "error": "already subscribed"
}
```

### Response 404 Not Found

```json
{
  "error": "agent not found"
}
```

---

## 4. GET /api/v1/marketplace/my-subscriptions

**Description**: 获取当前登录用户已订阅的 Agent 列表。

**Auth**: Required (JWT)

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `status` | string | No | `active` | 筛选状态：`active` / `expired` / `cancelled` / `all` |
| `page` | int | No | `1` | 页码 |
| `page_size` | int | No | `20` | 每页数量 |

### Response 200 OK

```json
{
  "items": [
    {
      "subscription_id": 42,
      "agent_id": 1,
      "agent_name": "趋势跟踪专家",
      "agent_avatar": "https://cdn.example.com/avatars/agent1.png",
      "status": "active",
      "price": 0,
      "start_date": "2026-04-25T10:00:00Z",
      "end_date": null
    }
  ],
  "total": 5,
  "page": 1,
  "size": 20
}
```

---

## 5. POST /api/v1/marketplace/agents

**Description**: 创建新的 Agent 并发布到市场。**仅限 SVIP 用户**（vip_level >= 2）。

**Auth**: Required (JWT) + SVIP check

### Request Body

```json
{
  "name": "我的趋势Agent",
  "description": "自定义趋势识别策略",
  "type": "technical",
  "category": "trend",
  "model": "qwen-plus",
  "prompt": "## 角色\n你是一个专业的趋势分析师...",
  "price": 0,
  "price_type": "onetime"
}
```

**Field Rules**:
- `name`: required, unique, max 30 chars
- `description`: optional, max 300 chars
- `type`: required, enum: technical/fundamental/sentiment/capital/decision/custom
- `category`: optional, enum: trend/volume/breakout/sentiment/custom
- `model`: optional, enum: qwen-turbo/qwen-plus/qwen-max/gpt-4o/gpt-4o-mini
- `prompt`: optional
- `price`: optional, default 0
- `price_type`: optional, default "onetime", enum: onetime/monthly/yearly

### Response 201 Created

```json
{
  "id": 51,
  "name": "我的趋势Agent",
  "description": "自定义趋势识别策略",
  "type": "technical",
  "category": "trend",
  "model": "qwen-plus",
  "price": 0,
  "price_type": "onetime",
  "is_active": true,
  "is_official": false,
  "is_featured": false,
  "use_count": 0,
  "rating": 5.0,
  "rating_count": 0,
  "owner_id": "user-uuid",
  "created_at": "2026-04-25 10:30:00"
}
```

### Response 403 Forbidden (Not SVIP)

```json
{
  "error": "svip required to create agents"
}
```

### Response 409 Conflict (Name exists)

```json
{
  "error": "agent name already exists"
}
```

### Response 400 Bad Request (Validation error)

```json
{
  "error": "name is required and must be <= 30 characters"
}
```

---

## Error Response Standard

All error responses follow this format:

```json
{
  "error": "human-readable error message"
}
```

Common HTTP status codes:
- `400` — Bad Request (validation error)
- `401` — Unauthorized (missing or invalid token)
- `403` — Forbidden (insufficient VIP level)
- `404` — Not Found
- `409` — Conflict (duplicate name, already subscribed)
- `500` — Internal Server Error
