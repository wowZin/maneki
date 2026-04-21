# Research: 用户管理增强 - 等级、准确率与 Agent 数据

## Decisions

### 1. 打板准确率字段存储位置
- **Decision**: 在 `users` 表中新增 `board_accuracy` 字段（decimal 类型，如 `decimal(5,2)`），由后台统计任务定期更新。
- **Rationale**: 准确率是用户维度的聚合指标，直接存储在用户表上便于列表排序和筛选，避免列表查询时进行复杂聚合计算导致性能下降。
- **Alternatives considered**:
  - 实时 JOIN 预测记录表聚合：列表页性能不可接受。
  - 单独统计表 + JOIN：增加不必要的表关联复杂度，当前准确率只是单个数值指标。

### 2. 列表页按准确率排序的实现方式
- **Decision**: 后端 SQL `ORDER BY board_accuracy DESC, updated_at DESC`，前端通过查询参数 `sort_by=accuracy` 触发。
- **Rationale**: 利用数据库索引排序是最可靠且性能可控的方式。若数据量大可后续为 `board_accuracy` 加索引。
- **Alternatives considered**:
  - 前端内存排序：数据分页后排序不完整，仅对当前页有效，体验差。

### 3. 用户详情页 Agent 数据范围
- **Decision**: 展示该用户**订阅**的 Agent 列表（来自 `agent_subscriptions` 表）及其关键表现数据，同时展示用户的 Agent **权重配置**（来自 `agent_weights` 表）。
- **Rationale**: 从运营视角，管理员关心的是用户使用了哪些 Agent、订阅状态及使用效果；权重配置反映用户个性化设置。
- **Alternatives considered**:
  - 仅展示用户创建的 Agent：范围过窄，无法反映用户实际使用情况。

### 4. 等级筛选交互模式
- **Decision**: 前端使用 Ant Design `Select` 多选组件（`mode="multiple"`），支持同时选择多个等级（如 VIP + SVIP），查询参数以逗号分隔传递（`vip_levels=1,2`）。
- **Rationale**: 多选更灵活，满足"查看所有付费用户"等组合筛选场景。

### 5. 用户响应字段的兼容性
- **Decision**: 后端 `UserResponse` 新增 `vip_level_label`（中文等级名）、`board_accuracy`（准确率，可为 null），保持现有字段不变以确保向前兼容。
- **Rationale**: 前端现有页面依赖当前字段，新增字段不会破坏已有功能。
