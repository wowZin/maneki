# Data Model: 首页概览数据看板

**Date**: 2026/04/25
**Feature**: 首页概览数据看板

## 实体关系图

```
+----------------------------+       +-----------------------------+
|        users               |       |      user_stock_trackings   |
+----------------------------+       +-----------------------------+
| id (uuid, PK)              |<-----| user_id (uuid, FK)          |
| ...                        |       | stock_code (str, FK)        |
+----------------------------+       | track_date (date)           |
                                     | hit_status (bool)           |
                                     | created_at (timestamp)      |
                                     +-----------------------------+
                                              |
                                              v
                                     +-----------------------------+
                                     |         stocks              |
                                     +-----------------------------+
                                     | code (str, PK)              |
                                     | name (str)                  |
                                     +-----------------------------+

+----------------------------+       +-----------------------------+
|        agents              |       | agent_performance_snapshots |
+----------------------------+       +-----------------------------+
| id (uint, PK)              |<-----| agent_id (uint, FK)         |
| name (str)                 |       | period_type (str)           |
| type (str)                 |       | period_start (date)         |
+----------------------------+       | total_predictions (int)     |
                                     | hit_count (int)             |
                                     | hit_rate (decimal)          |
                                     +-----------------------------+

+----------------------------+
|        hot_stocks          |
+----------------------------+
| id (uint, PK)              |
| stock_code (str, FK)       |
| heat_score (decimal)       |
| rank (int)                 |
| change_pct (decimal)       |
| volume (decimal)           |
| calculated_at (timestamp)  |
+----------------------------+

+----------------------------+
|        signals             |  (已存在)
+----------------------------+
| id (uint, PK)              |
| code (str)                 |
| signal_type (str)          |
| confidence (decimal)       |
| is_valid (bool)            |
| created_at (timestamp)     |
+----------------------------+
```

## 新增实体

### 1. UserStockTracking (用户股票追踪)

记录用户主动选中/关注的股票及其涨停命中情况。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | uint | PK, auto_increment | 自增主键 |
| user_id | uuid | not null, index | 关联 users.id |
| stock_code | string(20) | not null, index | 关联 stocks.code |
| track_date | date | not null, index | 选中/关注的日期 |
| hit_status | bool | default: null | 当日是否实际涨停 (收盘后复盘更新) |
| created_at | timestamp | auto | 记录创建时间 |

**索引设计**:
- `idx_user_track_date`: (user_id, track_date) — 支持按用户和日期范围查询趋势
- `idx_track_date_hit`: (track_date, hit_status) — 支持全局统计

**表名**: `user_stock_trackings`

---

### 2. AgentPerformanceSnapshot (Agent 表现快照)

预计算的 Agent 命中率统计，支持按日/周/月等多周期查询。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | uint | PK, auto_increment | 自增主键 |
| agent_id | uint | not null, index | 关联 agents.id |
| period_type | string(20) | not null, index | 统计周期: 'daily', 'weekly', 'monthly' |
| period_start | date | not null, index | 周期起始日期 |
| total_predictions | int | not null, default: 0 | 该周期内预测总次数 |
| hit_count | int | not null, default: 0 | 该周期内命中次数 |
| hit_rate | decimal(5,4) | not null, default: 0 | 命中率 (0.0000 ~ 1.0000) |
| updated_at | timestamp | auto | 更新时间 |

**索引设计**:
- `idx_agent_period`: (agent_id, period_type, period_start) — 支持按 Agent + 周期查询趋势
- `idx_period_start`: (period_type, period_start) — 支持批量更新

**表名**: `agent_performance_snapshots`

**计算逻辑**:
- `total_predictions`: 该 Agent 在周期内产生的 `agent_decisions` 记录数（decision = 'buy' 或 signal_type = 'watch' 视业务而定）
- `hit_count`: 对应 `signals.is_valid = true` 的记录数
- `hit_rate`: hit_count / total_predictions

---

### 3. HotStock (热门股票)

