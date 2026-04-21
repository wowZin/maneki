# Implementation Plan: 系统设置 - 返佣规则模块

**Branch**: `004-rebate-rules` | **Date**: 2026-04-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/004-rebate-rules/spec.md`

## Summary

为管理后台构建返佣规则模块，涵盖：
1. 返佣定价规则管理（新增、编辑、启用/停用，含全局规则与指定 Agent 规则）
2. 阶梯激励规则（单笔订阅数量超额累进系数激励）
3. 防套利规则配置（自订阅拦截、IP/设备频次限制、新用户阈值、关联账号检测）
4. 返佣记录实时计算与 T+1 结算状态流转
5. 返佣统计数据看板与 CSV 导出
6. 人工审核被标记为"待审核"的返佣记录

后端使用 Go/Gin/GORM/PostgreSQL/Redis，前端使用 React/Ant Design/Vite/Zustand。

## Technical Context

**Language/Version**: Go 1.22 (backend), TypeScript/React 18 (frontend)
**Primary Dependencies**: Gin, GORM, JWT, go-redis, Ant Design, Zustand, React Router
**Storage**: PostgreSQL (persistent), Redis (session/cache/anti-arbitrage counters)
**Testing**: Go testing + stretchr/testify, Vitest (frontend)
**Target Platform**: Linux server + Browser (Admin)
**Project Type**: web-service (admin backend + SPA frontend)
**Performance Goals**: API p95 < 200ms, rebate calculation < 1s, stats page load < 500ms
**Constraints**: 防套利规则必须在返佣记录写入前同步完成校验；返佣金额不允许负数
**Scale/Scope**: < 10k agents, < 1M rebate records, < 100 admin accounts

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution file is a template with no active constraints. No gates to enforce.

## Project Structure

### Documentation (this feature)

```text
specs/004-rebate-rules/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── api-rebate-rule.md
│   ├── api-incentive-rule.md
│   ├── api-rebate-record.md
│   ├── api-anti-arbitrage-rule.md
│   └── api-rebate-stats.md
└── tasks.md             # Phase 2 output (speckit.tasks)
```

### Source Code (repository root)

```text
apps/api/
├── cmd/
│   └── main.go              # API server entry (register new handlers)
├── internal/
│   ├── model/
│   │   ├── rebate_rule.go       # RebateRule + IncentiveRule entities
│   │   ├── rebate_record.go     # RebateRecord entity
│   │   └── anti_arbitrage_rule.go # AntiArbitrageRule entity
│   ├── repository/
│   │   ├── rebate_rule_repo.go
│   │   ├── rebate_record_repo.go
│   │   └── anti_arbitrage_rule_repo.go
│   ├── service/
│   │   ├── rebate_rule_service.go
│   │   ├── rebate_record_service.go
│   │   └── anti_arbitrage_service.go
│   └── handler/
│       ├── rebate_rule_handler.go
│       ├── rebate_record_handler.go
│       └── anti_arbitrage_handler.go

apps/web-admin/
├── src/
│   ├── pages/
│   │   ├── Settings/
│   │   │   └── RebateRulePage.tsx      # 返佣规则设置页
│   │   └── Rebates/
│   │       ├── RebateStatsPage.tsx     # 返佣数据统计页
│   │       └── RebateAuditPage.tsx     # 返佣审核页
│   └── services/
│       └── api.ts                      # 新增返佣相关 API client
├── package.json
└── vite.config.ts
```

**Structure Decision**: 使用现有的 monorepo 结构。后端返佣功能放在 `apps/api`（Go），前端返佣管理页面放在 `apps/web-admin`（React）。

## Complexity Tracking

> No constitution violations. No complexity justifications needed.
