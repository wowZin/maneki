# Tasks: 首页概览数据看板

**Input**: Design documents from `/specs/010-homepage-overview/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/api-contracts.md, research.md, quickstart.md

**Tests**: Not explicitly requested in the feature specification. Test tasks are omitted.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare directory structure and skeleton files for the feature

- [x] T001 [P] Create Dashboard subdirectories `apps/web/src/pages/Dashboard/components/` and `apps/web/src/pages/Dashboard/hooks/`
- [x] T002 [P] Create overview API service skeleton `apps/web/src/services/overview.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema, repository layer, and handler/service skeletons that MUST be complete before user story implementations

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 [P] Create overview models (UserStockTracking, AgentPerformanceSnapshot, HotStock) in `apps/api/internal/model/overview.go`
- [x] T004 [P] Update AutoMigrate in `apps/api/cmd/main.go` to register new overview models
- [x] T005 [P] Create OverviewRepository with base query methods in `apps/api/internal/repository/overview.go`
- [x] T006 Create OverviewService skeleton in `apps/api/internal/service/overview.go`
- [x] T007 Create OverviewHandler skeleton in `apps/api/internal/handler/overview.go`
- [x] T008 Register overview routes (`/overview/*`) in `apps/api/cmd/main.go`

**Checkpoint**: Foundation ready — new tables exist, handler/service/repo skeletons wired, routes registered. User story implementation can now begin in parallel.

---

## Phase 3: User Story 1 — 查看打板预测正确率趋势 (Priority: P1) 🎯 MVP

**Goal**: 用户在首页看到打板预测正确率的趋势图表，支持多时间维度切换

**Independent Test**: 访问 `/api/v1/overview/accuracy-trend?period=7d` 返回正确率趋势数组；前端 Dashboard 展示 ECharts 折线图，切换维度后图表更新

### Implementation for User Story 1

- [x] T009 [P] [US1] Implement accuracy trend aggregation query in `apps/api/internal/repository/overview.go`
- [x] T010 [US1] Implement GetAccuracyTrend service method in `apps/api/internal/service/overview.go` (depends on T009)
- [x] T011 [US1] Implement GET `/overview/accuracy-trend` endpoint in `apps/api/internal/handler/overview.go` (depends on T010)
- [x] T012 [P] [US1] Add `getAccuracyTrend` API method to `apps/web/src/services/overview.ts`
- [x] T013 [P] [US1] Create AccuracyTrendChart component in `apps/web/src/pages/Dashboard/components/AccuracyTrendChart.tsx` (depends on T012)
- [x] T014 [US1] Integrate AccuracyTrendChart into `apps/web/src/pages/Dashboard/index.tsx` with period switcher (depends on T013)

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 — 查看用户选中涨停股票趋势及明细 (Priority: P1)

**Goal**: 已登录用户在首页看到自己选中涨停股票的趋势统计，点击可查看每日明细列表

**Independent Test**: 登录后访问 `/api/v1/overview/user-tracking-trend` 返回个人趋势；点击日期或"查看明细"弹出列表弹窗，展示股票代码、名称、命中状态

### Implementation for User Story 2

- [x] T015 [P] [US2] Implement user tracking trend query in `apps/api/internal/repository/overview.go`
- [x] T016 [P] [US2] Implement user tracking detail (paginated) query in `apps/api/internal/repository/overview.go`
- [x] T017 [US2] Implement user tracking service methods in `apps/api/internal/service/overview.go` (depends on T015, T016)
- [x] T018 [US2] Implement GET `/overview/user-tracking-trend` endpoint in `apps/api/internal/handler/overview.go` (depends on T017)
- [x] T019 [US2] Implement GET `/overview/user-tracking-detail` endpoint in `apps/api/internal/handler/overview.go` (depends on T017)
- [x] T020 [P] [US2] Add user tracking APIs to `apps/web/src/services/overview.ts`
- [x] T021 [P] [US2] Create UserTrackingCard component in `apps/web/src/pages/Dashboard/components/UserTrackingCard.tsx` (depends on T020)
- [x] T022 [P] [US2] Create UserTrackingDetailModal component in `apps/web/src/pages/Dashboard/components/UserTrackingDetailModal.tsx` (depends on T020)
- [x] T023 [US2] Integrate UserTrackingCard and modal into `apps/web/src/pages/Dashboard/index.tsx` (depends on T021, T022)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 — 对比各Agent命中率 (Priority: P2)