预计算的热门股票榜单，每日/定时更新。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | uint | PK, auto_increment | 自增主键 |
| stock_code | string(20) | not null, index | 关联 stocks.code |
| heat_score | decimal(10,4) | not null | 热度综合得分 |
| rank | int | not null, index | 热度排名 (1, 2, 3...) |
| change_pct | decimal(6,2) | not null | 最新涨跌幅 (%) |
| volume | decimal(20,2) | not null | 最新成交量 |
| calculated_at | timestamp | not null | 热度计算时间 |

**索引设计**:
- `idx_rank`: (rank) — 支持按排名快速查询榜单
- `idx_calculated_at`: (calculated_at) — 支持清理过期数据

**表名**: `hot_stocks`

**热度计算因子** (示例权重，可配置):
- 用户关注度 (user_stock_trackings 中该股票被关注次数)
- 涨跌幅绝对值 (change_pct)
- 成交量放大倍数 (当日成交量 / 近期平均成交量)
- 预测命中次数 (signals.is_valid = true)

---

## 复用实体

### Signal (信号表) — 已存在

用于实时信号展示和命中统计的基础数据源。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | uint | PK | 自增主键 |
| code | string(20) | not null, index | 股票代码 |
| signal_type | string(20) | not null | 信号类型: buy/sell/watch/alert |
| confidence | decimal(3,2) | not null | 置信度 0.00~1.00 |
| is_valid | bool | default: true | 复盘时标记是否正确命中 |
| created_at | timestamp | auto | 信号产生时间 |

**表名**: `signals`

---

### AgentDecision (Agent 决策表) — 已存在

用于统计各 Agent 命中率的基础数据源。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | uint | PK | 自增主键 |
| signal_id | uint | not null, index | 关联 signals.id |
| agent_type | string(30) | not null | Agent 类型标识 |
| decision | string(10) | not null | 决策: buy/sell/hold |
| score | decimal(3,2) | nullable | 打分 |

**表名**: `agent_decisions`

---

### Agent (Agent 表) — 已存在

展示 Agent 命中率时的基础信息源。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | uint | PK | 自增主键 |
| name | string(100) | not null | Agent 名称 |
| type | string(30) | not null | Agent 类型 |
| is_active | bool | default: true | 是否启用 |

**表名**: `agents`

---

## 数据流

```
┌─────────────────────────────────────────────────────────────┐
│                     数据来源层                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ signals     │  │ agent_dec.  │  │ user_stock_trackings│  │
│  │ (信号)      │  │ (Agent投票) │  │ (用户追踪)          │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
└─────────┼────────────────┼────────────────────┼─────────────┘
          │                │                    │
          ▼                ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                     聚合计算层 (定时任务 / 实时查询)           │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────┐ │
│  │ Agent命中率统计   │  │ 热门股票热度计算  │  │ 正确率趋势  │ │
│  │ (写入快照表)      │  │ (写入 hot_stocks)│  │ (SQL聚合)  │ │
│  └──────────────────┘  └──────────────────┘  └────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     API 服务层                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Overview    │  │ Redis Cache │  │ Response DTO        │  │
│  │ Service     │  │ (TTL 5-15min)│  │ (JSON)              │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     前端展示层                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ ECharts     │  │ Ant Design  │  │ Zustand Store       │  │
│  │ (趋势图表)   │  │ (卡片/表格) │  │ (状态管理)          │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 状态与约束

### 命中率计算口径

- **打板预测正确率**: 在指定时间窗口内，`signals.signal_type = 'watch'` 且 `signals.is_valid = true` 的记录数 ÷ 该窗口内 `signal_type = 'watch'` 的总记录数
- **Agent 命中率**: 在指定时间窗口内，某 Agent 的 `agent_decisions` 中 `decision = 'buy'` 且关联的 `signal.is_valid = true` 的记录数 ÷ 该 Agent 同期 `decision = 'buy'` 的总记录数

### 数据时效性

- `agent_performance_snapshots`: 通过定时任务更新（建议每 5 分钟或每日收盘后）
- `hot_stocks`: 每日开盘后计算并更新（建议 09:30、10:00、11:30、14:00、15:00 各更新一次）
- `user_stock_trackings.hit_status`: 每日收盘后复盘脚本更新（约 15:30 后）
- `signals`: 实时写入，前端轮询读取（建议 10-30 秒）
