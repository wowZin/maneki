# Research: Admin User Management

**Feature**: 管理后台 - 超级管理员用户管理
**Date**: 2026-04-19

## Technology Decisions

### Backend (apps/api)

- **Language/Runtime**: Go 1.22 (已在使用)
- **Web Framework**: Gin v1.9.1 (已在使用)
- **ORM**: GORM v1.25.9 + PostgreSQL driver (已在使用)
- **Authentication**: JWT (golang-jwt/jwt/v5 已在使用)
- **Cache/Session**: Redis (go-redis/v9 已在使用)
- **Password Hashing**: bcrypt (golang.org/x/crypto 已在使用)
- **CLI Tool**: Go flag 标准库 + 独立 cmd/adminctl 入口
- **Testing**: Go testing + stretchr/testify
- **Logging**: zap (已在使用)

### Frontend (apps/web-admin)

- **Framework**: React 18 + Vite 5 (已在使用)
- **UI Library**: Ant Design 5 (已在使用)
- **State Management**: Zustand 4 (已在使用)
- **HTTP Client**: Axios (已在使用)
- **Routing**: React Router 6 (已在使用)
- **Build Output**: Static SPA served by Nginx

### Database

- **Primary**: PostgreSQL (GORM)
- **Cache/Session**: Redis

## Decisions

| Decision | Rationale |
|----------|-----------|
| 管理员账号与用户账号完全隔离表 | Spec 明确要求两个账号体系隔离；避免权限混淆和安全风险 |
| 命令行工具放在 `apps/api/cmd/adminctl/` | 复用 api 模块的 models、services、config，避免重复代码 |
| JWT + Redis 黑名单做会话管理 | 支持无状态认证 + 强制登出（把 token jti 写入 Redis 黑名单） |
| 前端按角色动态渲染菜单 | 登录后返回 role 字段，前端根据 role 过滤菜单，配合后端路由守卫 |
| 操作日志使用独立表 + 异步写入 | 避免阻塞主业务流程；使用 Go channel + worker 批量写入 |
| 初始密码 111111 在应用层硬编码 | 这是业务需求；首次登录强制修改密码降低安全风险 |

## Alternatives Considered

- OAuth2/SSO: 不采用。项目 MVP 阶段不需要，账户名称+密码更简单直接。
- Session Cookie: 不采用。JWT + Redis 黑名单更适配无状态 API 设计，且已有 JWT 依赖。
- 前端 RBAC 细粒度到按钮级: 不采用。Spec 只要求菜单级权限控制，按钮级过度设计。
