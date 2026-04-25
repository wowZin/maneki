# Implementation Plan: 首页概览数据看板

**Branch**: `010-homepage-overview` | **Date**: 2026/04/25 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/010-homepage-overview/spec.md`

## Summary

为 Maneki 股票预测平台设计并实现首页概览数据看板，包含五大核心数据模块：打板预测正确率趋势、用户选中涨停股票趋势（含明细）、各 Agent 命中率对比、热门股票榜单、实时信号流。后端基于 Go/Gin/GORM 扩展现有架构，新增数据聚合服务与统计表；前端基于 React/Ant Design/ECharts 重构 Dashboard 页面，采用卡片式布局展示多维度数据。

## Technical Context

**Language/Version**: Go 1.23 (后端), TypeScript/React 18 (前端)
**Primary Dependencies**: Gin, GORM, PostgreSQL (TimescaleDB), Redis, React, Ant Design, ECharts, Zustand, Axios
**Storage**: PostgreSQL (主库), Redis (缓存与热点数据), TimescaleDB (K线 hypertable)
**Testing**: Go testing + testify (后端), Vitest (前端, 待引入)
**Target Platform**: Web 浏览器 (现代桌面 + 移动端)
**Project Type**: web-application (前端 + 后端 API 服务)
**Performance Goals**: 首页全模块加载 < 5s, 时间维度切换 < 1s, 明细查询 < 2s
**Constraints**: 股票行情数据时效性要求高 (开盘后 30min 内更新), 实时信号延迟 < 30s
**Scale/Scope**: 预期日活用户 < 10k, 股票池 ~5000 只, Agent 数量 < 50 个

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

当前项目宪法为模板状态，未定义具体原则约束。本功能在现有单体 Web 应用架构内实现，未引入新项目、未改变项目结构层级，符合通用开发规范。无需复杂度追踪。

**检查结果**: ✅ 通过

## Project Structure

### Documentation (this feature)

```text
specs/010-homepage-overview/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── api-contracts.md
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
# 后端 (Go) — 在现有 apps/api 目录下扩展
apps/api/
├── internal/
│   ├── handler/
│   │   └── overview.go          # 新增: 首页概览 API Handler
│   ├── service/
│   │   └── overview.go          # 新增: 数据聚合与业务逻辑
│   ├── repository/
│   │   └── overview.go          # 新增: 统计查询与原始数据访问
│   └── model/
│       └── overview.go          # 新增: 统计实体与 DTO
├── cmd/main.go                  # 修改: 注册新 handler 与路由
└── migrations/                  # 修改: 新增表迁移逻辑

# 前端 (React) — 在现有 apps/web 目录下扩展
apps/web/
├── src/
│   ├── pages/
│   │   └── Dashboard/
│   │       ├── index.tsx        # 重构: 首页概览主页面
│   │       ├── components/
│   │       │   ├── AccuracyTrendChart.tsx      # 新增: 正确率趋势图
│   │       │   ├── UserTrackingCard.tsx        # 新增: 用户选中趋势卡片
│   │       │   ├── UserTrackingDetailModal.tsx # 新增: 明细弹窗
│   │       │   ├── AgentPerformanceTable.tsx   # 新增: Agent 命中率表格
│   │       │   ├── HotStocksList.tsx           # 新增: 热门股票列表
│   │       │   └── RealtimeSignals.tsx         # 新增: 实时信号流
│   │       └── hooks/
│   │           └── useOverviewData.ts          # 新增: 数据获取 Hook
│   └── services/
│       └── overview.ts          # 新增: 概览 API 服务封装
```

**Structure Decision**: 采用项目现有 Option 2 (Web application with frontend + backend)。后端严格遵循已建立的 handler → service → repository → model 分层；前端在现有 Dashboard 页面基础上重构，按数据模块拆分为独立组件。

## Complexity Tracking

无需记录 — 本功能在现有架构内实现，未引入新的项目层级或复杂模式。
