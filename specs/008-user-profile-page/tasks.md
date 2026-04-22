# Tasks: 用户端个人信息页面

**Input**: Design documents from `/specs/008-user-profile-page/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/user-api.md, research.md, quickstart.md

**Tests**: Not explicitly requested — test tasks omitted.

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify project readiness and existing dependencies

- [x] T001 Verify `apps/web` exists with React 18 + TypeScript + Vite + Ant Design 5 + Zustand dependencies installed

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T002 [P] Backend: Add `/api/v1/users/me` route group and wire new handlers in `apps/api/cmd/main.go`
- [x] T003 [P] Backend: Implement `GET /api/v1/users/me` handler in `apps/api/internal/handler/user.go`
- [x] T004 [P] Frontend: Create user API service layer with all 5 endpoints in `apps/web/src/services/user.ts`
- [x] T005 [P] Frontend: Create `userProfile` Zustand store for global user state in `apps/web/src/stores/userProfile.ts`

**Checkpoint**: Backend route group ready, frontend service and store created — user story implementation can now begin

---

## Phase 3: User Story 1 - 查看个人信息 (Priority: P1) 🎯 MVP

**Goal**: Deliver the personal info read-only view — avatar, nickname, masked phone, and VIP level badge

**Independent Test**: Log in and navigate to `/profile`. Page displays avatar (or default placeholder), nickname, masked phone (e.g. 138****5678), and colored VIP level tag. All data loads within 2 seconds.

### Implementation for User Story 1

- [x] T006 [P] [US1] Frontend: Register `/profile` route in `apps/web/src/App.tsx`
- [x] T007 [US1] Frontend: Create `Profile` page layout component in `apps/web/src/pages/Profile/index.tsx`
- [x] T008 [US1] Frontend: Implement user info display section (avatar, nickname, masked phone, VIP level tag) in `apps/web/src/pages/Profile/index.tsx`

**Checkpoint**: User Story 1 fully functional — visiting `/profile` shows complete personal info

---

## Phase 4: User Story 2 - 修改基本信息 (Priority: P1)

**Goal**: Allow users to edit nickname and upload/change avatar

**Independent Test**: On `/profile`, click "Edit Nickname" — modal opens, enter new nickname, save — page updates instantly without refresh. Click avatar — upload jpg/png ≤ 5MB, avatar updates immediately.

### Implementation for User Story 2

- [x] T009 [P] [US2] Backend: Implement `PUT /api/v1/users/me` nickname update handler in `apps/api/internal/handler/user.go`
- [x] T010 [P] [US2] Backend: Implement `POST /api/v1/users/me/avatar` handler (multipart, size/format validation) in `apps/api/internal/handler/user.go`
- [x] T011 [US2] Frontend: Create `EditNickname` modal component in `apps/web/src/pages/Profile/EditNickname.tsx`
- [x] T012 [US2] Frontend: Create `AvatarUpload` component with `beforeUpload` validation in `apps/web/src/pages/Profile/AvatarUpload.tsx`
- [x] T013 [US2] Frontend: Integrate `EditNickname` and `AvatarUpload` into `Profile/index.tsx` with API wiring and optimistic UI updates

**Checkpoint**: User Stories 1 AND 2 both work independently — profile view + edit nickname + avatar upload

---

## Phase 5: User Story 3 - 修改登录密码 (Priority: P1)

**Goal**: Allow users to change password with old-password verification

**Independent Test**: On `/profile`, click "Change Password" — modal opens with old/new/confirm fields. Enter correct old password + valid new password → success toast. Enter wrong old password → "旧密码错误" error. Next login requires new password.

### Implementation for User Story 3

- [x] T014 [P] [US3] Backend: Implement `POST /api/v1/users/me/password` handler (bcrypt verify, rules validation) in `apps/api/internal/handler/user.go`
- [x] T015 [US3] Frontend: Create `ChangePassword` modal component in `apps/web/src/pages/Profile/ChangePassword.tsx`
- [x] T016 [US3] Frontend: Integrate `ChangePassword` modal into `Profile/index.tsx` with form validation and API wiring

**Checkpoint**: User Stories 1, 2, 3 all independently functional

---

## Phase 6: User Story 4 - SVIP 返佣展示 (Priority: P2)

**Goal**: Conditionally display rebate summary for SVIP users only

**Independent Test**: Log in as SVIP → `/profile` shows rebate card with total/pending/settled amounts. Log in as VIP or normal user → rebate area is completely removed from DOM, no empty placeholders.

### Implementation for User Story 4

- [x] T017 [P] [US4] Backend: Implement `GET /api/v1/users/me/rebate` handler (403 for non-SVIP) in `apps/api/internal/handler/user.go`
- [x] T018 [US4] Frontend: Add conditional rebate summary card to `Profile/index.tsx` — rendered only when `vip_level === 2` (SVIP)

**Checkpoint**: All user stories independently functional

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Responsive design, validation polish, and end-to-end validation

- [x] T019 [P] Frontend: Add responsive mobile layout for `Profile/index.tsx` using Ant Design Grid and media queries
- [x] T020 [P] Frontend: Add form validation messages, loading spinners, and error boundaries across all Profile modals
- [x] T021 Frontend: Run `quickstart.md` validation checklist — verify avatar upload, password change, nickname edit, and rebate conditional rendering

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phase 3–6)**: All depend on Foundational phase completion
  - Can proceed sequentially in priority order (P1 → P2)
  - Or in parallel if team capacity allows
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational — no dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational — integrates with US1 profile page layout
- **User Story 3 (P1)**: Can start after Foundational — integrates with US1 profile page layout
- **User Story 4 (P2)**: Can start after Foundational — integrates with US1 profile page layout, depends on US1 display structure

### Within Each User Story

- Backend handlers and frontend components within the same story can start in parallel (marked [P])
- Integration/wiring tasks must wait for their component/handler tasks

### Parallel Opportunities

- All Foundational tasks (T002–T005) can run in parallel
- Backend handler T009 and T010 can run in parallel
- Frontend components T011 and T012 can run in parallel
- Backend handler T014 and frontend modal T015 can run in parallel
- All Polish tasks (T019–T021) can run in parallel after stories complete

---

## Parallel Example: User Story 2

```bash
# Launch backend handlers together:
Task: "Implement PUT /api/v1/users/me in apps/api/internal/handler/user.go"
Task: "Implement POST /api/v1/users/me/avatar in apps/api/internal/handler/user.go"

