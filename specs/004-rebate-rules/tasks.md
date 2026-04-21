# Tasks: 系统设置 - 返佣规则模块

**Feature**: 系统设置 - 返佣规则模块
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Data Model**: [data-model.md](./data-model.md)
**Branch**: `004-rebate-rules` | **Date**: 2026-04-19

---

## Dependency Graph

```
Phase 1: Setup
    |
    v
Phase 2: Foundational (Models, Repositories, Calculation Core)
    |       |       |
    v       v       v
Phase 3: US1    Phase 4: US2    Phase 5: US3
(Pricing)      (Anti-Arb)      (Statistics)
    |               |               |
    +---------------+---------------+
                    |
                    v
            Phase 6: Polish
```

**Execution Order**: Phase 1 → Phase 2 → (Phase 3, Phase 4, Phase 5 可部分并行) → Phase 6

**Story Dependencies**:
- Phase 2 (Foundational) 是 Phase 3/4/5 的前置依赖（需要模型、仓库、计算核心）
- US3 (Statistics) 依赖 US1 (Pricing) 和 US2 (Anti-Arbitrage) 产生的数据，但 API 层可并行开发

---

## Phase 1: Setup

**Goal**: 初始化数据库模型注册、目录结构和基础配置。

- [ ] T001 Add rebate models to GORM auto-migration in `apps/api/cmd/main.go` (RebateRule, IncentiveRule, RebateRecord, AntiArbitrageRule, RebateAuditLog)
- [ ] T002 [P] Create rebate service directories if needed (verify `apps/api/internal/{model,repository,service,handler}/` exist)

---

## Phase 2: Foundational

**Goal**: 构建所有用户故事共享的基础组件：数据模型、仓库层、返佣计算核心。

- [ ] T003 Create RebateRule + IncentiveRule model (`apps/api/internal/model/rebate_rule.go`) with GORM struct, validation hooks, interval continuity check
- [ ] T004 [P] Create RebateRecord model (`apps/api/internal/model/rebate_record.go`) with GORM struct and status enum
- [ ] T005 [P] Create AntiArbitrageRule model (`apps/api/internal/model/anti_arbitrage_rule.go`) with GORM struct and strategy_type enum
- [ ] T006 [P] Create RebateAuditLog model (`apps/api/internal/model/rebate_audit_log.go`) with GORM struct
- [ ] T007 Create RebateRule repository (`apps/api/internal/repository/rebate_rule.go`) with CRUD, find active by agent, find active global, overlap check
- [ ] T008 [P] Create RebateRecord repository (`apps/api/internal/repository/rebate_record.go`) with CRUD, list by filters, review update, export query
- [ ] T009 [P] Create AntiArbitrageRule repository (`apps/api/internal/repository/anti_arbitrage_rule.go`) with CRUD, list active by priority
- [ ] T010 [P] Create RebateAuditLog repository (`apps/api/internal/repository/rebate_audit_log.go`) with create, list by record
- [ ] T011 Create RebateCalculator service (`apps/api/internal/service/rebate_calculator.go`) with excess-progressive tier calculation logic

---

## Phase 3: User Story 1 - 管理员配置返佣定价规则

**Story Goal**: 管理员在后台新增、编辑、启用/停用返佣定价规则，支持全局规则和指定 Agent 规则，可关联阶梯激励规则。

**Independent Test**: 管理员在后台新增一条返佣规则（单价 5 元），前端用户完成一次 agent 订阅，验证返佣记录中金额 = 1 * 5 = 5 元。

- [ ] T012 [US1] Create RebateRule service (`apps/api/internal/service/rebate_rule.go`) with CRUD, validation, overlap guard, toggle status
- [ ] T013 [US1] Create RebateRule handler (`apps/api/internal/handler/rebate_rule.go`) with List, Get, Create, Update, Toggle, Delete endpoints
- [ ] T014 [US1] Register rebate rule routes in `apps/api/cmd/main.go` under `/api/v1/admin/rebate-rules`
- [ ] T015 [US1] Create RebateRulePage (`apps/web-admin/src/pages/Rebates/RebateRulePage.tsx`) with table, create/edit drawer, incentive rule editor
- [ ] T016 [US1] Add rebate rule API client functions to `apps/web-admin/src/services/api.ts`
- [ ] T017 [US1] Add `/rebates/rules` route in `apps/web-admin/src/App.tsx` (under 返佣管理 -> 规则设置 menu)

---

## Phase 4: User Story 2 - 管理员配置防套利规则与返佣计算

**Story Goal**: 管理员配置防套利策略；订阅发生时实时计算返佣并同步执行防套利校验；支持人工审核。

**Independent Test**: 模拟同一 IP 地址在短时间内连续订阅 10 次，验证系统根据防套利规则进行拦截或标记，不产生全部返佣金额。

