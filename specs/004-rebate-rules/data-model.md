# Data Model: 系统设置 - 返佣规则模块

**Feature**: 系统设置 - 返佣规则模块
**Date**: 2026-04-19

## Entity Overview

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   RebateRule     │     │  IncentiveRule   │     │ AntiArbitrageRule│
├──────────────────┤     ├──────────────────┤     ├──────────────────┤
│ id (PK)          │◄────┤ rebate_rule_id   │     │ id (PK)          │
│ name             │     │ range_start      │     │ strategy_type    │
│ unit_price       │     │ range_end        │     │ rule_params      │
│ agent_id (FK)    │     │ coefficient      │     │ action           │
│ start_at         │     └──────────────────┘     │ status           │
│ end_at           │                                └──────────────────┘
│ status           │
│ created_by       │     ┌──────────────────┐     ┌──────────────────┐
│ created_at       │     │  RebateRecord    │     │ RebateAuditLog   │
│ updated_at       │     ├──────────────────┤     ├──────────────────┤
└──────────────────┘     │ id (PK)          │     │ id (PK)          │
                         │ subscription_id  │     │ rebate_record_id │
                         │ agent_id         │     │ admin_id         │
                         │ creator_id       │     │ conclusion       │
                         │ amount           │     │ remark           │
                         │ rebate_rule_id   │     │ created_at       │
                         │ status           │     └──────────────────┘
                         │ arbitrage_tags   │
                         │ created_at       │
                         │ settled_at       │
                         └──────────────────┘
```

---

## 1. RebateRule (返佣定价规则表)

**Table**: `rebate_rules`
**Purpose**: 定义返佣单价及适用范围，可关联一组阶梯激励规则

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | `BIGSERIAL` | PRIMARY KEY | 自增主键 |
| name | `VARCHAR(128)` | NOT NULL | 规则名称 |
| unit_price | `DECIMAL(10,2)` | NOT NULL, CHECK(unit_price >= 0) | 返佣单价（元/订阅） |
| agent_id | `BIGINT` | NULL, FK → agents(id) | 适用 Agent（NULL 表示全局默认） |
| start_at | `TIMESTAMPTZ` | NOT NULL | 生效起始时间 |
| end_at | `TIMESTAMPTZ` | NOT NULL | 生效结束时间 |
| status | `VARCHAR(16)` | NOT NULL, CHECK(status IN ('active', 'inactive')) | 状态：active=启用, inactive=停用 |
| created_by | `BIGINT` | NOT NULL, FK → admins(id) | 创建人 |
| created_at | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | 创建时间 |
| updated_at | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | 更新时间 |

**Indexes**:
- `UNIQUE(agent_id, status) WHERE status = 'active' AND agent_id IS NOT NULL`
- `UNIQUE(status) WHERE status = 'active' AND agent_id IS NULL`
- `INDEX(start_at, end_at)`
- `INDEX(agent_id, start_at, end_at)`

**Validation Rules**:
- `unit_price`: 不允许负数，零值允许但不产生返佣
- `end_at` 必须晚于 `start_at`
- 同一时间范围内，同一 Agent 只能有一条生效规则；全局规则同一时间只能有一条生效

---

## 2. IncentiveRule (阶梯激励规则表)

**Table**: `incentive_rules`
**Purpose**: 定义单笔订阅数量区间对应的激励系数，按超额累进方式分段计算

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | `BIGSERIAL` | PRIMARY KEY | 自增主键 |
| rebate_rule_id | `BIGINT` | NOT NULL, FK → rebate_rules(id), ON DELETE CASCADE | 关联的返佣定价规则 |
| range_start | `INTEGER` | NOT NULL, CHECK(range_start >= 1) | 区间下限（含） |
| range_end | `INTEGER` | NOT NULL, CHECK(range_end >= range_start) | 区间上限（含，NULL 表示无上限） |
| coefficient | `DECIMAL(5,2)` | NOT NULL, DEFAULT 1.00, CHECK(coefficient >= 0) | 激励系数 |
| created_at | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | 创建时间 |

**Indexes**:
- `UNIQUE(rebate_rule_id, range_start)`
- `INDEX(rebate_rule_id)`

**Validation Rules**:
- 同一 RebateRule 下的多条 IncentiveRule 区间必须连续排列，无重叠无间隙
- 第一区间的 `range_start` 必须为 1
- `coefficient` 默认 1.0 表示无额外激励

**Calculation Example**:
- 订阅 30 个，规则为 1-10 系数 1.0、11-50 系数 1.2
- 返佣 = 10×单价×1.0 + 20×单价×1.2

---

## 3. RebateRecord (返佣记录表)

**Table**: `rebate_records`
**Purpose**: 记录每一次订阅行为对应的返佣明细，订阅时实时计算，T+1 后自动结算

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | `BIGSERIAL` | PRIMARY KEY | 自增主键 |
| subscription_id | `BIGINT` | NOT NULL, UNIQUE | 关联的订阅订单 ID |
| agent_id | `BIGINT` | NOT NULL, FK → agents(id) | 被订阅的 Agent |
| creator_id | `BIGINT` | NOT NULL, FK → users(id) | 创作者（Agent 归属人） |
| quantity | `INTEGER` | NOT NULL, CHECK(quantity >= 1) | 该笔订阅数量 |
| unit_price | `DECIMAL(10,2)` | NOT NULL | 计算时使用的单价 |
| amount | `DECIMAL(12,2)` | NOT NULL, CHECK(amount >= 0) | 返佣金额 |
| rebate_rule_id | `BIGINT` | NOT NULL, FK → rebate_rules(id) | 计算依据的规则 ID |
| status | `VARCHAR(16)` | NOT NULL, CHECK(status IN ('pending', 'settled', 'blocked', 'reviewing', 'refunded')) | 待结算/已结算/已拦截/待审核/已退回 |
| arbitrage_tags | `JSONB` | NULL | 防套利触发标记（如 `["self_subscribe", "ip_limit"]`） |
| reviewed_by | `BIGINT` | NULL, FK → admins(id) | 审核人 |
| reviewed_at | `TIMESTAMPTZ` | NULL | 审核时间 |
| created_at | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | 创建时间（订阅时间） |
| settled_at | `TIMESTAMPTZ` | NULL | 实际结算时间（T+1 后） |

**Indexes**:
- `UNIQUE(subscription_id)`
- `INDEX(agent_id, created_at)`
- `INDEX(creator_id, created_at)`
- `INDEX(status, created_at)`
- `INDEX(rebate_rule_id)`

**State Transitions**:
```
[订阅发生]
  ├─ 防套利通过 ──► 状态 = pending（待结算），T+1 后自动 settled
  ├─ 防套利拦截 ──► 状态 = blocked，amount = 0
  └─ 防套利标记待审 ──► 状态 = reviewing，amount 暂冻结

