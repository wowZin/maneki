---

description: "Task list for 003-notification-settings feature implementation"
---

# Tasks: 通知设置管理

**Input**: Design documents from `/specs/003-notification-settings/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are not explicitly requested in this feature specification. Test tasks are omitted.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify existing project structure and dependencies are ready for the new module

- [x] T001 Verify Go API project builds successfully and existing middleware (admin auth, CORS, error handling) is available for reuse in `apps/api/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core data model, repository, and route registration that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T002 [P] Create `SystemNotification` model with all fields, validation rules, and GORM index tags in `apps/api/internal/model/system_notification.go`
- [x] T003 [P] Create `SystemNotificationRepository` with CRUD, list, disable, and duplicate methods in `apps/api/internal/repository/system_notification.go`
- [x] T004 Register `SystemNotification` auto-migration and admin/user route groups in `apps/api/cmd/main.go`

**Checkpoint**: Foundation ready — `system_notifications` table auto-migrates on startup, repository and handler scaffolding are wired into the application

---

## Phase 3: User Story 1 — 管理员创建并发布系统通知 (Priority: P1) 🎯 MVP

**Goal**: Administrators can create, edit, disable, duplicate, and list system notifications through the admin API

**Independent Test**: Use quickstart.md admin curl commands to create a notification, verify it appears in the list, update it, disable it, and duplicate it. All admin endpoints under `/api/v1/admin/notifications` should respond correctly.

### Implementation for User Story 1

- [x] T005 [US1] Implement Admin Create handler with request DTO, binding validation, and `end_time > start_time` business rule check in `apps/api/internal/handler/system_notification.go`
- [x] T006 [US1] Implement Admin Get Detail handler with runtime status derivation in `apps/api/internal/handler/system_notification.go`
- [x] T007 [US1] Implement Admin Update handler with disabled-status guard and validation in `apps/api/internal/handler/system_notification.go`
- [x] T008 [US1] Implement Admin Disable handler with pending/active status check in `apps/api/internal/handler/system_notification.go`
- [x] T009 [US1] Implement Admin Duplicate handler that copies fields and appends `（副本）` to title in `apps/api/internal/handler/system_notification.go`
- [x] T010 [US1] Implement Admin List handler with basic pagination, created-at DESC sorting, and response DTOs in `apps/api/internal/handler/system_notification.go`

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently via the admin API

---

## Phase 4: User Story 2 — 用户按等级查看生效通知 (Priority: P2)

**Goal**: Authenticated users can view active notifications filtered by their VIP level, with results grouped by priority (urgent vs normal)

**Independent Test**: Use quickstart.md user curl commands. Create notifications with different `min_visible_level` and `priority` values via admin API, then verify a user with a specific VIP level only sees the notifications they are allowed to see, grouped correctly.

### Implementation for User Story 2

- [x] T011 [US2] Implement User List Active Notifications handler with level filtering, time-range filtering, and priority grouping (`urgent` / `normal`) in `apps/api/internal/handler/system_notification.go`
- [x] T012 [US2] Implement User Get Detail handler with full access control (exists, not disabled, in time range, level sufficient) in `apps/api/internal/handler/system_notification.go`

**Checkpoint**: User Story 2 endpoints should return correctly filtered and grouped notifications for any authenticated user

---

## Phase 5: User Story 3 — 通知列表管理与筛选 (Priority: P3)

**Goal**: Administrators can efficiently manage large numbers of notifications with status filtering and keyword search

**Independent Test**: Create 20+ notifications with varying statuses (pending, active, expired, disabled). Verify the admin list endpoint correctly filters by each status, supports pagination, and searches by title keyword.

### Implementation for User Story 3

- [x] T013 [US3] Enhance repository list query with status filter support (`pending`, `active`, `expired`, `disabled`) using runtime status derivation in `apps/api/internal/repository/system_notification.go`
- [x] T014 [US3] Enhance repository list query with keyword search (title ILIKE) in `apps/api/internal/repository/system_notification.go`
- [x] T015 [US3] Update Admin List handler to accept and apply `status` and `keyword` query parameters in `apps/api/internal/handler/system_notification.go`

**Checkpoint**: Admin list supports filtering, search, and pagination; all user stories independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T016 [P] Add runtime status derivation helper method on `SystemNotification` model in `apps/api/internal/model/system_notification.go`
- [x] T017 [P] Add response formatting helpers (`status_label`, `priority_label`) and unify error responses in `apps/api/internal/handler/system_notification.go`
- [x] T018 Validate all API contracts end-to-end using the scenarios in `specs/003-notification-settings/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phase 3–5)**: All depend on Foundational phase completion
  - User stories can proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational — No dependencies on other stories. This is the MVP.
- **User Story 2 (P2)**: Can start after Foundational — Depends on the same data model and repository as US1, but the user endpoints are independent. US1 data (created notifications) is needed for meaningful US2 testing.
- **User Story 3 (P3)**: Can start after Foundational — Builds on the same admin list endpoint from US1, adding filtering and search capabilities.

### Within Each User Story

- Models and repository MUST be complete before handlers (enforced by Phase 2)
- Each handler method is independent once the shared handler file structure is in place
- Story complete when all its handler methods are implemented and testable

### Parallel Opportunities

- T002 and T003 (model + repository) can be developed in parallel
- Within US1, the six admin handler methods (T005–T010) are logically independent and can be worked on in parallel by coordinating on the shared handler file
- US2 and US3 can be started in parallel once Phase 2 is complete (though US3 builds on the US1 list endpoint, the enhancements are additive)
- T016 and T017 (helper methods) can be developed in parallel during the Polish phase

---

## Parallel Example: User Story 1

```bash
# After Phase 2 (Foundational) is complete, launch all US1 handlers together:
Task: "Implement Admin Create handler with request DTO..."
Task: "Implement Admin Get Detail handler..."
Task: "Implement Admin Update handler..."
Task: "Implement Admin Disable handler..."
Task: "Implement Admin Duplicate handler..."
Task: "Implement Admin List handler with basic pagination..."
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 (admin CRUD + basic list)
4. **STOP and VALIDATE**: Test all admin endpoints independently using quickstart.md
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Polish phase → Final validation → Deploy

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (admin lifecycle)
   - Developer B: User Story 2 (user viewing)
   - Developer C: User Story 3 (list filtering)
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently
- The existing `Notification` model/handler/repository (`apps/api/internal/notification.go`) is for user-level push notifications and is unrelated to this feature. The new `SystemNotification` module is standalone.