- [ ] T018 [US2] Create AntiArbitrage service (`apps/api/internal/service/anti_arbitrage.go`) with Redis counter logic (ip_freq, new_user_threshold, self_subscribe checks)
- [ ] T019 [US2] Create RebateRecord service (`apps/api/internal/service/rebate_record.go`) with calculate + create + review logic
- [ ] T020 [US2] Create AntiArbitrage handler (`apps/api/internal/handler/anti_arbitrage.go`) with List, Create, Update, Toggle, Delete endpoints
- [ ] T021 [US2] Create RebateRecord handler (`apps/api/internal/handler/rebate_record.go`) with List, Get, Review, Export endpoints + internal Calculate endpoint
- [ ] T022 [US2] Register anti-arbitrage and rebate-record routes in `apps/api/cmd/main.go`
- [ ] T023 [US2] Create AntiArbitrageRulePage (`apps/web-admin/src/pages/Settings/AntiArbitrageRulePage.tsx`) with strategy type selector and params form
- [ ] T024 [US2] Create RebateAuditPage (`apps/web-admin/src/pages/Rebates/RebateAuditPage.tsx`) with reviewing records list, review dialog (normal/arbitrage)
- [ ] T025 [US2] Add anti-arbitrage and audit API client functions to `apps/web-admin/src/services/api.ts`
- [ ] T026 [US2] Add `/settings/anti-arbitrage` and `/rebates/audit` routes in `apps/web-admin/src/App.tsx`

---

## Phase 5: User Story 3 - 管理员查看返佣统计数据

**Story Goal**: 管理员查看返佣统计看板、趋势图表、创作者排名、Agent 统计；支持多维度筛选和 CSV 导出。

**Independent Test**: 产生若干订阅和返佣记录后，管理员进入返佣统计页，验证各维度的汇总数据与明细记录一致。

- [ ] T027 [US3] Create RebateStats service (`apps/api/internal/service/rebate_stats.go`) with dashboard aggregation, trend query, creator ranking, agent stats
- [ ] T028 [US3] Create RebateStats handler (`apps/api/internal/handler/rebate_stats.go`) with dashboard, trend, creators, agents, export endpoints
- [ ] T029 [US3] Register rebate-stats routes in `apps/api/cmd/main.go`
- [ ] T030 [US3] Create RebateStatsPage (`apps/web-admin/src/pages/Rebates/RebateStatsPage.tsx`) with dashboard cards, trend chart, ranking tables
- [ ] T031 [US3] Add rebate stats API client and export functions to `apps/web-admin/src/services/api.ts`
- [ ] T032 [US3] Add `/rebates` route in `apps/web-admin/src/App.tsx` pointing to RebateStatsPage

---

## Phase 6: Polish & Cross-Cutting Concerns

**Goal**: T+1 结算定时任务、退款处理、菜单整合、边界情况处理。

- [ ] T033 Implement T+1 settlement cron job (`apps/api/internal/service/rebate_record.go` or new `apps/api/internal/job/settlement.go`) updating pending→settled
- [ ] T034 Add refund webhook handler in RebateRecord service marking records as `refunded`
- [ ] T035 Add rebate management menu group in `apps/web-admin/src/components/AdminLayout/index.tsx` (返佣数据 + 规则设置)
- [ ] T036 Add `quantity` field to RebateRecord model and calculation if missing (verify spec FR-003)
- [ ] T037 Verify creator disabled scenario: ensure pending rebates for disabled creators are not settled
- [ ] T038 Verify edge case: when no active rule exists for an agent, subscription proceeds but no rebate record is created

---

## Implementation Strategy

**MVP Scope**: Phase 1 + Phase 2 + Phase 3 (User Story 1 only)
- US1 delivers the core pricing capability and is independently testable
- Without US2, all subscriptions produce normal rebates (no anti-arbitrage)
- This allows the subscription→rebate pipeline to be wired end-to-end

**Incremental Delivery**:
1. **Sprint 1**: Phase 1 + Phase 2 + Phase 3 → 返佣定价规则 CRUD + 基础计算 + 前端页面
2. **Sprint 2**: Phase 4 → 防套利规则 + 实时计算 + 审核流程
3. **Sprint 3**: Phase 5 → 统计看板 + 导出功能
4. **Sprint 4**: Phase 6 → T+1 定时任务 + 退款 + 边界处理

**Parallel Opportunities**:
- T003-T006 (models) can be implemented in parallel
- T007-T010 (repositories) can be implemented in parallel after models
- T012 (US1 service) and T018-T019 (US2 services) can be developed in parallel after repositories
- T015 (US1 frontend) and T023-T024 (US2 frontend) can be developed in parallel after API contracts are known
