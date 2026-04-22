# Implementation Plan: 用户短信验证码登录

**Branch**: `007-user-sms-login` | **Date**: 2026-04-22 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/007-user-sms-login/spec.md`

## Summary

实现用户前端短信验证码登录功能。用户在登录页输入手机号，获取短信验证码，输入验证码后完成自动注册/登录。后端通过 Redis 存储验证码并控制发送频率，集成短信服务商发送短信，验证成功后复用现有 JWT 体系生成身份凭证。

## Technical Context

**Language/Version**: Go 1.21+ (backend API), TypeScript 5.x + React 18 (frontend)
**Primary Dependencies**: Gin, GORM, go-redis/v9, golang-jwt/jwt/v5 (backend); Vite, Ant Design 5.x, Zustand, Axios, React Router DOM (frontend)
**Storage**: PostgreSQL 15+ (user data), Redis 7+ (验证码、频率限制、Token 黑名单)
**Testing**: Go standard testing (backend), React Testing Library + Vitest (frontend)
**Target Platform**: Web browser (Chrome/Firefox/Safari/Edge 最新 2 个版本)
**Project Type**: Web application (backend API + SPA frontend)
**Performance Goals**: 验证码发送接口 P95 < 500ms，登录接口 P95 < 200ms
**Constraints**: 短信服务商需在中国大陆可用；验证码 5 分钟过期；同一手机号 60 秒防重发
**Scale/Scope**: 当前用户量级，支持 100+ 并发验证码请求/分钟

## Constitution Check

*Constitution file is currently a template only (`.specify/memory/constitution.md`), not yet ratified. No gates to enforce.*

## Project Structure

### Documentation (this feature)

```text
specs/007-user-sms-login/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── auth-sms.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
apps/
├── api/                          # Go/Gin 后端
│   ├── internal/
│   │   ├── handler/
│   │   │   └── auth.go           # 现有认证处理器（需扩展）
│   │   ├── service/
│   │   │   └── sms.go            # [NEW] SMS 服务层
│   │   ├── model/
│   │   │   └── user.go           # 现有用户模型（Phone 字段已存在）
│   │   ├── repository/
│   │   │   └── user.go           # 现有用户仓库（GetByPhone 已存在）
│   │   └── middleware/
│   │       └── auth.go           # 现有 JWT 中间件（复用）
│   └── cmd/main.go               # 路由注册（需扩展 SMS 路由）
│
└── web/                          # React 用户前端
    ├── src/
    │   ├── pages/
    │   │   └── Login/
    │   │       └── index.tsx     # [MODIFY] 现有登录页增加短信登录 Tab
    │   ├── services/
    │   │   └── api.ts            # [MODIFY] 增加 SMS 登录 API
    │   └── stores/
    │       └── auth.ts           # 现有认证状态（复用）
    └── package.json
```

**Structure Decision**: 复用现有项目结构，不引入新目录层级。后端在 `apps/api/internal/service/` 新增 SMS 服务层；前端在现有 `Login` 页面增加短信登录 Tab/切换，保持登录页单一入口。

## Complexity Tracking

> No constitution violations. Feature scope和复杂度与现有功能对齐。

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | N/A | N/A |
