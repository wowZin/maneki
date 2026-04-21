# Tasks: 管理后台 - 超级管理员用户管理

**Feature**: 管理后台 - 超级管理员用户管理
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Data Model**: [data-model.md](./data-model.md)
**Branch**: `001-stock-agent-prediction` | **Date**: 2026-04-19

---

## Dependency Graph

```
Phase 1: Setup
    |
    v
Phase 2: Foundational (Models, JWT, Middleware, CLI base)
    |       |       |       |
    v       v       v       v
Phase 3: US1    Phase 4: US2    Phase 5: US3    Phase 6: US4
(Login)        (Admin Mgmt)   (User Mgmt)    (Audit Log)
    |               |               |               |
    +---------------+---------------+---------------+
                    |
                    v
            Phase 7: Polish
```

**Execution Order**: Phase 1 → Phase 2 → (Phase 3, Phase 4, Phase 5, Phase 6 可部分并行) → Phase 7

**Story Dependencies**:
- US1 (Login) 是 US2/US3/US4 的前置依赖（需要认证和中间件）
- US2, US3, US4 之间无依赖，但都需要 Phase 2 的基础组件

---

## Phase 1: Setup

**Goal**: 初始化项目所需的数据库迁移、基础配置和目录结构。

- [X] T001 Initialize admin database migration (admins, users, audit_logs tables) — implemented via auto-migration in `apps/api/cmd/main.go`
- [X] T002 [P] Add bcrypt dependency to `apps/api/go.mod`
- [X] T003 [P] Add admin-related config structs to `apps/api/internal/config/config.go` (JWT secret, token TTL, admin init password)

---

## Phase 2: Foundational

**Goal**: 构建所有用户故事共享的基础组件：数据模型、JWT 工具、认证中间件、CLI 入口。

- [X] T004 Create Admin model (`apps/api/internal/model/admin.go`) with GORM struct, validation, hooks
- [X] T005 [P] Create User model (`apps/api/internal/model/user.go`) with GORM struct, validation, hooks
- [X] T006 [P] Create AuditLog model (`apps/api/internal/model/audit_log.go`) with GORM struct
- [X] T007 Create Admin repository (`apps/api/internal/repository/admin.go`) with CRUD + findByName
- [X] T008 [P] Create User repository (`apps/api/internal/repository/user.go`) with CRUD + search
- [X] T009 [P] Create AuditLog repository (`apps/api/internal/repository/audit_log.go`) with create + list
- [X] T010 Create JWT utility package (`apps/api/pkg/jwtutil/jwtutil.go`) with generate, parse, blacklist check
- [X] T011 Create auth middleware (`apps/api/internal/middleware/admin_auth.go`) with JWT validation + blacklist check
- [X] T012 Create RBAC middleware (`apps/api/internal/middleware/admin_auth.go`) with role-based route guards
- [X] T013 Create CLI entry (`apps/api/cmd/adminctl/main.go`) with flag parsing and base structure
- [X] T014 Implement CLI create-super-admin command (`apps/api/cmd/adminctl/main.go`)
- [X] T015 Implement CLI reset-password command (`apps/api/cmd/adminctl/main.go`)

---

## Phase 3: User Story 1 - 管理员登录管理后台

**Story Goal**: 管理员通过账户名称+密码登录，JWT 会话管理，30分钟自动过期，强制改密。

**Independent Test**: 可通过 `curl` 调用 `/api/v1/admin/auth/login` 验证登录成功/失败，验证 token 结构和过期时间。

- [X] T016 [US1] Create AuthService (`apps/api/internal/service/admin_auth.go`) with login, logout, change-password
- [X] T017 [US1] Create AuthHandler (`apps/api/internal/handler/admin_auth.go`) with login, logout, change-password endpoints
- [X] T018 [US1] Register auth routes in `apps/api/cmd/main.go`
- [X] T019 [US1] Create LoginPage (`apps/web-admin/src/pages/Login.tsx`) with account name + password form
- [X] T020 [US1] Create authStore (`apps/web-admin/src/stores/auth.ts`) with Zustand for token, role, login/logout
- [X] T021 [US1] Create auth API client (`apps/web-admin/src/api/auth.ts`)
- [X] T022 [US1] Add route guard in `apps/web-admin/src/App.tsx` redirecting unauthenticated users to LoginPage
- [X] T023 [US1] Implement forced password change page (`apps/web-admin/src/pages/ChangePassword.tsx`)

---

## Phase 4: User Story 2 - 超级管理员管理管理员账户

**Story Goal**: 超级管理员通过命令行管理自身，通过后台创建/禁用普通管理员。

**Independent Test**: 运行 CLI 创建超级管理员后，登录后台创建普通管理员，验证新管理员可用初始密码登录；禁用后验证会话失效。

- [X] T024 [US2] Create AdminService (`apps/api/internal/service/admin.go`) with createAdmin, listAdmins, enable/disable
- [X] T025 [US2] Create AdminHandler (`apps/api/internal/handler/admin.go`) with list, create, enable, disable endpoints
- [X] T026 [US2] Register admin routes with `super` role guard in router
- [X] T027 [US2] Create AdminListPage (`apps/web-admin/src/pages/AdminSettings/AdminListPage.tsx`) with table, create dialog, enable/disable actions
- [X] T028 [US2] Create admin API client (`apps/web-admin/src/api/admin.ts`)
- [X] T029 [US2] Add "管理员设置" menu item in `apps/web-admin/src/components/AdminLayout/index.tsx`, conditionally shown for `super` role only
- [X] T030 [US2] Enforce "at least one active super admin" rule in service layer (`apps/api/internal/service/admin.go`)
- [X] T031 [US2] Implement session invalidation on disable via Redis blacklist (`apps/api/internal/service/admin.go`)

