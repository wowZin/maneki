# Tasks: 用户手机号登录（号码认证 + 短信验证码）

**Input**: Design documents from `/specs/007-user-sms-login/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/auth-phone.md, research.md, quickstart.md

**Tests**: Not explicitly requested — test tasks omitted.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add dependencies and environment configuration for Aliyun Phone Number Verification and SMS services

- [x] T001 [P] Add Aliyun Go SDK dependencies (`github.com/alibabacloud-go/dypnsapi-20170525` and/or `github.com/aliyun/alibaba-cloud-sdk-go/services/dysmsapi`) to `apps/api/go.mod`
- [x] T002 [P] Install Aliyun H5 SDK package: `cd apps/web && pnpm add aliyun_numberauthsdk_web`
- [x] T003 Configure environment variables for SMS/PNS in `apps/api/.env.example`: `SMS_MODE`, `ALIYUN_ACCESS_KEY_ID`, `ALIYUN_ACCESS_KEY_SECRET`, `ALIYUN_SMS_SIGN_NAME`, `ALIYUN_SMS_TEMPLATE_CODE`, `ALIYUN_PNS_APP_KEY`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core backend SMS service layer, configuration, database index, and frontend hook — MUST complete before user story implementation

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 [P] Extend `apps/api/internal/config/config.go` with SMS/PNS configuration structs and loading logic
- [x] T005 [P] Create `apps/api/internal/service/sms.go` with:
  - `SMSService` interface and implementation
  - Aliyun PNS `GetAuthToken` wrapper
  - Aliyun PNS `VerifyPhoneWithToken` wrapper
  - Aliyun SMS `SendSms` wrapper
  - Mock mode implementation for development (bypass real Aliyun calls, fixed code `123456`)
  - Phone validation helper (`^1[3-9]\d{9}$`)
- [x] T006 [P] Ensure `phone` field uniqueness in `apps/api/internal/model/user.go` or via migration; handle existing duplicate data gracefully
- [x] T007 Create `apps/web/src/hooks/usePhoneAuth.ts` — React hook wrapping Aliyun H5 SDK:
  - `initPhoneNumberServer()` — initialize SDK
  - `checkAuthAvailable(token)` — check if PNS is supported in current environment
  - `getVerifyToken()` — get `spToken` from SDK
  - Return `{ isAvailable, isLoading, error, init, getSpToken }`

**Checkpoint**: Foundation ready — SMS service callable, frontend hook functional, config loaded

---

## Phase 3: User Story 1 — 手机号登录（号码认证 + 短信验证码 Fallback）(Priority: P1) 🎯 MVP

**Goal**: Users can log in via phone number using Aliyun Phone Number Verification as primary channel, with SMS code fallback when PNS is unavailable. Unregistered phones auto-create accounts.

**Independent Test**: Open `/login`, switch to "Phone Login" tab. On mobile browser with cellular: enter phone → click "One-Click Verify" → login succeeds. On PC/WiFi: enter phone → request SMS code → enter code → login succeeds. Unregistered phone auto-creates user.

### Implementation for User Story 1

- [x] T008 [P] [US1] Extend `apps/api/internal/handler/auth.go`:
  - Add `POST /auth/phone/token` handler — calls `smsService.GetAuthToken()`, returns `{access_token, jwt_token, expire_time}`
  - Add `POST /auth/phone/verify` handler — validates phone format, calls `smsService.VerifyPhoneWithToken()`, finds or creates user by phone, generates JWT, sets cookies, returns `TokenResponse`
- [x] T009 [P] [US1] Extend `apps/api/internal/handler/auth.go`:
  - Add `POST /auth/phone/send-code` handler — validates phone, checks Redis rate limits (`sms:limit:phone:{phone}`, `sms:limit:ip:{ip}`), generates 6-digit code, stores in Redis (`sms:login:{phone}` TTL 300s), calls SMS service, returns success/error
  - Add `POST /auth/phone/login-by-code` handler — validates phone + code, checks Redis, finds or creates user by phone, generates JWT, clears Redis key, sets cookies, returns `TokenResponse`
- [x] T010 [US1] Register new phone auth routes in `apps/api/cmd/main.go` under `/api/v1/auth/phone/*`
- [x] T011 [P] [US1] Extend `apps/web/src/services/api.ts` with:
  - `getPhoneAuthToken()` → `POST /auth/phone/token`
  - `verifyPhone(data)` → `POST /auth/phone/verify`
  - `sendSMSCode(data)` → `POST /auth/phone/send-code`
  - `loginByCode(data)` → `POST /auth/phone/login-by-code`
- [x] T012 [US1] Modify `apps/web/src/pages/Login/index.tsx`:
  - Add "Account Password / Phone Number" tab switcher
  - Create `PhoneLoginForm` component section
  - Integrate `usePhoneAuth` hook: on mount, detect if PNS available
  - If PNS available: show phone input + "One-Click Verify" button; on click → `getPhoneAuthToken` → `getSpToken` → `verifyPhone` → `login(token, user)`
  - If PNS unavailable: show phone input + "Get Code" button + code input + "Login" button; on login → `loginByCode` → `login(token, user)`
  - Preserve existing WeChat login button in phone login section
  - Handle loading, error states with Ant Design components

**Checkpoint**: At this point, User Story 1 should be fully functional. Both PNS and SMS fallback paths work. Auto-registration works. JWT cookie + localStorage auth state works.

---

## Phase 4: User Story 2 — 验证码重发与过期处理 (Priority: P2)

**Goal**: SMS code resend countdown, expiration prompts, and error messages for fallback SMS flow.

**Independent Test**: On PC browser (SMS fallback), request code → wait 60s countdown → click resend → new code sent, old code invalidated. Enter wrong code → "Invalid code" error. Enter expired code → "Code expired" error.

### Implementation for User Story 2

- [x] T013 [P] [US2] Add SMS code countdown and resend logic in `apps/web/src/pages/Login/index.tsx` (PhoneLoginForm section):
  - 60-second countdown timer after clicking "Get Code"
  - Disable "Get Code" button during countdown, show remaining seconds
  - Re-enable button after countdown expires
  - Clear code input on resend
- [x] T014 [US2] Add SMS-specific error handling in `apps/web/src/pages/Login/index.tsx`:
  - Display "Invalid code" when backend returns `invalid_code`
  - Display "Code expired, please request a new one" when backend returns expired
  - Display rate limit messages from backend (`rate_limited_phone`, `rate_limited_ip`)
  - Auto-clear error messages on user input
- [x] T015 [US2] Ensure backend in `apps/api/internal/handler/auth.go` returns precise error codes for:
  - `invalid_code` — code mismatch
  - `code_expired` — Redis key missing or expired
  - `rate_limited_phone` — with remaining seconds in `retry_after`
  - `rate_limited_ip` — IP-based throttling

**Checkpoint**: User Story 2 SMS fallback experience is polished. Countdown, resend, and all error states handled correctly.

---

## Phase 5: User Story 3 — 登录状态保持与退出 (Priority: P2)

**Goal**: After phone login, closing and reopening browser retains login state. Logout clears everything.

**Independent Test**: Phone login → close browser → reopen → still authenticated, can access `/dashboard`. Click logout → redirected to `/login`, accessing protected routes redirects to login.

### Implementation for User Story 3

- [x] T016 [US3] Verify `apps/web/src/stores/auth.ts` persist configuration works correctly after phone login (token from phone login should be stored identically to password login)
- [x] T017 [US3] Verify `apps/api/internal/handler/auth.go` Logout handler clears both `access_token` and `refresh_token` httpOnly cookies for phone login sessions (should already work since JWT mechanism is shared)
- [x] T018 [US3] Add phone login success redirect to home (`/`) in `apps/web/src/pages/Login/index.tsx` — ensure same behavior as password login

**Checkpoint**: Login state persistence and logout work correctly for phone-authenticated users.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, cleanup, and documentation

- [x] T019 [P] Run through `quickstart.md` validation checklist locally (Mock mode)
- [x] T020 [P] Add `board_accuracy` and other VIP fields to phone-auto-registered users default values (0, nil) in `apps/api/internal/handler/auth.go`
- [x] T021 Review error message Chinese copy in all frontend and backend responses for consistency
- [x] T022 Ensure `apps/api/internal/service/sms.go` Mock mode logs verification code to console for developer convenience
- [x] T023 Update `apps/web/src/services/api.ts` TypeScript types to include new phone auth interfaces

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phase 3–5)**: All depend on Foundational phase completion
  - US1 (P1) must complete before US2 and US3 polish (but US2/US3 can start in parallel with US1 if components don't conflict)
  - US2 builds on US1's SMS fallback UI
  - US3 is mostly verification of existing shared auth mechanism
- **Polish (Phase 6)**: Depends on all user stories being functional

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2). No dependencies on other stories. This is the MVP.
- **User Story 2 (P2)**: Can start after US1 has basic SMS fallback working. Enhances the SMS fallback UX.
- **User Story 3 (P2)**: Can start in parallel with US1/US2. Primarily verification of shared auth store and logout flow.

### Within Each User Story

- Backend handler methods (T008, T009) and frontend API (T011) can run in parallel
- Frontend Login page modifications (T012) depend on T011 (API methods available)
- Route registration (T010) depends on T008/T009 (handlers implemented)

### Parallel Opportunities

- All Setup tasks (T001–T003) can run in parallel
- All Foundational tasks (T004–T007) can run in parallel
- Within US1: backend handlers (T008, T009) and frontend API (T011) can run in parallel
- US2 tasks (T013–T015) and US3 tasks (T016–T018) can run in parallel after US1 basics work
- All Polish tasks (T019–T023) can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch backend handlers and frontend API in parallel:
Task: "Extend auth.go with phone token + verify handlers"
Task: "Extend auth.go with send-code + login-by-code handlers"
Task: "Extend api.ts with phone auth methods"

# Then, after handlers ready:
Task: "Register phone auth routes in main.go"

# Then, after API methods ready:
Task: "Modify Login page with phone login tab and PNS/SMS integration"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1 (core phone login with both PNS and SMS fallback)
4. **STOP and VALIDATE**: Test both PNS and SMS paths end-to-end in Mock mode
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test PNS + SMS login independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Polish SMS fallback UX (countdown, error messages) → Deploy/Demo
4. Add User Story 3 → Verify state persistence → Deploy/Demo
5. Add Polish phase → Final cleanup → Deploy

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: T008 + T009 + T010 (backend handlers + routes)
   - Developer B: T011 + T012 (frontend API + Login page integration)
3. After US1 works:
   - Developer A: T013 + T014 (frontend SMS polish)
   - Developer B: T015 (backend error codes) + T016–T018 (US3 verification)
4. Final Polish together

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Mock mode (`SMS_MODE=mock`) should be used for all local development and testing
- Aliyun production credentials should NEVER be committed to the repository
