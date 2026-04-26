# Tasks: Agent Backtest

**Input**: Design documents from `/specs/014-agent-backtest/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Not explicitly requested. Test tasks omitted.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Minimal setup — the monorepo already exists with Go backend and React frontend.

- [x] T001 Verify existing project structure is ready for feature development (apps/api, apps/web)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database models and scheduler infrastructure required before any user story can be implemented.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T002 Create `BacktestJob`, `BacktestResult`, `BacktestDayResult` models in `apps/api/internal/model/backtest.go`
- [x] T003 Register backtest models in GORM AutoMigrate in `apps/api/cmd/main.go`
- [x] T004 Create `BacktestRepository` in `apps/api/internal/repository/backtest.go` with CRUD for jobs and results
- [x] T005 Create `BacktestService` skeleton in `apps/api/internal/service/backtest.go`
- [x] T006 Create `BacktestScheduler` in `apps/api/internal/scheduler/backtest.go` with worker loop to poll pending jobs
- [x] T007 Register `BacktestScheduler` in `apps/api/cmd/main.go`

**Checkpoint**: Database schema ready, scheduler running, repository and service skeletons in place.

---

## Phase 3: User Story 1 — Trigger Backtest from Agent Management (Priority: P1) 🎯 MVP

**Goal**: VIP users see a backtest button on the agent management page for their subscribed agents. Clicking it navigates to the backtest page with the agent pre-selected.

**Independent Test**: Log in as VIP, subscribe to an agent, navigate to agent management, verify backtest button is visible and clickable. Log in as non-VIP, verify button is hidden.

### Implementation for User Story 1

- [x] T008 [US1] Add VIP middleware `VIPAuthMiddleware` in `apps/api/internal/middleware/vip.go`
- [x] T009 [US1] Create `BacktestHandler` in `apps/api/internal/handler/backtest.go` with skeleton
- [x] T010 [US1] Add `GET /backtests` endpoint in `apps/api/internal/handler/backtest.go` — list user's backtest history
- [x] T011 [P] [US1] Create `backtest.ts` API service in `apps/web/src/services/backtest.ts` with type definitions
- [x] T012 [P] [US1] Add backtest button to agent management UI in `apps/web/src/pages/Marketplace/` or relevant agent page
- [x] T013 [US1] Update `/replay` route in `apps/web/src/App.tsx` to render `Backtest` page
- [x] T014 [US1] Create `BacktestForm` component in `apps/web/src/pages/Backtest/BacktestForm.tsx` with date range picker (max 14 days)

**Checkpoint**: User Story 1 is fully functional. VIP users can discover and initiate backtests from agent management.

---

## Phase 4: User Story 2 — Configure and Run Backtest (Priority: P1)

**Goal**: VIP users can configure backtest parameters (agent, date range up to 14 days) and enqueue an async backtest job. The system validates VIP status, active subscription, and date range constraints.

**Independent Test**: On the backtest page, select a date range, click "开始回测". Verify job is created with status `pending`. Try selecting >14 days — verify rejection. Try as non-VIP — verify rejection.

### Implementation for User Story 2

- [x] T015 [US2] Implement `CreateBacktest` in `apps/api/internal/service/backtest.go` — validates VIP, subscription, date range, enqueues job
- [x] T016 [US2] Add `POST /backtests` endpoint in `apps/api/internal/handler/backtest.go` with validation
- [x] T017 [US2] Add `createBacktest` method to `backtest.ts` in `apps/web/src/services/backtest.ts`
- [x] T018 [US2] Wire `BacktestForm` submission to API in `apps/web/src/pages/Backtest/BacktestForm.tsx`

**Checkpoint**: User Story 2 is fully functional. Backtest jobs can be created with proper validation.

---

## Phase 5: User Story 3 — View Backtest Progress (Priority: P2)

**Goal**: Users see real-time progress updates while a backtest is running, with friendly status messages. The UI handles pending, running, completed, and failed states.

**Independent Test**: Start a backtest. Verify progress bar updates. Let it complete. Verify auto-transition to results. Start a backtest and simulate failure — verify error state with retry.

### Implementation for User Story 3

- [x] T019 [US3] Implement backtest worker logic in `apps/api/internal/scheduler/backtest.go` — processes pending jobs, updates progress
- [x] T020 [US3] Add `GET /backtests/:id` endpoint in `apps/api/internal/handler/backtest.go` — returns job status + result
- [x] T021 [US3] Add `GET /backtests/:id/progress` lightweight endpoint in `apps/api/internal/handler/backtest.go`
- [x] T022 [US3] Add `getBacktest` and `getBacktestProgress` methods to `backtest.ts` in `apps/web/src/services/backtest.ts`
- [x] T023 [US3] Create `BacktestProgress` component in `apps/web/src/pages/Backtest/BacktestProgress.tsx` — progress bar, status messages, error/retry UI
- [x] T024 [US3] Integrate progress polling (every 3s) into `apps/web/src/pages/Backtest/index.tsx`

**Checkpoint**: User Story 3 is fully functional. Progress visibility works end-to-end.

---

## Phase 6: User Story 4 — View Backtest Results by Day (Priority: P2)

**Goal**: Users view completed backtest results broken down by day, with per-day metrics and expandable prediction details.

**Independent Test**: Complete a backtest. Verify day-by-day cards show date, total predictions, hit count, miss count, hit rate. Expand a day to see individual stock predictions.

### Implementation for User Story 4

- [x] T025 [US4] Implement result persistence in `apps/api/internal/service/backtest.go` — stores `BacktestResult` and `BacktestDayResult` records after worker completes
- [x] T026 [US4] Add result hydration to `GET /backtests/:id` in `apps/api/internal/handler/backtest.go`
- [x] T027 [US4] Create `BacktestResult` component in `apps/web/src/pages/Backtest/BacktestResult.tsx` — overall summary + day-by-day breakdown
- [x] T028 [US4] Create day detail sub-component in `apps/web/src/pages/Backtest/BacktestResult.tsx` or separate file — expandable stock prediction list
- [x] T029 [US4] Integrate `BacktestResult` into `apps/web/src/pages/Backtest/index.tsx`

**Checkpoint**: All user stories are independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: UI/UX polish, VIP enforcement, history view, and validation.

- [x] T030 [P] Add VIP-only guard to backtest page — redirect non-VIP users with upgrade prompt in `apps/web/src/pages/Backtest/index.tsx`
- [x] T031 [P] Add backtest history list to `apps/web/src/pages/Backtest/index.tsx` — previous runs per agent
- [x] T032 Add responsive layout to `apps/web/src/pages/Backtest/index.tsx`
- [x] T033 Add loading skeletons and empty states to all Backtest components
- [x] T034 Verify concurrent job protection — one running backtest per agent per user
- [x] T035 Run quickstart.md validation: create job → watch progress → view results → verify history

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phase 3–6)**: All depend on Foundational phase completion
  - Sequential in priority order recommended (P1 → P2) due to single-developer context
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2). No dependencies on other stories. **MVP**.
- **User Story 2 (P1)**: Can start after US1 (shares `BacktestForm`). Can also start in parallel if form is stubbed.
- **User Story 3 (P2)**: Can start after US2 (needs job creation to test progress). Backend worker can be developed in parallel with US2 frontend.
- **User Story 4 (P2)**: Can start after US3 (needs completed jobs to display results). Backend result persistence can be developed in parallel with US3.

### Within Each User Story

- Backend: Repository → Service → Handler (sequential)
- Frontend: Service → Component → Integration (sequential)
- Backend and frontend within the same story can run in parallel after foundational model is ready

### Parallel Opportunities

- T008, T009, T011 can run in parallel (middleware + handler skeleton + frontend service)
- T012, T013, T014 can run in parallel (agent page button + route + form component)
- T020, T021 can run in parallel (different endpoints)
- T027, T028 can run in parallel (result component + day detail)
- T030, T031 can run in parallel (VIP guard + history list)

---

## Parallel Example: User Story 2

```bash
# After T005 (service skeleton) and T004 (repository) are complete:
Task: "Implement CreateBacktest in apps/api/internal/service/backtest.go"
Task: "Create backtest.ts API service in apps/web/src/services/backtest.ts"

# After T016 and T017 are complete:
Task: "Wire BacktestForm submission to API in apps/web/src/pages/Backtest/BacktestForm.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 + 2)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 (entry point + form)
4. Complete Phase 4: User Story 2 (job creation + validation)
5. **STOP and VALIDATE**: VIP user can click backtest button, configure dates, and create a job
6. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test job creation → Deploy/Demo
4. Add User Story 3 → Test progress polling → Deploy/Demo
5. Add User Story 4 → Test results display → Deploy/Demo
6. Complete Phase 7: Polish → Final validation

### Single-Developer Strategy

Recommended sequential order:

1. T001 → T002 → T003 → T004 → T005 → T006 → T007 (foundation)
2. T008 → T009 → T010 → T011 → T012 → T013 → T014 (US1)
3. Validate US1 end-to-end
4. T015 → T016 → T017 → T018 (US2)
5. Validate US2 end-to-end
6. T019 → T020 → T021 → T022 → T023 → T024 (US3)
7. Validate US3 end-to-end
8. T025 → T026 → T027 → T028 → T029 (US4)
9. Validate US4 end-to-end
10. T030 → T031 → T032 → T033 → T034 → T035 (polish)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
