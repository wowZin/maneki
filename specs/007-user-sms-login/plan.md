# Implementation Plan: 用户短信验证码登录

**Branch**: `007-user-sms-login` | **Date**: 2026-04-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-user-sms-login/spec.md`

## Summary

007 是 Maneki 用户系统的基础 feature，提供完整的用户认证能力。当前已实现：
- 后端：手机号验证码登录/注册、账号密码登录、JWT 认证、微信登录、号码认证一键登录
- 前端：Tab 切换的登录页（密码/手机号）、独立注册页

基于 spec 澄清，需要补充：**忘记密码页面**、**注册表单增加手机号字段**、**"记住我"功能**。

## Technical Context

**Language/Version**: Go 1.23 (backend), React 18 + TypeScript (frontend)
**Primary Dependencies**: Gin, GORM, go-redis, golang-jwt (backend); React, Vite, Ant Design, Zustand, Axios (frontend)
**Storage**: PostgreSQL (users, admins tables), Redis (verification codes: 5min TTL, sessions)
**Testing**: Go testing / testify (backend), Vitest (frontend)
**Target Platform**: Web browser (desktop + mobile)
**Project Type**: web-service (backend) + web-app (frontend)
**Performance Goals**: Login endpoint p95 < 200ms; 1000 concurrent login req/s
**Constraints**: JWT access token 2h / refresh token 7d; CORS support for *.maneki.cn; SMS rate limit 60s per phone
**Scale/Scope**: 10k concurrent users

## Constitution Check

*Constitution is template-only (not ratified). Skipping formal gates.*

## Project Structure

### Documentation (this feature)

```text
specs/007-user-sms-login/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
apps/api/
├── cmd/main.go                    # Gin router, middleware, route registration
├── internal/
│   ├── handler/auth.go            # Login, register, phone auth, JWT handlers
│   ├── handler/user.go            # User profile CRUD
│   ├── middleware/auth.go         # JWT verification middleware
│   ├── middleware/cors.go         # CORS with wildcard subdomain support
│   ├── model/user.go              # User entity (GORM)
│   ├── service/                   # Business logic layer
│   └── repository/                # Data access layer
├── pkg/jwtutil/                   # JWT token generation / validation
└── migrations/                    # Auto-migration on startup

apps/web/
├── src/
│   ├── pages/
│   │   ├── Login/index.tsx        # Tab切换: 密码登录 / 手机号登录
│   │   ├── Register/index.tsx     # 独立注册页 (用户名+邮箱+密码)
│   │   └── ForgotPassword/        # TODO: 忘记密码页 (待实现)
│   ├── services/
│   │   ├── api.ts                 # Axios instance + auth API
│   │   └── pricing.ts             # Pricing API
│   ├── stores/auth.ts             # Zustand auth store (token, user, login/logout)
│   └── hooks/
│       ├── useWechatAuth.ts       # Wechat login integration
│       └── usePhoneAuth.ts        # Aliyun PNS (number authentication)
└── vite.config.ts                 # Dev proxy /api -> localhost:8080
```

**Structure Decision**: Monorepo with separate Go API backend and React Vite frontend. Backend uses layered architecture (handler → service → repository). Frontend uses page-based routing with Zustand global state.

## Complexity Tracking

> No constitution violations identified.
