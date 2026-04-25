# Data Model: Agent Marketplace

**Date**: 2026/04/25
**Feature**: Agent Marketplace

## 概述

Agent Marketplace **复用现有数据模型**，不新建数据库表。现有 `agents`、`agent_subscriptions`、`users` 和 `agent_performance_snapshots` 表已覆盖全部功能需求。

## 复用实体

### Agent (`agents` 表)

已存在的实体，包含 marketplace 所需的全部字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | uint (PK) | Agent 唯一标识 |
| `name` | string(100) | Agent 名称（唯一） |
| `description` | text | 功能描述 |
| `avatar` | string(500) | 头像 URL |
| `type` | string(30) | 类型：technical/fundamental/sentiment/capital/decision/custom |
| `category` | string(50) | 分类：trend/volume/breakout/sentiment/custom |
| `prompt` | text | 系统提示词 |
| `model` | string(100) | LLM 模型 |
| `price` | decimal(10,2) | 订阅价格 |
| `price_type` | string(20) | 计费方式：onetime/monthly/yearly |
| `is_active` | bool | 是否上架 |
| `is_featured` | bool | 是否精选（免费用户可用） |
| `is_official` | bool | 是否官方 |
| `use_count` | int | 使用次数 |
| `rating` | decimal(2,1) | 评分（1.0-5.0） |
| `rating_count` | int | 评分人数 |
| `owner_id` | uuid | 作者用户 ID |

**关系**: `Owner` → `User` (belongs to)

### AgentSubscription (`agent_subscriptions` 表)

已存在的实体，用于记录用户订阅：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | uint (PK) | 订阅唯一标识 |
| `user_id` | uuid | 订阅用户 ID |
| `agent_id` | uint | Agent ID |
| `start_date` | timestamp | 订阅开始时间 |
| `end_date` | timestamp | 订阅结束时间（nullable） |
| `status` | string(20) | active/expired/cancelled |
| `price` | decimal(10,2) | 实际支付价格（VIP 免费订阅为 0） |
| `order_id` | string(100) | 关联订单 ID |

**关系**: `User` → `AgentSubscription` (has many), `Agent` → `AgentSubscription` (has many)

### User (`users` 表)

已存在的实体，VIP 相关字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | uuid (PK) | 用户唯一标识 |
| `vip_level` | int | 0=free, 1=vip, 2=svip |
| `vip_expire_at` | timestamp | VIP 过期时间 |
| `nickname` | string(100) | 昵称 |
| `username` | string(50) | 用户名 |
| `full_name` | string(100) | 全名 |

**方法**: `DisplayName()` 返回优先显示名称；`IsVIP()` 判断是否有效 VIP；`IsSVIP()` 判断是否有效 SVIP。

### AgentPerformanceSnapshot (`agent_performance_snapshots` 表)

homepage-overview 功能已创建的实体，用于获取 Agent 预测准确率：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | uint (PK) | 快照唯一标识 |
| `agent_id` | uint | Agent ID（索引） |
| `period_type` | string(10) | 7d/30d/90d/1y |
| `hit_rate` | decimal(5,2) | 命中率（0-100） |
| `total_predictions` | int | 总预测数 |
| `hit_count` | int | 命中数 |
| `calculated_at` | timestamp | 计算时间 |

**用法**: marketplace 取 `period_type = '30d'` 的最新记录作为 Agent 的预测准确率。

## 验证规则

- Agent `name` 必须唯一，最大 30 字符。
- Agent `description` 最大 300 字符。
- `price` 必须 >= 0。
- `rating` 必须在 1.0 - 5.0 之间。
- 创建 Agent 时，`owner_id` 必须指向有效用户，且该用户为有效 SVIP（`vip_level >= 2` 且未过期）。
- VIP 用户订阅时，`AgentSubscription.price` 必须为 0。

## 状态转换

```
Agent 生命周期:
  创建 (is_active=true) → 上架展示
  上架 → 下架 (is_active=false) [仅作者或管理员可操作]
  下架 → 上架 (is_active=true) [仅作者或管理员可操作]

AgentSubscription 生命周期:
  创建 (status=active) → 使用中
  使用中 → 过期 (status=expired) [到达 end_date 或 VIP 过期]
  使用中 → 取消 (status=cancelled) [用户主动取消]
```
