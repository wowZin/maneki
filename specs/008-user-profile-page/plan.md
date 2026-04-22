# Implementation Plan: 用户端个人信息页面

**Branch**: `008-user-profile-page` | **Date**: 2026-04-22 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/008-user-profile-page/spec.md`

---

## Summary

在用户端 Web 应用 (`apps/web`) 中新增个人信息页面 `/profile`，支持已登录用户查看和修改基本信息（头像、昵称）、修改密码，SVIP 用户额外展示返佣收益。技术栈沿用现有 React 18 + TypeScript + Vite + Ant Design 5 + Zustand 方案。

---

## Technical Context

**Language/Version**: TypeScript 5.x, React 18.2  
**Primary Dependencies**: Ant Design 5.x, Axios, React Router 6, Zustand  
**Storage**: PostgreSQL (后端), 阿里云 OSS (头像存储)  
**Testing**: Vitest (前端), Go test (后端)  
**Target Platform**: Web (桌面端 + 移动端响应式)  
**Project Type**: web-app (前后端分离)  
**Performance Goals**: 页面加载 < 2s, 表单响应 < 300ms  
**Constraints**: 头像 ≤ 5MB, jpg/png 格式; 密码 ≥ 6 位  
**Scale/Scope**: 面向已登录用户，单页面功能

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| Tech stack consistency | Pass | 沿用 apps/web 现有 React + AntD 栈 |
| No premature abstractions | Pass | 单页面功能，无需过度设计 |
| Security baseline | Pass | 密码修改需旧密码验证，头像上传限制格式/大小 |
| API contract defined | Pass | 5 个接口契约已定义见 contracts/ |

---

## Project Structure

### Documentation (this feature)

```text
specs/008-user-profile-page/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── user-api.md      # API 契约
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

**前端** (`apps/web/`):
```text
apps/web/src/
├── pages/
│   └── Profile/
│       ├── index.tsx          # 个人信息主页面
│       ├── EditNickname.tsx   # 修改昵称 Modal
│       ├── ChangePassword.tsx # 修改密码 Modal
│       └── AvatarUpload.tsx   # 头像上传组件
├── services/
│   └── user.ts                # 用户相关 API 封装
├── stores/
│   └── userProfile.ts         # Zustand 状态管理
└── App.tsx                    # 路由注册
```

**后端** (`apps/api/`):
```text
apps/api/internal/
├── handler/
│   └── user.go                # 新增/修改：用户个人信息接口
├── model/
│   └── user.go                # 已存在，复用
├── repository/
│   └── user.go                # 已存在，复用
└── service/
    └── user.go                # 已存在，复用
```

**Structure Decision**: 前后端分离结构。前端在 `apps/web/src/pages/Profile/` 下新建页面组件；后端复用现有用户模块，新增 `/users/me` 系列接口。

---

## Implementation Phases

### Phase 1: 后端接口开发

1. **GET /api/v1/users/me** — 获取当前用户个人信息
   - 读取 token 中的 user_id
   - 查询 users 表，返回脱敏后的手机号
   - 关联 user_levels 表返回等级名称和颜色

2. **PUT /api/v1/users/me** — 修改昵称
   - 校验昵称格式（2-20 字符，正则校验）
   - 检查昵称唯一性
   - 更新 users 表

3. **POST /api/v1/users/me/avatar** — 上传头像
   - 生成 OSS 预签名 URL
   - 或：接收 multipart 文件，上传 OSS 后返回 URL
   - 更新 users.avatar_url

4. **POST /api/v1/users/me/password** — 修改密码
   - 校验旧密码（bcrypt 比对）
   - 校验新密码规则（≥6 位）
   - 更新 users.hashed_password

5. **GET /api/v1/users/me/rebate** — 返佣汇总
   - 校验用户等级 = SVIP
   - 查询 rebate_records 汇总数据
   - 非 SVIP 返回 403

### Phase 2: 前端页面开发

1. **路由注册** — `App.tsx` 添加 `/profile` 路由
2. **API 服务层** — `services/user.ts` 封装 5 个接口
3. **状态管理** — `stores/userProfile.ts` Zustand store
4. **页面组件**:
   - `Profile/index.tsx` — 主页面布局（头像卡片 + 信息列表 + 返佣卡片）
   - `EditNickname.tsx` — 昵称编辑 Modal
   - `ChangePassword.tsx` — 密码修改 Modal（旧密码 + 新密码 + 确认密码）
   - `AvatarUpload.tsx` — 头像上传（beforeUpload 校验 + 裁剪）
5. **响应式适配** — 移动端优先，Ant Design Grid 布局

### Phase 3: 联调与测试

1. 前后端接口联调
2. 头像上传端到端测试
3. 密码修改安全测试
4. SVIP / 非 SVIP 返佣区域条件渲染测试
5. 表单校验边界测试

---

## Complexity Tracking

> 本功能无架构复杂度超标项，所有设计均符合项目现有模式。

---

## Key Files

| 文件 | 作用 | 状态 |
|------|------|------|
| `apps/web/src/pages/Profile/index.tsx` | 个人信息主页面 | 待创建 |
| `apps/web/src/services/user.ts` | 用户 API 封装 | 待创建 |
| `apps/web/src/stores/userProfile.ts` | 用户状态管理 | 待创建 |
| `apps/api/internal/handler/user.go` | 后端用户接口 | 待新增接口 |
| `apps/api/cmd/main.go` | 路由注册 | 待新增路由 |
