# Tasks: 用户短信验证码登录与密码登录

**Input**: Design documents from `/specs/007-user-sms-login/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/api.md, research.md

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story label (US1, US2, US3)

---

## Phase 1: Setup

**Purpose**: Verify branch and document readiness

- [X] T001 Confirm current branch is `007-user-sms-login` and all design docs are present

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema migration and shared model updates. MUST complete before ANY user story.

**Note on migration strategy**: Choose ONE of the following based on data importance:
- **Option A (Clean slate)**: Drop `users` table and recreate with new schema (acceptable if no production data)
- **Option B (Migration)**: Use GORM AutoMigrate + manual SQL to remove unique constraints on `email`/`username`, add unique on `nickname`, drop `full_name`

- [X] T002 [P] Migrate `users` table: remove `email`/`username` unique constraints, add `nickname` UNIQUE, drop `full_name` column, make `hashed_password` nullable. File: `apps/api/migrations/007_update_users.sql` (or drop-and-recreate via GORM)
- [X] T003 [P] Update `User` model: remove `FullName`, make `Email`/`Username` non-unique, add `Nickname` unique tag, make `HashedPassword` optional. File: `apps/api/internal/model/user.go`
- [X] T004 [P] Update `UserRepository`: add `GetByNickname`, add `GetByPhoneOrNickname` helper. File: `apps/api/internal/repository/user.go`
- [X] T005 Update `validatePasswordStrength`: change min length from 6 to 8, keep letter+digit check. File: `apps/api/internal/handler/auth.go`

**Checkpoint**: Foundation ready - DB schema and base models support both login methods

---

## Phase 3: User Story 1 - 手机号验证码登录 (Priority: P1) 🎯 MVP

**Goal**: User can login via SMS verification code; unregistered phones auto-create accounts. Also includes password login and explicit registration as the primary auth entrypoints.

**Independent Test**: Complete full login flow - request SMS code, receive it, input and login successfully. Verify unregistered phone auto-creates user. Verify password login with registered account. Verify explicit registration creates account with name+phone+password.

### Backend

- [X] T006 [P] [US1] Refactor `Register` handler: remove email/username requirements, accept `nickname`/`phone`/`password`/`confirm_password`, validate nickname uniqueness, hash password with bcrypt, set `register_source='password'`. File: `apps/api/internal/handler/auth.go`
- [X] T007 [P] [US1] Implement `PasswordLogin` handler: accept single `account` field (phone or nickname), lookup user by phone then nickname, verify bcrypt password, reuse existing `generateAndSetTokens`. File: `apps/api/internal/handler/auth.go`
- [X] T008 [US1] Update `findOrCreateUserByPhone`: set auto-generated masked phone as initial nickname (e.g. `138****8000`), set `register_source='phone'`, ensure no nickname collision. File: `apps/api/internal/handler/auth.go`
- [X] T009 [P] [US1] Update `UserInfo` response struct and `generateAndSetTokens` to remove email/username fields from token response. File: `apps/api/internal/handler/auth.go`
- [X] T010 [US1] Wire new routes: `POST /api/v1/auth/register`, `POST /api/v1/auth/login`. File: `apps/api/cmd/main.go`

### Frontend

- [X] T011 [P] [US1] Create `PasswordLoginForm` component with account+password inputs, validation, and submit handler. File: `apps/web/src/components/auth/PasswordLoginForm.tsx`
- [X] T012 [P] [US1] Create `PhoneLoginForm` component with phone input, countdown send-code button, code input, and submit handler. File: `apps/web/src/components/auth/PhoneLoginForm.tsx`
- [X] T013 [US1] Refactor `Login` page: add Tab switching between "SMS Login" and "Password Login", integrate both forms. File: `apps/web/src/pages/Login.tsx`
- [X] T014 [P] [US1] Create `Register` page with name, phone, password, confirm_password inputs, validation, and submit. File: `apps/web/src/pages/Register.tsx`
- [X] T015 [P] [US1] Update auth API client: add `register()`, `passwordLogin()`, update type definitions. File: `apps/web/src/services/auth.ts`
- [X] T016 [US1] Add `/register` route to frontend router. File: `apps/web/src/App.tsx`

**Checkpoint**: US1 fully functional - SMS auto-login, password login, and explicit registration all work

---

## Phase 4: User Story 2 - 验证码重发与过期处理 (Priority: P2)

**Goal**: Users can resend SMS code after cooldown; expired/invalid codes show clear error messages.

**Independent Test**: Request code, wait for countdown, request again successfully. Input expired code and see "expired" error. Input wrong code and see "invalid" error.

- [X] T017 [US2] Implement frontend countdown timer (60s) with resend button state management in `PhoneLoginForm`. File: `apps/web/src/components/auth/PhoneLoginForm.tsx`
- [X] T018 [P] [US2] Verify backend resend logic: old code invalidates on new send, rate limits enforced (60s/phone, 10/min/IP). Files: `apps/api/internal/handler/auth.go`, `apps/api/internal/service/sms.go`
- [X] T019 [P] [US2] Ensure frontend displays backend error codes (`invalid_code`, `code_expired`, `rate_limited_phone`) with Chinese messages. File: `apps/web/src/components/auth/PhoneLoginForm.tsx`

**Checkpoint**: US2 independently testable - resend and error handling work correctly

---

## Phase 5: User Story 3 - 登录状态保持与退出 (Priority: P2)

**Goal**: Users stay logged in across browser sessions; can logout explicitly.

**Independent Test**: Login, close browser, reopen - still logged in. Click logout, close browser, reopen - redirected to login page.

- [X] T020 [US3] Verify JWT Cookie persistence: `access_token` (14 days) and `refresh_token` (30 days) are set as httpOnly cookies on login. Files: `apps/api/internal/handler/auth.go`, `apps/api/internal/middleware/jwt.go`
- [X] T021 [P] [US3] Implement frontend auth store: persist login state, auto-refresh token before expiry, redirect to login on 401. File: `apps/web/src/stores/auth.ts`
- [X] T022 [P] [US3] Add logout button in user profile/header that calls logout API and clears local state. File: `apps/web/src/components/Header.tsx` or `apps/web/src/pages/Profile.tsx`
- [X] T023 [US3] Verify `Logout` handler clears cookies and adds token to blacklist (if implemented). File: `apps/api/internal/handler/auth.go`

**Checkpoint**: US3 independently testable - session persistence and logout work

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Password setup for SMS-only users, admin compatibility, and final validation

- [X] T024 [P] Update `ChangePassword` handler: allow setting password without old_password when `hashed_password` is empty (first-time setup). File: `apps/api/internal/handler/user.go`
- [X] T025 [P] Create "Set Password" UI in user profile/settings for SMS-auto-registered users. File: `apps/web/src/pages/Profile.tsx`
- [X] T026 [P] Update admin `CreateUserRequest` and `UpdateUserRequest` to align with new field requirements (optional email/username). File: `apps/api/internal/handler/user.go`
- [X] T027 [P] Update `UserResponse` in admin API to reflect removed/optional fields. File: `apps/api/internal/handler/user.go`
- [X] T028 Run quickstart validation: test all 3 user stories end-to-end per `quickstart.md`
- [X] T029 [P] Update frontend login/register link routing and navigation guards. File: `apps/web/src/App.tsx`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies
- **Phase 2 (Foundational)**: Depends on Phase 1. BLOCKS all user stories. Must choose migration strategy (drop-recreate vs. alter table).
- **Phase 3 (US1 P1)**: Depends on Phase 2. This is the MVP.
- **Phase 4 (US2 P2)**: Depends on Phase 2. Can run in parallel with US3 after US1 is done.
- **Phase 5 (US3 P2)**: Depends on Phase 2. Can run in parallel with US2 after US1 is done.
- **Phase 6 (Polish)**: Depends on all user stories.

### Parallel Opportunities

- Within Phase 2: T002, T003, T004, T005 can all run in parallel (different files)
- Within US1: T006/T007/T008/T009/T010 (backend) can run in parallel with T011/T012/T014/T015 (frontend)
- US2 and US3 can be implemented in parallel after US1 completes
- Phase 6 tasks marked [P] can run in parallel

### Within US1

```bash
# Backend tasks (parallel):
T006 - Refactor Register handler
T007 - Implement PasswordLogin handler
T008 - Update findOrCreateUserByPhone
T009 - Update UserInfo response

