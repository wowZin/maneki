# Tasks: 用户管理增强 - 等级、准确率与 Agent 数据

**Input**: Design documents from `/specs/005-user-tier-accuracy/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are not explicitly requested in the feature specification; no test tasks are included.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Database & Model)

**Purpose**: Add the shared `board_accuracy` field to the database and models so both user stories can use it.

- [x] T001 Add `board_accuracy` column to `users` table via migration in `apps/api/migrations/`
- [x] T002 Update `User` model in `apps/api/internal/model/user.go` to add `BoardAccuracy *float64` field
- [x] T003 [P] Update `UserResponse` struct in `apps/api/internal/handler/user.go` to include `vip_level_label` and `board_accuracy`
- [x] T004 [P] Update `User` interface and `userApi.list` params in `apps/web-admin/src/api/user.ts` to add new fields and query params

**Checkpoint**: `board_accuracy` field exists in DB, model, and API types.

---

## Phase 2: Foundational (Query Infrastructure)

**Purpose**: Extend repository layer so both user stories can query with the new filters and sorting.

- [x] T005 [P] Extend `SearchWithFilters` in `apps/api/internal/repository/user.go` to support `vipLevels []int` multi-select filter
- [x] T006 [P] Extend `SearchWithFilters` in `apps/api/internal/repository/user.go` to support `sortBy` and `sortOrder` dynamic ordering
- [x] T007 Update `ListUsers` signature in `apps/api/internal/service/user.go` to accept `vipLevels`, `sortBy`, `sortOrder` and pass to repository

**Checkpoint**: Repository and service layers support multi-level filtering and accuracy-based sorting.

---

## Phase 3: User Story 1 - 管理员按等级查询并查看准确率排名 (Priority: P1) 🎯 MVP

**Goal**: 用户管理列表展示等级与打板准确率，支持按等级多选筛选和按准确率降序排名。

**Independent Test**: 管理员登录后台 → 进入用户管理 → 选择 VIP 等级筛选 → 列表仅展示 VIP 用户 → 点击按准确率排名 → 列表按准确率从高到低排列 → 筛选与排序可组合使用。

### Backend for User Story 1

- [x] T008 [US1] Update `ListUsersRequest` in `apps/api/internal/handler/user.go` to add `vip_levels`, `sort_by`, `sort_order` query bindings
- [x] T009 [US1] Update `ListUsers` handler in `apps/api/internal/handler/user.go` to parse new params, build `vip_level_label`, and return `board_accuracy`

### Frontend for User Story 1

- [x] T010 [P] [US1] Update `UserListPage` table columns in `apps/web-admin/src/pages/UserManagement/UserListPage.tsx` to show "等级" and "打板准确率"
- [x] T011 [P] [US1] Add VIP 等级多选筛选器 (Ant Design `Select mode="multiple"`) to `UserListPage` top filter bar
- [x] T012 [US1] Add "按准确率排名" sort toggle to `UserListPage` that toggles `sort_by=accuracy` and refreshes the list
- [x] T013 [US1] Handle `board_accuracy` null display (show "--") and ensure nulls sort to the end when ranking

**Checkpoint**: User Story 1 is fully functional. Admin can filter by level and sort by accuracy independently.

---

## Phase 4: User Story 2 - 管理员查看用户详情与 Agent 数据 (Priority: P2)

**Goal**: 用户详情页除基本信息外，展示该用户关联的 Agent 订阅与权重数据。

**Independent Test**: 管理员在用户列表点击"查看详情" → 详情页加载成功 → 基本信息区域展示等级、打板准确率 → Agent 数据区域展示该用户所有订阅 Agent 的名称、订阅状态、权重、评分等 → 无 Agent 时展示空状态提示。

### Backend for User Story 2

- [x] T014 [P] [US2] Create `GetUserWithAgents` service method in `apps/api/internal/service/user.go` (or extend `GetUser`) to aggregate: subscriptions from `agent_subscriptions`, weights from `agent_weights`, and agent info from `agents`
- [x] T015 [P] [US2] Define `UserAgentItem` response struct in `apps/api/internal/handler/user.go`
- [x] T016 [US2] Update `GetUser` handler in `apps/api/internal/handler/user.go` to return agent data array in the response

### Frontend for User Story 2

- [x] T017 [P] [US2] Update `User` detail type in `apps/web-admin/src/api/user.ts` to include `agents` field with `AdminUserAgentItem[]`
- [x] T018 [P] [US2] Update `UserDetailPage` basic info `Descriptions` in `apps/web-admin/src/pages/UserManagement/UserDetailPage.tsx` to add "等级" and "打板准确率" rows
- [x] T019 [US2] Add Agent 数据展示 section (Ant Design `Table` or `Card` list) to `UserDetailPage` showing: Agent 名称、类型、订阅状态、权重、评分、使用次数
- [x] T020 [US2] Add empty state for Agent data section when user has no associated agents in `UserDetailPage`

**Checkpoint**: User Stories 1 and 2 both work independently. Detail page shows accurate agent data.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Performance, edge cases, and code quality.

- [x] T021 [P] Add database index on `users(board_accuracy)` for large datasets (optional, in migration)
- [x] T022 [P] Run `pnpm type-check` in `apps/web-admin` and fix any TypeScript errors
- [x] T023 [P] Run `go build ./...` in `apps/api` and fix any compilation errors
- [x] T024 Validate quickstart.md scenarios manually: filter by level, sort by accuracy, view detail with agents, empty agent state

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — can start immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1 (model must exist before queries).
- **Phase 3 (US1)**: Depends on Phase 2 (repository query methods must exist).
- **Phase 4 (US2)**: Depends on Phase 2 (repository can query users). Can run in parallel with Phase 3 if team capacity allows.
- **Phase 5 (Polish)**: Depends on Phase 3 and Phase 4 completion.

### User Story Dependencies

- **User Story 1 (P1)**: Depends on Phase 2. No dependency on US2.
- **User Story 2 (P2)**: Depends on Phase 2. No dependency on US1 (detail page is independent).

### Within Each User Story

- Backend models/services before handlers
- Backend API before frontend pages
- Core display before polish/edge cases

### Parallel Opportunities

- All Phase 1 tasks marked [P] can run in parallel (different files).
- All Phase 2 tasks marked [P] can run in parallel.
- Once Phase 2 completes, US1 and US2 can be developed in parallel.
- Within US1: T010 and T011 can run in parallel (both modify `UserListPage` but different concerns).
- Within US2: T017, T018, and T019 can run in parallel (different files).

---

## Parallel Example: User Story 1

```bash
# Launch backend handler update and frontend column/filter updates together:
Task: "T009 Update ListUsers handler in apps/api/internal/handler/user.go"
Task: "T010 Update UserListPage table columns in apps/web-admin/src/pages/UserManagement/UserListPage.tsx"
Task: "T011 Add VIP level multi-select filter to UserListPage"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (DB migration + model update)
2. Complete Phase 2: Foundational (repository query extensions)
3. Complete Phase 3: User Story 1 (list filter + accuracy sort)
4. **STOP and VALIDATE**: Test list filtering and sorting independently
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Phase 1 + Phase 2 together
2. Once Foundational is done:
   - Developer A: User Story 1 (backend + frontend list)
   - Developer B: User Story 2 (backend detail aggregation + frontend detail page)
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