# Launch frontend components together:
Task: "Create EditNickname modal in apps/web/src/pages/Profile/EditNickname.tsx"
Task: "Create AvatarUpload component in apps/web/src/pages/Profile/AvatarUpload.tsx"

# Then wire integration:
Task: "Integrate EditNickname and AvatarUpload into Profile/index.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1 (view-only profile page)
4. **STOP and VALIDATE**: Test `/profile` loads and displays user info correctly
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add User Story 1 → Test view-only profile → Deploy/Demo (MVP!)
3. Add User Story 2 → Test nickname edit + avatar upload → Deploy/Demo
4. Add User Story 3 → Test password change → Deploy/Demo
5. Add User Story 4 → Test SVIP rebate display → Deploy/Demo
6. Polish → Final validation

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (profile page layout)
   - Developer B: User Story 2 (nickname + avatar) + User Story 3 (password)
   - Developer C: User Story 4 (rebate) + Polish
3. Stories complete and integrate independently

---

## Notes

- `[P]` tasks = different files, no dependencies on incomplete tasks
- `[Story]` label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Avatar upload follows the API contract (multipart/form-data, jpg/png, max 5MB)
- Password change requires old password verification via bcrypt
- Rebate area is **completely removed from DOM** for non-SVIP users (per research decision)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