# Frontend tasks (parallel):
T011 - PasswordLoginForm component
T012 - PhoneLoginForm component
T014 - Register page
T015 - Update auth API client

# Integration (sequential):
T010 - Wire routes (depends on T006, T007)
T013 - Login page refactor (depends on T011, T012)
T016 - Add register route (depends on T014)
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 1 + Phase 2
2. Complete Phase 3 (US1) - this delivers working login/register
3. **STOP and VALIDATE**: Test SMS login, password login, and registration
4. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 (P1) → Test → Deploy (MVP!)
3. US2 (P2) → Test → Deploy
4. US3 (P2) → Test → Deploy
5. Phase 6 (Polish) → Final validation

### Migration Strategy Note

Per user request: previous implementation had redundant fields. Two approaches:

1. **Drop and recreate** (recommended for dev/staging with no critical data):
   ```bash
   # In migration or manually
   DROP TABLE users;
   # Then let GORM AutoMigrate recreate with new schema
   ```

2. **Alter existing table** (recommended if production data exists):
   ```sql
   ALTER TABLE users DROP CONSTRAINT idx_users_email;
   ALTER TABLE users DROP CONSTRAINT idx_users_username;
   ALTER TABLE users DROP COLUMN full_name;
   ALTER TABLE users ADD CONSTRAINT idx_users_nickname UNIQUE (nickname);
   ALTER TABLE users ALTER COLUMN hashed_password DROP NOT NULL;
   ```