[人工审核 reviewing]
  ├─ 确认正常 ──► 状态 = pending（待结算），T+1 后自动 settled
  └─ 确认套利 ──► 状态 = blocked，amount = 0

[退款发生]
  └─ 状态 = refunded，从可结算金额中扣除
```

---

## 4. AntiArbitrageRule (防套利规则表)

**Table**: `anti_arbitrage_rules`
**Purpose**: 定义各类风控策略及阈值

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | `BIGSERIAL` | PRIMARY KEY | 自增主键 |
| name | `VARCHAR(128)` | NOT NULL | 规则名称 |
| strategy_type | `VARCHAR(32)` | NOT NULL, CHECK(strategy_type IN ('self_subscribe', 'ip_freq', 'new_user_threshold', 'linked_account')) | 策略类型 |
| rule_params | `JSONB` | NOT NULL | 规则参数（如 `{"window_hours": 24, "max_count": 3}`） |
| action | `VARCHAR(16)` | NOT NULL, CHECK(action IN ('block', 'review')) | 处理动作：block=直接拦截, review=标记待审 |
| status | `VARCHAR(16)` | NOT NULL, CHECK(status IN ('active', 'inactive')) | 状态 |
| priority | `INTEGER` | NOT NULL, DEFAULT 0 | 优先级（数值越大优先级越高） |
| created_by | `BIGINT` | NOT NULL, FK → admins(id) | 创建人 |
| created_at | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | 创建时间 |
| updated_at | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | 更新时间 |

**Indexes**:
- `INDEX(strategy_type, status)`
- `INDEX(status, priority DESC)`

**Rule Params Schema**:

| strategy_type | Expected Params | Example |
|---------------|-----------------|---------|
| self_subscribe | `{}` | 创作者不可订阅自己的 Agent |
| ip_freq | `{"window_hours": int, "max_count": int}` | 同一 IP 24 小时内最多 3 次有效返佣 |
| new_user_threshold | `{"window_days": int, "max_subscriptions": int}` | 新注册用户 7 天内订阅超过 10 个 Agent 触发风控 |
| linked_account | `{}` | 关联账号检测（占位，可扩展） |

---

## 5. RebateAuditLog (返佣审核日志表)

**Table**: `rebate_audit_logs`
**Purpose**: 记录管理员对疑似套利返佣记录的人工审核操作

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | `BIGSERIAL` | PRIMARY KEY | 自增主键 |
| rebate_record_id | `BIGINT` | NOT NULL, FK → rebate_records(id) | 审核的返佣记录 |
| admin_id | `BIGINT` | NOT NULL, FK → admins(id) | 审核人 |
| admin_name | `VARCHAR(64)` | NOT NULL | 审核人名称（冗余） |
| conclusion | `VARCHAR(16)` | NOT NULL, CHECK(conclusion IN ('normal', 'arbitrage')) | 审核结论：normal=确认正常, arbitrage=确认套利 |
| remark | `TEXT` | NULL | 备注 |
| created_at | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | 审核时间 |

**Indexes**:
- `INDEX(rebate_record_id)`
- `INDEX(admin_id, created_at)`

---

## 6. Redis Counters (防套利计数器)

**Storage**: Redis
**Purpose**: 实时防套利频次统计，滑动窗口计数

| Key Pattern | Type | TTL | Description |
|-------------|------|-----|-------------|
| `rebate:ip:{ip}:{date}` | String | 48h | 某 IP 某日已产生返佣的次数（原子 incr） |
| `rebate:user:{user_id}:count` | String | 7d | 新用户 7 天内订阅计数 |
| `rebate:device:{device_id}:{date}` | String | 48h | 某设备某日已产生返佣的次数 |

**Notes**:
- 订阅发生时同步读取 Redis 计数器进行校验
- 仅当返佣记录状态为 `pending` 或 `settled` 时才增加计数器
- 被 `blocked` 或标记为 `reviewing` 的订阅不计入计数器