**Goal**: 用户在首页看到各预测Agent的命中率对比，支持排序和查看详情

**Independent Test**: 访问 `/api/v1/overview/agent-performance?period=7d` 返回各Agent命中率排名；前端展示表格，按命中率排序

### Implementation for User Story 3

- [x] T024 [P] [US3] Implement agent performance query (joining agents + agent_decisions + signals) in `apps/api/internal/repository/overview.go`
- [x] T025 [US3] Implement GetAgentPerformance service method in `apps/api/internal/service/overview.go` (depends on T024)
- [x] T026 [US3] Implement GET `/overview/agent-performance` endpoint in `apps/api/internal/handler/overview.go` (depends on T025)
- [x] T027 [P] [US3] Add `getAgentPerformance` API method to `apps/web/src/services/overview.ts`
- [x] T028 [P] [US3] Create AgentPerformanceTable component in `apps/web/src/pages/Dashboard/components/AgentPerformanceTable.tsx` (depends on T027)
- [x] T029 [US3] Integrate AgentPerformanceTable into `apps/web/src/pages/Dashboard/index.tsx` (depends on T028)

**Checkpoint**: User Story 3 independently functional

---

## Phase 6: User Story 4 — 浏览热门股票 (Priority: P2)

**Goal**: 用户在首页看到按热度排序的热门股票列表

**Independent Test**: 访问 `/api/v1/overview/hot-stocks?limit=20` 返回热度排序的股票列表；前端展示含排名、涨跌幅、成交量的列表

### Implementation for User Story 4

- [x] T030 [P] [US4] Implement hot stocks query in `apps/api/internal/repository/overview.go`
- [x] T031 [US4] Implement GetHotStocks service method in `apps/api/internal/service/overview.go` (depends on T030)
- [x] T032 [US4] Implement GET `/overview/hot-stocks` endpoint in `apps/api/internal/handler/overview.go` (depends on T031)
- [x] T033 [P] [US4] Add `getHotStocks` API method to `apps/web/src/services/overview.ts`
- [x] T034 [P] [US4] Create HotStocksList component in `apps/web/src/pages/Dashboard/components/HotStocksList.tsx` (depends on T033)
- [x] T035 [US4] Integrate HotStocksList into `apps/web/src/pages/Dashboard/index.tsx` (depends on T034)

**Checkpoint**: User Story 4 independently functional

---

## Phase 7: User Story 5 — 接收实时信号 (Priority: P2)

**Goal**: 用户在首页看到最新的实时交易信号流，新信号有视觉标记

**Independent Test**: 访问 `/api/v1/overview/realtime-signals?limit=10` 返回最新信号列表；前端展示信号类型、股票、时间戳，新信号带高亮/未读标识

### Implementation for User Story 5

- [x] T036 [P] [US5] Implement realtime signals query in `apps/api/internal/repository/overview.go`
- [x] T037 [US5] Implement GetRealtimeSignals service method in `apps/api/internal/service/overview.go` (depends on T036)
- [x] T038 [US5] Implement GET `/overview/realtime-signals` endpoint in `apps/api/internal/handler/overview.go` (depends on T037)
- [x] T039 [P] [US5] Add `getRealtimeSignals` API method to `apps/web/src/services/overview.ts`
- [x] T040 [P] [US5] Create RealtimeSignals component in `apps/web/src/pages/Dashboard/components/RealtimeSignals.tsx` (depends on T039)
- [x] T041 [US5] Integrate RealtimeSignals into `apps/web/src/pages/Dashboard/index.tsx` with auto-refresh (depends on T040)