---

## Phase 5: User Story 3 - 管理员管理普通用户

**Story Goal**: 管理员查看、搜索、禁用用户，重置用户密码。

**Independent Test**: 登录后台进入用户管理页，执行搜索、禁用、重置密码操作，验证用户端登录行为变化。

- [X] T032 [US3] Create UserService (`apps/api/internal/service/user.go`) with list, search, getDetail, enable, disable, resetPassword
- [X] T033 [US3] Create UserHandler (`apps/api/internal/handler/user.go`) with list, detail, enable, disable, reset-password endpoints
- [X] T034 [US3] Register user routes with `admin` role guard in router
- [X] T035 [US3] Create UserListPage (`apps/web-admin/src/pages/UserManagement/UserListPage.tsx`) with search, pagination, status filter
- [X] T036 [US3] Create UserDetailPage (`apps/web-admin/src/pages/UserManagement/UserDetailPage.tsx`) with info display and action buttons
- [X] T037 [US3] Create user API client (`apps/web-admin/src/api/user.ts`)
- [X] T038 [US3] Add "用户管理" menu item in `apps/web-admin/src/components/AdminLayout/index.tsx`
- [X] T039 [US3] Implement phone number masking in list view (`apps/web-admin/src/pages/UserManagement/UserListPage.tsx`)

---

## Phase 6: User Story 4 - 管理员查看操作日志

**Story Goal**: 管理员查看、筛选、导出操作日志。

**Independent Test**: 执行一个管理操作后，进入操作日志页，验证该操作被正确记录，筛选和导出功能正常。

- [X] T040 [US4] Create AuditService (`apps/api/internal/service/audit.go`) with list, filter, export
- [X] T041 [US4] Create AuditHandler (`apps/api/internal/handler/audit.go`) with list, export endpoints
- [X] T042 [US4] Register audit routes with `admin` role guard in router
- [X] T043 [US4] Integrate audit logging hooks into AdminAuthHandler, AdminMgmtHandler, and UserHandler
- [X] T044 [US4] Create AuditLogPage (`apps/web-admin/src/pages/AuditLog/AuditLogPage.tsx`) with table, date range picker, filter, export button
- [X] T045 [US4] Create audit API client (`apps/web-admin/src/api/audit.ts`)
- [X] T046 [US4] Add "操作日志" menu item in `apps/web-admin/src/components/AdminLayout/index.tsx`

---

## Phase 7: Polish & Cross-Cutting Concerns

**Goal**: 完善跨模块的集成、错误处理、安全加固、前端布局和体验优化。

- [X] T047 Add global error handling middleware (`apps/api/internal/middleware/error.go`)
- [X] T048 Add request logging middleware (`apps/api/internal/middleware/logger.go`)
- [X] T049 Implement global Axios error handling and 401 redirect in `apps/web-admin/src/services/api.ts`
- [X] T050 Build AdminLayout with sidebar navigation, header, logout (`apps/web-admin/src/components/AdminLayout/index.tsx`)
- [X] T051 Add dashboard/placeholder home page (`apps/web-admin/src/pages/Overview`)
- [X] T052 Add 30-minute idle timeout auto-logout in frontend (`apps/web-admin/src/hooks/useAuthGuard.ts`)
- [X] T053 Ensure admin/user account isolation: verified — admin and user auth systems are completely separate with independent JWT middleware and endpoints
- [X] T054 Verify operation logs are immutable: verified — no UPDATE/DELETE endpoints for audit_logs exposed to admin API
- [ ] T055 Run backend API tests: login flow, CRUD, role guards, session invalidation — requires running environment (DB/Redis)
- [ ] T056 Run frontend integration: login → menu visibility per role → user management → audit log flow — requires running backend

---

## Implementation Strategy

**MVP Scope**: Phase 1 + Phase 2 + Phase 3 (管理员登录) + Phase 4 核心功能（创建/禁用管理员）。

**Incremental Delivery**:
1. **Sprint 1**: Phase 1 + Phase 2 + Phase 3 — 完成登录认证体系，后台可登录
2. **Sprint 2**: Phase 4 — 超级管理员可管理其他管理员
3. **Sprint 3**: Phase 5 — 管理员可管理普通用户
4. **Sprint 4**: Phase 6 + Phase 7 — 操作日志和 Polish

**Parallel Opportunities**:
- Phase 2 中模型和仓库可以并行开发（T004/T005/T006/T007/T008/T009）
- Phase 3 的后端和前端可以并行（T016-T018 与 T019-T023）
- Phase 4/5/6 的前端页面可以部分并行，但需要各自的后端接口先完成

---

## Task Summary

| Phase | Story | Tasks | Count |
|-------|-------|-------|-------|
| 1 | Setup | T001-T003 | 3 |
| 2 | Foundational | T004-T015 | 12 |
| 3 | US1 - 登录 | T016-T023 | 8 |
| 4 | US2 - 管理员管理 | T024-T031 | 8 |
| 5 | US3 - 用户管理 | T032-T039 | 8 |
| 6 | US4 - 操作日志 | T040-T046 | 7 |
| 7 | Polish | T047-T056 | 10 |
| **Total** | | **T001-T056** | **56** |

**Completed**: 54 / 56
**Remaining**: 2 (T055, T056 — require full runtime environment)
