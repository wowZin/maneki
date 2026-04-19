# Research: 通知设置管理

## Decision: 复用现有 Go API 技术栈

**Rationale**: 项目采用双后端架构（Go API + Python Data Service），通知管理属于系统管理类功能，应放在 Go API 服务中，与现有 admin 模块保持一致。

**Alternatives considered**:
- 放在 Python Data Service → 拒绝，Python 服务主要负责数据采集和同步，管理功能不归其职责范围
- 独立微服务 → 拒绝，项目规模不需要，增加运维复杂度

## Decision: 遵循现有分层架构模式

**Rationale**: 项目已有清晰的 layered architecture（model → repository → handler），现有 Agent、Settings、Notification 模块均遵循此模式。保持一致性降低认知成本。

**Pattern reference**:
- Model: `apps/api/internal/model/`
- Repository: `apps/api/internal/repository/`
- Handler: `apps/api/internal/handler/`
- Route registration in `cmd/main.go`

## Decision: 通知状态采用数据库计算 + 查询时过滤

**Rationale**: 通知有 4 种状态（待生效 / 生效中 / 已过期 / 已失效），其中前 3 种由当前时间与生效时间段的比较动态决定，最后一种由管理员操作决定。无需状态字段持久化，查询时根据规则计算即可。已失效通过单独字段 `is_disabled` 标记。

**State transitions**:
```
创建 → 待生效 → 生效中 → 已过期
            ↓
         已失效 (管理员操作，终态)
```

## Decision: 用户等级过滤采用数值比较

**Rationale**: 规格说明明确用户等级为数值（1=普通, 2=VIP, 3=SVIP），通知配置"最低可见等级"。查询时用 `user_level >= min_visible_level` 即可。无需多对多关联表。

## Decision: 消息类型映射为优先级字段

**Rationale**: 规格说明要求按消息类型（普通/紧急）分组展示。在数据模型中用 `priority` 整数字段（1=普通, 2=紧急），用户端查询时 `ORDER BY priority DESC`。

## Decision: 不引入新消息队列或推送机制

**Rationale**: 规格说明中用户端是"查看通知列表"的拉取模式，不是实时推送。无需引入 RabbitMQ/Kafka/WebSocket。生效时间的时效性由用户端查询时的过滤条件保证。

## Decision: 时间校验在 Handler 层和 Repository 层双重保障

**Rationale**: 规格要求前后端都校验结束时间 > 开始时间。Go API 中 Handler 层用 `binding` 标签做基础校验，Service/Repository 层做业务规则校验。
