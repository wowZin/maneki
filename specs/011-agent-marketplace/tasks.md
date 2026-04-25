# Tasks: Agent Marketplace

**Input**: Design documents from `/specs/011-agent-marketplace/`
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

- [x] T001 [P] Create Marketplace page directories `apps/web/src/pages/Marketplace/components/`, `apps/web/src/pages/AgentDetail/`, and `apps/web/src/pages/AgentCreate/`
- [x] T002 [P] Create marketplace API service skeleton `apps/web/src/services/marketplace.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend middleware, repository extensions, service/handler skeletons, and route registration that MUST be complete before user story implementations

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 [P] Add `SVIPAuthMiddleware` in `apps/api/internal/middleware/auth.go` to check `vip_level >= 2`
- [x] T004 [P] Extend `AgentRepository` in `apps/api/internal/repository/agent.go` with `ListWithSorting` (supports sort_by accuracy/use_count/rating/created_at + type/category filters) and `GetByIDWithOwner` (join users table for author name/avatar)
- [x] T005 [P] Extend `AgentSubscriptionRepository` in `apps/api/internal/repository/agent.go` with `GetUserSubscription(userID, agentID)` and `CheckExistingSubscription(userID, agentID)` methods
- [x] T006 Create `MarketplaceService` skeleton in `apps/api/internal/service/marketplace.go` with `GetMarketplaceList`, `GetAgentDetail`, `SubscribeAgent`, `GetMySubscriptions`, `CreateAgent` method signatures
- [x] T007 Extend `AgentHandler` in `apps/api/internal/handler/agent.go` with marketplace endpoint skeletons: `GetMarketplaceAgents`, `GetMarketplaceAgentDetail`, `SubscribeAgent`, `GetMySubscriptions`, `CreateMarketplaceAgent`
- [x] T008 Register marketplace routes (`/marketplace/*`) in `apps/api/cmd/main.go` under public and authenticated groups

**Checkpoint**: Foundation ready — middleware, repo queries, service/handler skeletons wired, routes registered. User story implementation can now begin in parallel.

---

## Phase 3: User Story 1 — Browse Agent Marketplace & Ranking (Priority: P1) 🎯 MVP

**Goal**: 用户在 marketplace 页面看到排名列表，支持排序筛选，点击可查看 Agent 详情

**Independent Test**: 访问 `/api/v1/marketplace/agents?sort_by=accuracy` 返回带准确率的 Agent 列表；前端 `/marketplace` 展示卡片列表，切换排序/筛选后列表更新；点击卡片进入 `/marketplace/agents/:id` 详情页

### Implementation for User Story 1

- [x] T009 [P] [US1] Implement `ListWithSorting` aggregation query with accuracy join in `apps/api/internal/repository/agent.go`
- [x] T010 [US1] Implement `GetMarketplaceList` service method in `apps/api/internal/service/marketplace.go` (depends on T009)
- [x] T011 [US1] Implement `GetMarketplaceAgents` endpoint (GET `/marketplace/agents`) in `apps/api/internal/handler/agent.go` (depends on T010)
- [x] T012 [P] [US1] Implement `GetByIDWithOwner` with accuracy lookup in `apps/api/internal/repository/agent.go`
- [x] T013 [US1] Implement `GetAgentDetail` service method in `apps/api/internal/service/marketplace.go` (depends on T012)
- [x] T014 [US1] Implement `GetMarketplaceAgentDetail` endpoint (GET `/marketplace/agents/:id`) in `apps/api/internal/handler/agent.go` (depends on T013)
- [x] T015 [P] [US1] Add `getMarketplaceAgents` and `getAgentDetail` API methods to `apps/web/src/services/marketplace.ts`
- [x] T016 [P] [US1] Create `AgentCard` component in `apps/web/src/pages/Marketplace/components/AgentCard.tsx` (depends on T015)
- [x] T017 [P] [US1] Create `AgentFilters` component in `apps/web/src/pages/Marketplace/components/AgentFilters.tsx`
- [x] T018 [P] [US1] Create `SortSelector` component in `apps/web/src/pages/Marketplace/components/SortSelector.tsx`
- [x] T019 [US1] Create `Marketplace` page in `apps/web/src/pages/Marketplace/index.tsx` with list, filters, and sorting (depends on T016, T017, T018)
- [x] T020 [US1] Create `AgentDetail` page in `apps/web/src/pages/AgentDetail/index.tsx` with full info display (depends on T015)
- [x] T021 [US1] Integrate marketplace routes into `apps/web/src/App.tsx` and sidebar menu into `apps/web/src/components/Layout/index.tsx` (depends on T019, T020)

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 — VIP Free Subscription (Priority: P1)

**Goal**: VIP 及以上用户可免费订阅 Agent，查看自己的订阅列表

**Independent Test**: VIP 用户登录后访问 Agent 详情页点击"免费订阅"，调用 `/api/v1/marketplace/agents/:id/subscribe` 返回成功；访问 `/api/v1/marketplace/my-subscriptions` 返回已订阅列表；非 VIP 用户看到付费提示

### Implementation for User Story 2

- [x] T022 [P] [US2] Implement subscription creation query in `apps/api/internal/repository/agent.go` (AgentSubscriptionRepository.CreateSubscription)
- [x] T023 [US2] Implement `SubscribeAgent` service method in `apps/api/internal/service/marketplace.go` with VIP check and zero-price logic (depends on T022)
- [x] T024 [US2] Implement `SubscribeAgent` endpoint (POST `/marketplace/agents/:id/subscribe`) in `apps/api/internal/handler/agent.go` (depends on T023)
- [x] T025 [US2] Implement `GetMySubscriptions` service method in `apps/api/internal/service/marketplace.go`
- [x] T026 [US2] Implement `GetMySubscriptions` endpoint (GET `/marketplace/my-subscriptions`) in `apps/api/internal/handler/agent.go` (depends on T025)
- [x] T027 [P] [US2] Add `subscribeAgent` and `getMySubscriptions` API methods to `apps/web/src/services/marketplace.ts`
- [x] T028 [P] [US2] Integrate subscribe button and VIP/free logic into `apps/web/src/pages/AgentDetail/index.tsx` (depends on T027)
- [ ] T029 [P] [US2] Create `MySubscriptions` component in `apps/web/src/pages/Marketplace/components/MySubscriptions.tsx` (depends on T027)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 — Super VIP Creates Agent (Priority: P2)

**Goal**: SVIP 用户在 marketplace 页面看到"创建 Agent"按钮，进入表单创建并发布 Agent

**Independent Test**: SVIP 用户登录后 marketplace 页面显示"创建 Agent"按钮；点击进入 `/marketplace/agents/create` 表单；填写保存后调用 `/api/v1/marketplace/agents` 创建成功；新 Agent 出现在市场列表中。非 SVIP 用户看不到按钮，直接访问 URL 返回 403

### Implementation for User Story 3

- [x] T030 [US3] Implement `CreateMarketplaceAgent` service method in `apps/api/internal/service/marketplace.go` with SVIP validation and name uniqueness check
- [x] T031 [US3] Implement `CreateMarketplaceAgent` endpoint (POST `/marketplace/agents`) in `apps/api/internal/handler/agent.go` with `SVIPAuthMiddleware` (depends on T030)
- [x] T032 [P] [US3] Add `createAgent` API method to `apps/web/src/services/marketplace.ts`
- [x] T033 [P] [US3] Create `AgentCreate` page in `apps/web/src/pages/AgentCreate/index.tsx` with form fields (name, description, type, category, model, prompt with Markdown preview) referencing admin-web design (depends on T032)
- [x] T034 [US3] Integrate "创建 Agent" button into `apps/web/src/pages/Marketplace/index.tsx` conditional on SVIP level (depends on T033)
- [x] T035 [US3] Add route guard for `/marketplace/agents/create` in `apps/web/src/App.tsx` redirecting non-SVIP users

**Checkpoint**: All 3 user stories independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T036 [P] Add loading skeletons and empty states to `Marketplace`, `AgentDetail`, and `AgentCreate` pages
- [x] T037 [P] Add error handling and Ant Design `message` notifications for all API calls in marketplace pages
- [x] T038 [P] Add responsive layout adjustments for marketplace cards and detail page
- [ ] T039 Validate all endpoints against `contracts/api-contracts.md` using `quickstart.md` steps
- [x] T040 [P] Update `apps/web/src/services/index.ts` (if exists) to export marketplace service

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phase 3–5)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (US1 → US2 → US3)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

| Story | Priority | Depends On | Notes |
|-------|----------|-----------|-------|
| US1 — 浏览市场与排名 | P1 | Phase 2 | 核心入口，无其他故事依赖 |
| US2 — VIP 免费订阅 | P1 | Phase 2 | 依赖 US1 的 AgentDetail 页面但可独立测试后端 |
| US3 — SVIP 创建 Agent | P2 | Phase 2 | 依赖 marketplace 存在但可独立测试 |

**所有用户故事互相独立**，完成 Foundational 后即可并行开发。

### Within Each User Story

- Repository query methods before service methods
- Service methods before handler endpoints
- Frontend API methods before frontend components
- Components before page integration
- Page integration before routing/sidebar updates

### Parallel Opportunities

- **Phase 1**: All setup tasks marked [P] can run in parallel
- **Phase 2**: Middleware (T003), repository extensions (T004, T005), service skeleton (T006), handler skeleton (T007) can run in parallel; route registration (T008) after handler skeleton
- **Across User Stories**: Once Foundational is done, all 3 user stories can be developed in parallel
- **Within US1**: Backend repo/service can be developed in parallel with frontend API/components (since contracts are already defined)
- **Frontend components** across different stories can be developed in parallel (they are independent files)

---

## Parallel Example: User Story 1

```bash
# Backend track (sequential within track):
Task: "Implement ListWithSorting aggregation query in apps/api/internal/repository/agent.go"
Task: "Implement GetMarketplaceList service method in apps/api/internal/service/marketplace.go"
Task: "Implement GetMarketplaceAgents endpoint in apps/api/internal/handler/agent.go"
Task: "Implement GetByIDWithOwner with accuracy lookup in apps/api/internal/repository/agent.go"
Task: "Implement GetAgentDetail service method in apps/api/internal/service/marketplace.go"
Task: "Implement GetMarketplaceAgentDetail endpoint in apps/api/internal/handler/agent.go"

# Frontend track (sequential within track, parallel with backend):
Task: "Add getMarketplaceAgents and getAgentDetail API methods to apps/web/src/services/marketplace.ts"
Task: "Create AgentCard component in apps/web/src/pages/Marketplace/components/AgentCard.tsx"
Task: "Create AgentFilters component in apps/web/src/pages/Marketplace/components/AgentFilters.tsx"
Task: "Create SortSelector component in apps/web/src/pages/Marketplace/components/SortSelector.tsx"
Task: "Create Marketplace page in apps/web/src/pages/Marketplace/index.tsx"
Task: "Create AgentDetail page in apps/web/src/pages/AgentDetail/index.tsx"
Task: "Integrate marketplace routes and sidebar menu"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 (浏览市场与排名)
4. Complete Phase 4: User Story 2 (VIP 免费订阅)
5. **STOP and VALIDATE**: Test US1 + US2 independently via quickstart.md
6. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Run Polish phase → Final validation

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (P1 — 核心市场浏览)
   - Developer B: User Story 2 (P1 — 订阅功能)
   - Developer C: User Story 3 (P2 — SVIP 创建)
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
