# Research: 系统设置 - 返佣规则模块

**Feature**: 系统设置 - 返佣规则模块
**Date**: 2026-04-19

## Technology Decisions

### Backend (apps/api)

- **Language/Runtime**: Go 1.22 (已在使用)
- **Web Framework**: Gin v1.9.1 (已在使用)
- **ORM**: GORM v1.25.9 + PostgreSQL driver (已在使用)
- **Authentication**: JWT (golang-jwt/jwt/v5 已在使用)
- **Cache/Session**: Redis (go-redis/v9 已在使用)
- **Testing**: Go testing + stretchr/testify
- **Logging**: zap (已在使用)

### Frontend (apps/web-admin)

- **Framework**: React 18 + Vite 5 (已在使用)
- **UI Library**: Ant Design 5 (已在使用)
- **State Management**: Zustand 4 (已在使用)
- **HTTP Client**: Axios (已在使用)
- **Routing**: React Router 6 (已在使用)

### Database

- **Primary**: PostgreSQL (GORM)
- **Cache/Session/Anti-Arbitrage Counters**: Redis

## Decisions

| Decision | Rationale |
|----------|-----------|
| 返佣记录表独立存储，不直接修改订阅订单表 | 订阅模块与返佣模块解耦，返佣模块通过事件/消息接收订阅事件 |
| 使用 Redis 存储防套利计数器（IP/设备/用户频次） | 高频查询，Redis 原子 incr + TTL 天然适合滑动窗口计数 |
| T+1 结算通过定时任务批量更新"待结算"→"已结算" | 避免实时打款复杂度；每日凌晨跑批处理前一天的待结算记录 |
| 阶梯激励采用超额累进（非全额累进） | Spec 明确要求：仅超出部分按对应区间系数计算，默认系数 1 |
| 专属规则优先于全局规则 | 业务直觉：特定 Agent 的定制规则应覆盖默认规则 |
| 返佣金额不允许负数（数据库 CHECK + 应用层校验） | 防止配置错误导致资金损失 |

## Alternatives Considered

- 防套利规则使用独立服务/规则引擎（如 OPA）: 不采用。当前规则类型固定且数量有限，Go 代码实现更简单直接。
- 返佣结算使用事件队列异步处理: 不采用。计算必须在订阅时同步完成（<1s），但状态流转（待结算→已结算）使用定时任务即可。
- 激励规则使用数据库 JSON 字段存储区间数组: 不采用。独立表 IncentiveRule 更规范，便于索引和校验区间连续性。
