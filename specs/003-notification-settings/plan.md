# Implementation Plan: 通知设置管理

**Branch**: `003-notification-settings` | **Date**: 2026-04-19 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/003-notification-settings/spec.md`

## Summary

实现系统设置中的通知管理功能。管理员可通过管理后台创建、编辑、失效、复制系统通知；用户端根据当前时间和自身VIP等级查看对其可见的生效通知。通知支持普通/紧急两种优先级，按优先级分组展示。

## Technical Context

**Language/Version**: Go 1.22
**Primary Dependencies**: Gin, GORM, PostgreSQL (via GORM driver), golang-jwt/jwt/v5
**Storage**: PostgreSQL (TimescaleDB) + Redis (for admin auth blacklist)
**Testing**: Go testing + testify
**Target Platform**: Linux server (Docker container)
**Project Type**: web-service
**Performance Goals**: 100条以内列表查询 < 500ms, 支持1000条历史记录
**Constraints**: 单一时区(Asia/Shanghai), 管理员权限校验复用现有中间件
**Scale/Scope**: 单体应用内新增模块，不涉及微服务拆分

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Library-First | N/A | 单体应用内模块，不拆分为独立库 |
| II. CLI Interface | N/A | Web服务，通过HTTP API暴露 |
| III. Test-First | Pass | 需为repository和handler编写单元测试 |
| IV. Integration Testing | Pass | Admin/User API契约变更需回归测试 |
| V. Observability | Pass | 复用现有日志和错误处理模式 |
| VI. Versioning & Breaking Changes | Pass | 新增API，不影响现有接口 |
| VII. Simplicity | Pass | 复用现有分层架构，不引入新中间件 |

## Project Structure

### Documentation (this feature)

```text
specs/003-notification-settings/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── admin-api.md
│   └── user-api.md
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
apps/api/
├── cmd/main.go                              # Add SystemNotification to auto-migration, register routes
├── internal/model/
│   └── system_notification.go               # New: GORM model
├── internal/repository/
│   └── system_notification.go               # New: CRUD + list + disable + duplicate
├── internal/handler/
│   └── system_notification.go               # New: admin + user handlers
├── internal/service/                        # (Optional) business logic layer if needed
└── pkg/response/                            # Reuse existing response helpers
```

**Structure Decision**: 完全复用现有分层架构。新增 `SystemNotification` 模型、仓库、处理器，遵循与现有 `Agent`、`Settings`、`Notification` 模块完全一致的代码组织方式。

## Complexity Tracking

No constitution violations requiring justification.
