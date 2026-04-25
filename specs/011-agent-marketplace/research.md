# Research: Agent Marketplace

**Date**: 2026/04/25
**Feature**: Agent Marketplace

## 决策总览

| 议题 | 决策 | 理由 | 备选方案及未采纳原因 |
|------|------|------|---------------------|
| 数据模型复用 | 复用现有 `agents` 和 `agent_subscriptions` 表，不新增模型 | 现有 schema 已覆盖 marketplace 所需全部字段（name, description, avatar, type, category, price, rating, use_count, owner_id, is_active, is_featured, is_official） | 新建 `marketplace_agents` 表：数据重复，增加维护成本 |
| Agent 预测准确率来源 | 从 `agent_performance_snapshots` 表读取最新 `hit_rate` |  homepage-overview 功能已建立该快照表，按 agent_id + period_type 聚合 | 实时 SQL 聚合 signals + agent_decisions：数据量大后性能差，且已有时序快照 |
| VIP 免费订阅实现 | VIP 用户订阅时将 `AgentSubscription.price` 设为 0，跳过支付流程 | 最简单实现，复用现有订阅表，无需引入支付网关 | 新建 `vip_free_subscriptions` 表：与现有订阅逻辑分离，增加复杂度 |
| SVIP 创建权限控制 | 后端 `CreateAgent` 增加 `vip_level >= 2` 校验；前端根据 `authStore.vip_level` 条件渲染按钮 | 前后端双重校验，安全且用户体验好 | 纯前端控制：不安全，用户可直接调用 API |
| 市场列表排序 | 后端 SQL `ORDER BY` 支持 accuracy / use_count / rating / created_at | 数据库排序高效，分页简单 | 前端排序：数据量大时性能差，且破坏分页 |
| 作者信息展示 | 后端 join `users` 表获取 `nickname`/`username`，返回 `author_name` 字段 | 一次查询完成，避免前端多次请求 | 前端分别请求 user API：增加请求数和延迟 |
| Agent 创建表单 | 参考 admin-web `AgentCreate.tsx` 字段和交互，适配主站 Ant Design 主题 | 保持一致性，减少设计和开发成本 | 全新设计：浪费时间，且用户需重新学习 |

## 关键发现

### 现有数据模型可利用性

1. **`agents` 表**: 已包含 marketplace 展示所需的全部基础字段。`OwnerID` 关联用户作为作者；`Rating` + `RatingCount` 支持评分展示；`UseCount` 支持 popularity 排序；`Price` + `PriceType` 支持付费/免费逻辑。
2. **`agent_subscriptions` 表**: 已有 `user_id`, `agent_id`, `status`, `price` 字段。VIP 免费订阅只需将 `price` 设为 0 并设置 `status = active`。
3. **`agent_performance_snapshots` 表**: homepage-overview 已创建，包含 `agent_id`, `hit_rate`, `period_type`。marketplace 取 `period_type = '30d'` 的 `hit_rate` 作为预测准确率。
4. **`users` 表**: 已有 `vip_level` (0=free, 1=vip, 2=svip) 和 `vip_expire_at`，以及 `DisplayName()` 方法。

### 后端架构模式

- 项目使用 **handler → repository** 模式（无独立 service 层）处理简单 CRUD。
- homepage-overview 功能引入了 **handler → service → repository** 模式处理复杂业务逻辑。
- Agent marketplace 的订阅和创建逻辑涉及权限校验和业务规则，建议采用 **handler → service → repository** 模式以保持与 homepage-overview 的一致性。

### 前端架构模式

- 路由使用 `react-router-dom` v6，`App.tsx` 中通过 `RootRoute` 区分登录/未登录状态。
- 新页面需：在 `App.tsx` 注册路由、在 `Layout/index.tsx` 添加侧边栏菜单项、创建 `services/*.ts` API 客户端。
- 前端 auth store 中已包含 `vip_level` 和 `is_vip` 字段，可直接用于条件渲染。

### 权限中间件

- `middleware.AuthMiddleware` 将 `vip_level` 注入 gin context。
- `middleware.VIPAuthMiddleware` 检查 `vip_level >= 1`。
- 项目**没有**现成的 `SVIPAuthMiddleware`，需要新建一个检查 `vip_level >= 2` 的中间件。

## 性能考量

- `agents` 表数据量预计 < 500 条，列表查询和排序性能无需特别优化。
- `agent_performance_snapshots` 联表查询需加索引：`agent_id` + `period_type` 组合索引已存在（homepage-overview 创建时建立）。
- 热门排序（use_count）和评分排序（rating）可直接利用现有字段索引。
