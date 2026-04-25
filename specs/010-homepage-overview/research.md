# Research: 首页概览数据看板

**Date**: 2026/04/25
**Feature**: 首页概览数据看板

## 决策总览

| 议题 | 决策 | 理由 | 备选方案及未采纳原因 |
|------|------|------|---------------------|
| 预测正确率计算方式 | 基于 `signals` + `agent_decisions` 表，按信号产生日期聚合统计 | 复用现有数据模型，`signals` 已记录信号类型与有效性，`agent_decisions` 记录各 Agent 投票 | 新建 prediction_records 表：数据重复，增加维护成本 |
| 用户选中股票追踪 | 新增 `user_stock_trackings` 表 | 现有 `user_agents` 是用户-Agent 关联，不是股票追踪；无现成表可复用 | 用 Redis 存储：需持久化历史数据，Redis 不合适 |
| Agent 命中率存储 | 新增 `agent_performance_snapshots` 预计算表 + 定时任务更新 | 命中率需按日/周/月多维度查询，实时计算性能差；预计算保证查询速度 | 纯实时 SQL 聚合：数据量大后性能不可接受 |
| 热门股票存储 | 新增 `hot_stocks` 预计算表，每日开盘后更新 | 热度计算涉及多维度聚合（关注度、成交量、涨跌幅），预计算可降低实时查询压力 | 纯实时计算：热度聚合涉及全表扫描，性能差 |
| 实时信号展示 | 直接查询 `signals` 表最新 N 条，前端轮询刷新 | 已有 `signals` 表结构完善，前端轮询实现简单，符合当前规模 | WebSocket 推送：当前用户量不大，轮询足够，WebSocket 增加复杂度 |
| 前端图表库 | ECharts（项目已有依赖） | `apps/web/package.json` 已依赖 `echarts@^5.4.3`，无需新增依赖 | Ant Design Charts：已引入 ECharts，保持技术栈统一 |
| 数据缓存策略 | Redis 缓存热点数据（热门股票、Agent 命中率），TTL 5-15 分钟 | 这些读多写少的数据适合缓存，减少 DB 压力 | 不缓存：首页是高频访问页面，需保证响应速度 |

## 关键发现

### 现有数据模型可利用性

1. **`signals` 表**: 已包含 `code`, `signal_type`, `confidence`, `created_at`, `is_valid` 等字段，可直接用于统计信号命中情况。`is_valid` 字段在复盘时标记，适合作为"是否正确命中"的判断依据。
2. **`agent_decisions` 表**: 已包含 `signal_id`, `agent_type`, `decision`, `score` 等字段，可直接用于统计各 Agent 的投票命中情况。
3. **`agents` 表**: 已有 `id`, `name`, `type`, `is_active` 等字段，Agent 命中率展示可直接关联。
4. **`stocks` + `kline_1d` 表**: 股票基础信息和日线行情已有时序数据，热门股票计算和涨停判断可基于这些表。
5. **缺少的模型**: 用户主动"选中/关注"某只涨停股票的追踪记录 —— 需要新建表。

### 性能考量

- `signals` 和 `agent_decisions` 表随时间增长数据量较大，按日聚合的命中率统计若实时 SQL 查询，在数据量大时（如 >100万条）可能出现性能瓶颈。
- 建议对命中率、热门股票等聚合类数据采用**预计算 + 缓存**策略：
  - 后端定时任务（如每 5 分钟或每日收盘后）计算并写入快照表
  - 前端请求时优先读快照表 + Redis 缓存

### 实时信号时效性

- 当前 `signals` 表由 `service-data` (Python) 或其他 Agent 系统写入，API 层只负责读取
- 实时信号的"实时"体现在前端轮询频率（建议 10-30 秒一次），而非后端推送
- 若未来用户量增长，可平滑升级为 WebSocket/SSE 方案
