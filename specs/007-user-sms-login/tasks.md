# Tasks: 用户手机号登录（号码认证 + 短信验证码）

**Input**: Design documents from `/specs/007-user-sms-login/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/api.md, research.md, quickstart.md

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

## Phase 6: Polish & Cross-Cutting Concerns (Original)

**Purpose**: Final validation, cleanup, and documentation for phone login feature

- [x] T019 [P] Run through `quickstart.md` validation checklist locally (Mock mode)
- [x] T020 [P] Add `board_accuracy` and other VIP fields to phone-auto-registered users default values (0, nil) in `apps/api/internal/handler/auth.go`
- [x] T021 Review error message Chinese copy in all frontend and backend responses for consistency
- [x] T022 Ensure `apps/api/internal/service/sms.go` Mock mode logs verification code to console for developer convenience
- [x] T023 Update `apps/web/src/services/api.ts` TypeScript types to include new phone auth interfaces

---

## Phase 7: Foundational Additions (Blocking for New User Stories)

**Purpose**: Backend prerequisites for forgot password, registration polish, and "remember me"

**⚠️ CRITICAL**: Complete these before starting US4–US7

- [ ] T024 [P] Add username uniqueness check in `apps/api/internal/handler/auth.go` Register handler — reject duplicate username before Create
- [ ] T025 [P] Add backend forgot-password SMS methods to `apps/api/internal/service/sms.go`:
  - `SendForgotPasswordCode(ctx, phone)` using Redis key `sms:forgot:{phone}` TTL 300s
  - `ValidateForgotPasswordCode(ctx, phone, code)` with separate key namespace from login codes
- [ ] T026 [P] Strengthen backend password validation in `apps/api/internal/handler/auth.go`:
  - RegisterRequest password: min 8 chars, must contain both letter and number
  - Reject passwords that are all letters or all numbers

**Checkpoint**: Backend supports username uniqueness, forgot-password SMS isolation, and stronger password policy.

---

## Phase 8: User Story 4 — 登录页完善（账号密码登录体验增强）(Priority: P1)

**Goal**: Password login tab provides "remember me" option and "forgot password" navigation. Phone login tab also provides "forgot password" path.

**Independent Test**: Open `/login` on password tab. See "记住我" checkbox and "忘记密码？" link. Check "记住我", login, close browser, reopen → still logged in. Uncheck, login, close browser, reopen → needs re-login. Click "忘记密码？" → navigates to `/forgot-password`.

### Implementation for User Story 4

- [ ] T027 [US4] Add "记住我" checkbox to password login form in `apps/web/src/pages/Login/index.tsx`
- [ ] T028 [US4] Add "忘记密码？" link below password login form in `apps/web/src/pages/Login/index.tsx`
- [ ] T029 [US4] Add "忘记密码？" link below phone login form in `apps/web/src/pages/Login/index.tsx`
- [ ] T030 [P] [US4] Add forgot password API interfaces to `apps/web/src/services/api.ts`:
  - `sendForgotPasswordCode(data)` → `POST /auth/forgot-password/send-code`
  - `resetPassword(data)` → `POST /auth/forgot-password/reset`
- [ ] T031 [P] [US4] Implement backend forgot password handlers in `apps/api/internal/handler/auth.go`:
  - `POST /auth/forgot-password/send-code` — validate phone exists, send code via `smsService.SendForgotPasswordCode`, apply rate limits
  - `POST /auth/forgot-password/reset` — validate code via `smsService.ValidateForgotPasswordCode`, validate new password complexity, bcrypt hash, update user password, generate JWT, auto-login response
- [ ] T032 [US4] Register forgot password routes in `apps/api/cmd/main.go`

**Checkpoint**: Login page has remember-me and forgot-password navigation. Backend forgot-password flow is functional.

---

## Phase 9: User Story 5 — 注册页完善（支持手机号与强密码策略）(Priority: P2)

**Goal**: Registration form collects optional phone number and enforces strong password policy. After successful registration, user is automatically logged in.

**Independent Test**: Open `/register`. Fill username, email, phone, password (8+ chars with letters and numbers). Submit → registration succeeds and user is immediately redirected to dashboard (auto-login). Try weak password → rejected with clear message. Try duplicate username → rejected.

### Implementation for User Story 5

- [ ] T033 [P] [US5] Add optional phone field to Register form in `apps/web/src/pages/Register/index.tsx`:
  - Input with `MobileOutlined` prefix
  - Pattern validation `^1[3-9]\d{9}$`
  - Placeholder: "手机号（可选）"
- [ ] T034 [P] [US5] Update `RegisterData` interface and `authApi.register` call in `apps/web/src/services/api.ts` to include optional `phone`
- [ ] T035 [US5] Strengthen frontend password validation in `apps/web/src/pages/Register/index.tsx`:
  - Min 8 characters
  - Must contain at least one letter and one number
  - Update confirm password validator to match
- [ ] T036 [US5] Auto-login after successful registration in `apps/web/src/pages/Register/index.tsx`:
  - On register success, use returned token + user from backend to call `login(token, user)` from auth store
  - Redirect to `/` instead of showing success message + "去登录" button

**Checkpoint**: Registration collects phone, enforces strong passwords, and auto-logs in the user.

---

## Phase 10: User Story 6 — 忘记密码页面 (Priority: P2)

**Goal**: Users can reset their password via SMS verification on a dedicated forgot-password page.

**Independent Test**: Navigate to `/forgot-password`. Enter registered phone → request code → enter code + new password (8+ chars with letters and numbers) → submit → password reset succeeds, auto-login, redirect to home. Enter wrong code → error. Enter weak password → rejected.

### Implementation for User Story 6

- [ ] T037 [P] [US6] Create `apps/web/src/pages/ForgotPassword/index.tsx` page component:
  - Step 1: Phone input + "获取验证码" button with countdown
  - Step 2: Code input + new password + confirm password
  - Step 3: Submit → call `resetPassword` API → auto-login on success
  - Match existing auth page styling (auth-container, auth-card, tech gradients)
  - Back to login link
- [ ] T038 [US6] Add `/forgot-password` route in `apps/web/src/App.tsx`
- [ ] T039 [US6] Integrate SMS countdown and error handling in ForgotPassword page (reuse countdown logic pattern from Login page)

**Checkpoint**: Forgot password page is fully functional: send code, validate, reset password, auto-login.

---

## Phase 11: User Story 7 — "记住我"功能 (Priority: P2)

**Goal**: Users can choose whether their login persists across browser sessions.

**Independent Test**: Login with "记住我" checked → token stored in localStorage → close and reopen browser → still logged in. Login with "记住我" unchecked → token stored in sessionStorage → close and reopen browser → redirected to login.

### Implementation for User Story 7

- [ ] T040 [US7] Extend `apps/web/src/stores/auth.ts` to support dual storage strategy:
  - Create `createAuthStore(storage: 'local' | 'session')` factory
  - Default export uses localStorage (backward compatible)
  - Export a sessionStorage variant for non-remember-me logins
- [ ] T041 [US7] Update Login page `handleSubmit` in `apps/web/src/pages/Login/index.tsx`:
  - Read "remember me" checkbox value
  - If checked: use default localStorage store (existing behavior)
  - If unchecked: use sessionStorage store instance
  - Pass storage choice through to `login()` call
- [ ] T042 [US7] Update phone login handlers (`handlePhoneVerifyLogin`, `handlePhoneCodeLogin`) in `apps/web/src/pages/Login/index.tsx` to respect "remember me" setting

**Checkpoint**: "Remember me" checkbox controls token persistence strategy correctly for all login methods.

---

## Phase 12: Polish & Cross-Cutting Concerns (Final)

**Purpose**: Final validation and fixes for all auth flows

- [ ] T043 [P] Fix `apps/web/src/services/api.ts` baseURL fallback from `http://localhost:8000` to empty string `''` to ensure Vite proxy is always used
- [ ] T044 [P] Run end-to-end validation of all auth flows per `quickstart.md` checklist:
  - Account password login (correct, wrong password, non-existent user)
  - Phone login (PNS + SMS fallback)
  - Registration (success, duplicate username, weak password)
  - Forgot password (send code, reset, auto-login)
  - Remember me (checked vs unchecked persistence)
  - Logout clears state
