# Implementation Plan: 用户短信验证码登录与密码登录

**Branch**: `007-user-sms-login` | **Date**: 2026-04-25 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/007-user-sms-login/spec.md`

## Summary

重构用户认证体系，实现双登录方式（短信验证码 + 密码），简化注册流程（去掉邮箱，仅保留名称/昵称、手机号、密码），并将手机号和昵称设为唯一标识。保留现有短信验证码登录的自动注册能力，同时新增显式注册页面和密码登录支持。

## Technical Context

**Language/Version**: Go 1.23, TypeScript 5.3  
**Primary Dependencies**: Gin 1.9, GORM 1.25, React 18, Vite 5, Redis 9, JWT v5, bcrypt  
**Storage**: PostgreSQL 15+ (via GORM), Redis 7+  
**Testing**: Go standard testing (`go test`), Vitest for frontend  
**Target Platform**: Web browser (Chrome/Firefox/Safari/Edge latest 2 versions)  
**Project Type**: web-service (backend REST API + frontend SPA)  
**Performance Goals**: 100 concurrent SMS requests/min, SMS delivery < 30s avg, login p95 < 200ms  
**Constraints**: SMS rate limiting (60s/phone, 10/min/IP), JWT access token 14 days, refresh token 30 days  
**Scale/Scope**: Single tenant, ~10k MAU, single region deployment

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution (`constitution.md`) is currently a template and has not been ratified with concrete principles. Therefore, no active gates to evaluate. Proceeding with standard web-service best practices.

## Project Structure

### Documentation (this feature)

```text
specs/007-user-sms-login/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
apps/
├── api/                          # Go backend (Gin)
│   ├── cmd/main.go
│   ├── internal/
│   │   ├── handler/auth.go       # Auth handlers (login/register/sms)
│   │   ├── handler/user.go       # User profile handlers
│   │   ├── model/user.go         # User entity
│   │   ├── repository/user.go    # User DB repository
│   │   ├── service/sms.go        # SMS service (Aliyun)
│   │   └── middleware/
│   │       ├── jwt.go            # JWT generation/validation
│   │       ├── auth.go           # Auth middleware
│   │       └── login_protection.go # Rate limiting
│   └── migrations/               # DB migrations
├── web/                          # React frontend (user-facing)
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.tsx         # Login page (sms + password tabs)
│   │   │   └── Register.tsx      # Registration page
│   │   ├── components/
│   │   │   └── auth/
│   │   │       ├── PhoneLoginForm.tsx
│   │   │       ├── PasswordLoginForm.tsx
│   │   │       └── RegisterForm.tsx
│   │   └── services/
│   │       └── auth.ts           # Auth API client
└── web-admin/                    # React admin frontend
```

**Structure Decision**: Monorepo with Go backend (`apps/api`) and React SPAs (`apps/web`, `apps/web-admin`). The feature primarily touches `apps/api/internal/handler/auth.go`, `apps/api/internal/model/user.go`, and `apps/web/src/pages/Login.tsx` plus new `Register.tsx`.

## Complexity Tracking

> No constitution violations. Existing architecture is sufficient.
