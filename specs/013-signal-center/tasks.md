# Tasks: Signal Center

**Input**: Design documents from `/specs/013-signal-center/`
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

**Purpose**: Database migration and model updates required before any user story can be implemented.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T002 Add `signal_id` column to `user_stock_trackings` table via migration in `apps/api/migrations/`
- [x] T003 Update `UserStockTracking` model in `apps/api/internal/model/overview.go` to add `SignalID` field
- [x] T004 Register `SignalHandler` router group in `apps/api/cmd/main.go`

**Checkpoint**: Database schema updated, model synced, routing ready.

---

## Phase 3: User Story 1 — View Real-time Signals (Priority: P1) 🎯 MVP

**Goal**: Users can open the Signal Center page and see a real-time list of limit-up stock predictions from the main agent, showing stock name, code, and prediction time. The list auto-refreshes every 15 seconds.

**Independent Test**: Open `/signals` in the browser. Verify signal list displays with stock name, code, confidence, reason, and prediction time. Verify new signals appear automatically within 15 seconds.

### Implementation for User Story 1

- [x] T005 [US1] Create `SignalRepository` in `apps/api/internal/repository/signal.go` with `GetSignals(ctx, afterID, limit)` — filters `signal_type = 'watch'`, joins `stocks` for name
- [x] T006 [US1] Create `SignalService` in `apps/api/internal/service/signal.go` with `GetSignals(ctx, userID, afterID, limit)` — adds `is_followed` flag for authenticated users
- [x] T007 [US1] Create `SignalHandler` in `apps/api/internal/handler/signal.go` with `GET /api/v1/signals` endpoint
- [x] T008 [P] [US1] Create `signal.ts` API service in `apps/web/src/services/signal.ts` with `getSignals(limit, afterId)` type definitions
- [x] T009 [P] [US1] Create `SignalCenter` page in `apps/web/src/pages/SignalCenter/index.tsx` with page layout and polling (15s interval)
- [x] T010 [US1] Create `SignalList` component in `apps/web/src/pages/SignalCenter/SignalList.tsx` — renders signal cards with stock name, code, confidence, reason, prediction time
- [x] T011 [US1] Add `/signals` route in `apps/web/src/App.tsx` and navigation link in main layout

**Checkpoint**: User Story 1 is fully functional. Navigating to `/signals` shows real-time limit-up predictions.

---

## Phase 4: User Story 2 — Follow a Signal (Priority: P2)

**Goal**: Authenticated users can click "Follow" on any signal to track it. The system prevents duplicate follows for the same stock on the same day. Users can also unfollow.

**Independent Test**: Log in, navigate to `/signals`, click "Follow" on a signal. Verify button changes to "Following". Refresh page — state persists. Click "Unfollow" — reverts to "Follow". Try to follow again — should see "今日已关注该股票".

### Implementation for User Story 2

- [x] T012 [US2] Add `FollowSignal` and `UnfollowSignal` methods to `SignalRepository` in `apps/api/internal/repository/signal.go`
- [x] T013 [US2] Add `FollowSignal` and `UnfollowSignal` methods to `SignalService` in `apps/api/internal/service/signal.go` — enforces "one follow per stock per day" rule
- [x] T014 [US2] Add `POST /signals/:id/follow` and `DELETE /signals/:id/follow` endpoints to `SignalHandler` in `apps/api/internal/handler/signal.go`
- [x] T015 [US2] Add `followSignal` and `unfollowSignal` methods to `signal.ts` in `apps/web/src/services/signal.ts`
- [x] T016 [US2] Create `SignalCard` component in `apps/web/src/pages/SignalCenter/SignalCard.tsx` with Follow/Unfollow button and state
- [x] T017 [US2] Integrate `SignalCard` into `SignalList` in `apps/web/src/pages/SignalCenter/SignalList.tsx`

**Checkpoint**: User Story 2 is fully functional. Follow/unfollow works end-to-end with proper duplicate prevention.

---

## Phase 5: User Story 3 — View Personal Hit Rate Statistics (Priority: P2)

**Goal**: Authenticated users can see their personal signal follow statistics (total followed, total hit, hit rate) and a list of today's followed signals with hit status.

**Independent Test**: Log in, follow several signals. View "My Stats" section — verify counts match. After market close (or manual DB update), verify hit rate displays correctly.

### Implementation for User Story 3