- [ ] T045 Review and align all Chinese error messages between frontend and backend for consistency

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: ✅ Complete
- **Foundational (Phase 2)**: ✅ Complete
- **User Stories 1–3 (Phase 3–5)**: ✅ Complete
- **Foundational Additions (Phase 7)**: Must complete before US4–US7
- **User Stories 4–7 (Phase 8–11)**: All depend on Phase 7
  - US4 (login polish + forgot password backend) must complete before US6 (forgot password page)
  - US5 (registration) can run in parallel with US4/US6/US7
- **Polish (Phase 12)**: Depends on all user stories being functional

### User Story Dependencies

- **User Story 4 (P1)**: Login page enhancements + forgot password backend. Must complete before US6.
- **User Story 5 (P2)**: Registration enhancements. Can run in parallel with US4/US6/US7.
- **User Story 6 (P2)**: Forgot password page. Depends on US4 backend handlers.
- **User Story 7 (P2)**: Remember me. Can run in parallel with US5/US6 after US4 login checkbox is added.

### Parallel Opportunities

- T024, T025, T026 (Phase 7 foundational) can run in parallel
- T027, T028, T029, T030, T031 (US4) can mostly run in parallel except T031 depends on T030
- T033, T034, T035 (US5 frontend) can run in parallel
- T037, T038 (US6 page + route) can run in parallel with T040 (US7 store changes)

---

## Implementation Strategy

### MVP Scope

1. Complete Phase 7: Foundational Additions
2. Complete Phase 8: US4 — Login page polish + forgot password backend
3. **STOP and VALIDATE**: Test password login with remember-me, verify forgot-password backend works via curl
4. Complete Phase 9: US5 — Registration enhancements
5. Complete Phase 10: US6 — Forgot password page
6. Complete Phase 11: US7 — Remember me full integration
7. Complete Phase 12: Final polish and validation

### Incremental Delivery

1. Phase 7 → Backend ready for new features
2. US4 → Login page has remember-me checkbox + forgot-password links + backend handlers → Deploy
3. US5 → Registration with phone + strong passwords + auto-login → Deploy
4. US6 → Forgot password page functional → Deploy
5. US7 → Remember me works for all login methods → Deploy
6. Polish → Final validation → Deploy

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Mock mode (`SMS_MODE=mock`) should be used for all local development and testing
- Aliyun production credentials should NEVER be committed to the repository
