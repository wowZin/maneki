# Implementation Plan: 管理后台 - 超级管理员用户管理

**Branch**: `001-stock-agent-prediction` | **Date**: 2026-04-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/002-admin-user-management/spec.md`

## Summary

为管理后台构建完整的用户管理能力，涵盖：
1. 管理员认证体系（超级管理员 + 普通管理员），账户名称+密码登录，JWT 会话管理
2. 超级管理员命令行管理（创建、改密）
3. 超级管理员在后台创建/禁用普通管理员
4. 管理员管理普通用户（搜索、查看、禁用、重置密码）
5. 操作日志记录与查询
6. 权限控制：普通管理员看不到"管理员设置"菜单

后端使用 Go/Gin/GORM/PostgreSQL/Redis，前端使用 React/Ant Design/Vite/Zustand。

## Technical Context

**Language/Version**: Go 1.22 (backend), TypeScript/React 18 (frontend)  
**Primary Dependencies**: Gin, GORM, JWT, go-redis, Ant Design, Zustand, React Router  
**Storage**: PostgreSQL (persistent), Redis (session/cache)  
**Testing**: Go testing + stretchr/testify, Vitest (frontend)  
**Target Platform**: Linux server + Browser (H5/Admin)  
**Project Type**: web-service (admin backend + SPA frontend)  
**Performance Goals**: API p95 < 200ms, admin page first load < 2s  
**Constraints**: Admin/user account systems must be strictly isolated  
**Scale/Scope**: < 100 admin accounts, < 100k users  

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution file is a template with no active constraints. No gates to enforce.

## Project Structure

### Documentation (this feature)

```text
specs/002-admin-user-management/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── api-auth.md
│   ├── api-admin.md
│   ├── api-user.md
│   └── api-audit.md
└── tasks.md             # Phase 2 output (speckit.tasks)
```

### Source Code (repository root)

```text
apps/api/
├── cmd/
│   ├── main.go              # API server entry
│   └── adminctl/
│       └── main.go          # CLI tool for super admin management
├── internal/
│   ├── config/
│   │   └── config.go        # App config (DB, Redis, JWT secret)
│   ├── middleware/
│   │   ├── auth.go          # JWT auth middleware
│   │   └── rbac.go          # Role-based access control
│   ├── models/
│   │   ├── admin.go         # Admin entity (SuperAdmin + Admin)
│   │   ├── user.go          # User entity (frontend user)
│   │   └── audit_log.go     # Audit log entity
│   ├── repository/
│   │   ├── admin_repo.go
│   │   ├── user_repo.go
│   │   └── audit_repo.go
│   ├── service/
│   │   ├── auth_service.go
│   │   ├── admin_service.go
│   │   ├── user_service.go
│   │   └── audit_service.go
│   ├── handler/
│   │   ├── auth_handler.go
│   │   ├── admin_handler.go
│   │   ├── user_handler.go
│   │   └── audit_handler.go
│   └── cli/
│       └── admin_cli.go     # CLI logic (create super admin, reset password)
├── pkg/
│   └── jwtutil/
│       └── jwtutil.go       # JWT generate/parse utilities
├── go.mod
└── tests/
    ├── handler/
    ├── service/
    └── integration/

apps/web-admin/
├── src/
│   ├── api/
│   │   ├── auth.ts          # Auth API client
│   │   ├── admin.ts         # Admin API client
│   │   ├── user.ts          # User API client
│   │   ├── audit.ts         # Audit log API client
│   │   └── client.ts        # Axios instance + interceptors
│   ├── components/
│   │   ├── Layout/
│   │   │   └── AdminLayout.tsx   # Sidebar + Header with dynamic menus
│   │   └── common/
│   ├── pages/
│   │   ├── Login/
│   │   │   └── LoginPage.tsx
│   │   ├── Dashboard/
│   │   │   └── DashboardPage.tsx
│   │   ├── AdminSettings/
│   │   │   └── AdminListPage.tsx   # Super admin only
│   │   ├── UserManagement/
│   │   │   ├── UserListPage.tsx
│   │   │   └── UserDetailPage.tsx
│   │   └── AuditLog/
│   │       └── AuditLogPage.tsx
│   ├── stores/
│   │   └── authStore.ts     # Zustand: auth state, role, menu visibility
│   ├── router/
│   │   └── index.tsx        # Route config with role guards
│   ├── types/
│   │   └── index.ts
│   └── utils/
│       └── permission.ts    # Role-based menu filter
├── package.json
├── vite.config.ts
└── nginx.conf
```

**Structure Decision**: 使用现有的 monorepo 结构。后端 admin 功能放在 `apps/api`（Go），前端 admin 放在 `apps/web-admin`（React）。命令行工具放在 `apps/api/cmd/adminctl/` 复用同模块的 models 和 services。

## Complexity Tracking

> No constitution violations. No complexity justifications needed.
