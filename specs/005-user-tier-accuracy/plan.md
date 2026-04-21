# Implementation Plan: 用户管理增强 - 等级、准确率与 Agent 数据

**Branch**: `005-user-tier-accuracy` | **Date**: 2026/04/21 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/005-user-tier-accuracy/spec.md`

## Summary

在用户管理后台现有列表与详情能力基础上，新增：
1. **列表增强**：展示用户等级（普通/VIP/SVIP）与打板准确率，支持按等级筛选、按准确率降序排名；
2. **详情增强**：用户详情页除基本信息外，增加该用户关联的 Agent 数据（订阅 Agent 列表及关键表现指标）。

技术路径：后端扩展 User 模型与列表查询逻辑，新增用户详情聚合接口；前端扩展表格字段、筛选器与排序交互，并扩展详情页 Agent 数据展示区域。

## Technical Context

**Language/Version**: Go 1.22 (后端), TypeScript 5.3 + React 18 (前端)
**Primary Dependencies**: Gin + GORM + PostgreSQL (后端), Ant Design 5 + React Router 6 + Axios (前端)
**Storage**: PostgreSQL (主库), Redis (缓存, 可选)
**Testing**: Go testing + testify (后端), Jest/Vitest (前端, 视项目已有测试框架)
**Target Platform**: Linux 服务器部署, 桌面浏览器访问管理后台
**Project Type**: Web application (前后端分离)
**Performance Goals**: 用户列表查询 p95 < 300ms, 详情页聚合查询 p95 < 300ms
**Constraints**: 管理后台内网使用, 并发量中等 (<100 管理员同时在线)
**Scale/Scope**: 用户量级假设 <100万, Agent 订阅数据随用户增长

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution 文件为模板状态，未配置具体原则。本次计划遵循项目现有工程约定：
- 前后端分离, REST API 通信
- 后端使用 Gin + GORM + PostgreSQL 分层架构 (handler/service/repository/model)
- 前端使用 React + Ant Design + 按页面模块组织代码
- 代码审查与 lint 通过后方可合并

**Gate 结果**: 通过。复杂度可控，无需引入新项目或打破现有架构。

## Project Structure

### Documentation (this feature)

```text
specs/005-user-tier-accuracy/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── admin-user-api.md
└── tasks.md             # Phase 2 output (by /speckit.tasks)
```

### Source Code (repository root)

```text
apps/api/
├── internal/
│   ├── model/
│   │   └── user.go          # 扩展 User 模型：新增打板准确率字段
│   ├── handler/
│   │   └── user.go          # 扩展列表查询与详情接口
│   ├── service/
│   │   └── user.go          # 扩展列表服务与详情聚合服务
│   ├── repository/
│   │   └── user.go          # 扩展带排序/筛选的查询
│   └── router/
│       └── admin.go         # 路由注册（通常无需变更）
└── migrations/              # 新增用户表迁移（如需要 accuracy 字段）

apps/web-admin/
├── src/
│   ├── api/
│   │   └── user.ts          # 扩展 User 类型与 API 调用
│   ├── pages/
│   │   └── UserManagement/
│   │       ├── UserListPage.tsx     # 扩展表格列、筛选器、排序
│   │       └── UserDetailPage.tsx   # 扩展 Agent 数据展示
│   └── types/               # 如有全局类型目录，同步更新
```

**Structure Decision**: 沿用项目现有前后端分离结构。后端在 handler/service/repository 三层中增量扩展；前端在现有 `UserManagement` 页面模块中增量修改。无需新增微服务或独立模块。

## Complexity Tracking

> 无需要特别说明的架构复杂度或原则违背项。本次需求为典型的 CRUD 增强，完全适配现有分层架构。

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | N/A | N/A |