**Checkpoint**: All 5 user stories independently functional

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T042 [P] Create `useOverviewData` hook in `apps/web/src/pages/Dashboard/hooks/useOverviewData.ts` to consolidate data fetching
- [x] T043 [P] Add loading skeletons, empty states, and error fallbacks to all Dashboard components (`AccuracyTrendChart`, `UserTrackingCard`, `AgentPerformanceTable`, `HotStocksList`, `RealtimeSignals`)
- [x] T044 Add data `updated_at` timestamps and refresh indicators to Dashboard page `apps/web/src/pages/Dashboard/index.tsx`
- [x] T045 [P] Implement Redis caching for overview endpoints in `apps/api/internal/service/overview.go` (hot stocks, agent performance, accuracy trend)
- [x] T046 Add background snapshot scheduler in `apps/api/internal/scheduler/` to pre-compute `agent_performance_snapshots` and `hot_stocks`
- [x] T047 Validate all endpoints against `contracts/api-contracts.md` using `quickstart.md` steps
- [x] T048 [P] Update `apps/web/src/App.tsx` to ensure Dashboard route loads correctly with new layout

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phase 3–7)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (US1 → US2 → US3 → US4 → US5)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

| Story | Priority | Depends On | Notes |
|-------|----------|-----------|-------|
| US1 — 正确率趋势 | P1 | Phase 2 | 仅依赖现有 `signals` 表，无其他故事依赖 |
| US2 — 用户追踪 | P1 | Phase 2 | 依赖 `user_stock_trackings` 表（Foundational 已创建） |
| US3 — Agent 命中率 | P2 | Phase 2 | 依赖 `agents` + `agent_decisions`（现有）+ 可选快照表 |
| US4 — 热门股票 | P2 | Phase 2 | 依赖 `hot_stocks` 表（Foundational 已创建） |
| US5 — 实时信号 | P2 | Phase 2 | 仅依赖现有 `signals` 表，无其他故事依赖 |

**所有用户故事互相独立**，完成 Foundational 后即可并行开发。

### Within Each User Story

- Repository query methods before service methods
- Service methods before handler endpoints
- Frontend API methods before frontend components
- Components before Dashboard page integration

### Parallel Opportunities

- **Phase 1**: All setup tasks marked [P] can run in parallel
- **Phase 2**: Model creation (T003), migration update (T004), repository skeleton (T005) can run in parallel; service (T006) and handler (T007) can run in parallel after T005; route registration (T008) after T007
- **Across User Stories**: Once Foundational is done, all 5 user stories can be developed in parallel by different developers
- **Within Each Story**: Backend repository/service can be developed in parallel with frontend API/component (since contracts are already defined)
- **Frontend components** across different stories can be developed in parallel (they are independent files)

---

## Parallel Example: User Story 1

```bash
# Backend track (sequential within track):
Task: "Implement accuracy trend aggregation query in apps/api/internal/repository/overview.go"
Task: "Implement GetAccuracyTrend service method in apps/api/internal/service/overview.go"
Task: "Implement GET /overview/accuracy-trend endpoint in apps/api/internal/handler/overview.go"

# Frontend track (sequential within track, parallel with backend):
Task: "Add getAccuracyTrend API method to apps/web/src/services/overview.ts"
Task: "Create AccuracyTrendChart component in apps/web/src/pages/Dashboard/components/AccuracyTrendChart.tsx"
Task: "Integrate AccuracyTrendChart into apps/web/src/pages/Dashboard/index.tsx"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 (正确率趋势)
4. Complete Phase 4: User Story 2 (用户追踪)
5. **STOP and VALIDATE**: Test US1 + US2 independently via quickstart.md
6. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Add User Story 4 → Test independently → Deploy/Demo
6. Add User Story 5 → Test independently → Deploy/Demo
7. Run Polish phase → Final validation

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 + User Story 2 (P1 stories)
   - Developer B: User Story 3 + User Story 4 (P2 stories)
   - Developer C: User Story 5 + Polish (P2 + cross-cutting)
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