- [x] T018 [US3] Add `GetMyFollows` method to `SignalRepository` in `apps/api/internal/repository/signal.go` — returns today's followed signals with signal details and hit_status
- [x] T019 [US3] Add `GetMyStats` method to `SignalRepository` in `apps/api/internal/repository/signal.go` — reuses existing tracking aggregation for a given period
- [x] T020 [US3] Add `GetMyFollows` and `GetMyStats` methods to `SignalService` in `apps/api/internal/service/signal.go`
- [x] T021 [US3] Add `GET /signals/my-follows` and `GET /signals/my-stats` endpoints to `SignalHandler` in `apps/api/internal/handler/signal.go`
- [x] T022 [US3] Add `getMyFollows` and `getMyStats` methods to `signal.ts` in `apps/web/src/services/signal.ts`
- [x] T023 [US3] Create `MyStats` component in `apps/web/src/pages/SignalCenter/MyStats.tsx` — displays total followed, total hit, overall hit rate
- [x] T024 [US3] Create `MyFollows` component in `apps/web/src/pages/SignalCenter/MyFollows.tsx` — displays today's followed signals with hit status badge
- [x] T025 [US3] Integrate `MyStats` and `MyFollows` into `SignalCenter` page in `apps/web/src/pages/SignalCenter/index.tsx`

**Checkpoint**: All user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: UI/UX polish, error handling, and validation.

- [x] T026 [P] Add empty state, loading state, and error state to `SignalList` in `apps/web/src/pages/SignalCenter/SignalList.tsx`
- [x] T027 [P] Add empty state to `MyFollows` in `apps/web/src/pages/SignalCenter/MyFollows.tsx`
- [x] T028 Add responsive layout adjustments to `SignalCenter` page in `apps/web/src/pages/SignalCenter/index.tsx`
- [x] T029 Verify `GET /signals` returns `is_followed=false` for unauthenticated users (no error)
- [x] T030 Run quickstart.md validation: follow signal → unfollow → check stats → verify no console errors

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phase 3–5)**: All depend on Foundational phase completion
  - Sequential in priority order recommended (P1 → P2) due to single-developer context
  - US2 and US3 can proceed in parallel after US1 if team capacity allows
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2). No dependencies on other stories. **MVP**.
- **User Story 2 (P2)**: Can start after US1 is complete (shares `SignalList`/`SignalCard` UI). Can also start in parallel if UI components are stubbed.
- **User Story 3 (P2)**: Can start after US2 is complete (needs follow data to compute stats). Can start in parallel with backend work if using mock data.

### Within Each User Story

- Backend: Repository → Service → Handler (sequential)
- Frontend: Service → Page/Component → Integration (sequential)
- Backend and frontend within the same story can run in parallel after foundational model is ready

### Parallel Opportunities

- T005, T008 can run in parallel (backend repo + frontend service, no mutual dependency)
- T009, T010 can run in parallel after T008 (page layout + list component)
- T012, T018 can run in parallel (different repository methods, no conflict)
- T023, T024 can run in parallel (independent components)
- T026, T027 can run in parallel (independent polish tasks)

---

## Parallel Example: User Story 1

```bash
# After T003 (model update) is complete:
Task: "Create SignalRepository in apps/api/internal/repository/signal.go"
Task: "Create signal.ts API service in apps/web/src/services/signal.ts"

# After T005 and T008 are complete:
Task: "Create SignalService in apps/api/internal/service/signal.go"
Task: "Create SignalCenter page in apps/web/src/pages/SignalCenter/index.tsx"

# After T006 and T009 are complete:
Task: "Create SignalHandler in apps/api/internal/handler/signal.go"
Task: "Create SignalList component in apps/web/src/pages/SignalCenter/SignalList.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 (signal list display)
4. **STOP and VALIDATE**: Open `/signals`, verify real-time predictions appear
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test follow/unfollow → Deploy/Demo
4. Add User Story 3 → Test stats display → Deploy/Demo
5. Complete Phase 6: Polish → Final validation

### Single-Developer Strategy

Recommended sequential order:

1. T001 → T002 → T003 → T004 (foundation)
2. T005 → T006 → T007 (backend US1)
3. T008 → T009 → T010 → T011 (frontend US1)
4. Validate US1 end-to-end
5. T012 → T013 → T014 (backend US2)
6. T015 → T016 → T017 (frontend US2)
7. Validate US2 end-to-end
8. T018 → T019 → T020 → T021 (backend US3)
9. T022 → T023 → T024 → T025 (frontend US3)
10. Validate US3 end-to-end
11. T026 → T027 → T028 → T029 → T030 (polish)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
