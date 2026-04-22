# Implementation Plan: 用户手机号登录（号码认证 + 短信验证码）

**Branch**: `007-user-sms-login` | **Date**: 2026-04-22 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/007-user-sms-login/spec.md`

## Summary

实现用户前端手机号登录功能。以阿里云**号码认证（本机号码校验）**为主要登录通道，当环境不支持时自动降级为**阿里云短信验证码**。

用户在登录页选择「手机号登录」，前端引入阿里云 H5 SDK 检测环境：
- **支持号码认证**：用户输入手机号，点击「一键验证」，通过运营商网关直接校验，无需等待短信
- **不支持号码认证**：显示「获取验证码」按钮，用户接收短信后输入验证码完成登录

验证成功后，若手机号未注册则自动创建用户账户，并复用现有 JWT 体系发放身份凭证。

## Technical Context

**Language/Version**: Go 1.21+ (backend API), TypeScript 5.x + React 18 (frontend)
**Primary Dependencies**: Gin, GORM, go-redis/v9, golang-jwt/jwt/v5 (backend); Vite, Ant Design 5.x, Zustand, Axios, React Router DOM (frontend)
**External Services**: 阿里云号码认证服务（dypnsapi）、阿里云短信服务（dysmsapi）
**Storage**: PostgreSQL 15+ (user data), Redis 7+ (短信验证码、频率限制、Token 黑名单)
**Testing**: Go standard testing (backend), React Testing Library + Vitest (frontend)
**Target Platform**: Web browser（号码认证仅限手机浏览器蜂窝网络环境）
**Project Type**: Web application (backend API + SPA frontend)
**Performance Goals**: Token 获取接口 P95 < 300ms，号码认证验证接口 P95 < 500ms，短信发送接口 P95 < 500ms
**Constraints**: 号码认证必须在手机浏览器蜂窝网络下使用；短信验证码 5 分钟过期；同一手机号 60 秒防重发
**Scale/Scope**: 当前用户量级，支持 100+ 并发登录请求/分钟

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
│   └── auth-phone.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
apps/
├── api/                          # Go/Gin 后端
│   ├── internal/
│   │   ├── handler/
│   │   │   └── auth.go           # 现有认证处理器（需扩展手机号登录接口）
│   │   ├── service/
│   │   │   └── sms.go            # [NEW] 阿里云号码认证 + 短信服务层
│   │   ├── model/
│   │   │   └── user.go           # 现有用户模型（Phone 字段已存在）
│   │   ├── repository/
│   │   │   └── user.go           # 现有用户仓库（GetByPhone 已存在）
│   │   └── middleware/
│   │       └── auth.go           # 现有 JWT 中间件（复用）
│   └── cmd/main.go               # 路由注册（需扩展手机号登录路由）
│
└── web/                          # React 用户前端
    ├── src/
    │   ├── pages/
    │   │   └── Login/
    │   │       └── index.tsx     # [MODIFY] 现有登录页增加手机号登录 Tab
    │   ├── services/
    │   │   └── api.ts            # [MODIFY] 增加号码认证 + 短信登录 API
    │   ├── hooks/
    │   │   └── usePhoneAuth.ts   # [NEW] 阿里云号码认证 H5 SDK 封装
    │   └── stores/
    │       └── auth.ts           # 现有认证状态（复用）
    └── package.json
```

**Structure Decision**: 复用现有项目结构。后端新增 `service/sms.go` 封装阿里云 OpenAPI 调用；前端新增 `hooks/usePhoneAuth.ts` 封装阿里云 H5 SDK 的初始化和调用逻辑；现有 `Login` 页面增加手机号登录 Tab。

## Complexity Tracking

> No constitution violations. Feature scope和复杂度与现有功能对齐。

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | N/A | N/A |
