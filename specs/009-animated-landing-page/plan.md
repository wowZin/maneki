# Implementation Plan: 灵动欢迎页（Landing Page）

**Branch**: `009-animated-landing-page` | **Date**: 2026-04-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/009-animated-landing-page/spec.md`

## Summary

为 Maneki 智能股票分析平台设计一个高视觉冲击力的首页 Landing Page。首屏 Hero 区域占视口 2/3，以纯 CSS 灵动动画为背景，大字号 Slogan 居中展示；下方为定价展示区域，支持未登录用户转化。同时提供独立的 `/pricing` 定价页，供已登录用户随时查看会员权益并发起升级。技术方案以纯 CSS 动画为主、轻量 Canvas 为辅，确保性能与可访问性。

## Technical Context

**Language/Version**: TypeScript 5.x, React 18
**Primary Dependencies**: Vite 5.x, Ant Design 5.x, React Router 6.x, Zustand (state), CSS Modules / plain CSS
**Storage**: N/A (纯前端展示，定价数据读取现有后端 VIP 配置或前端静态配置)
**Testing**: Vitest (unit), Playwright (E2E visual)
**Target Platform**: Web (Chrome/Edge/Firefox/Safari 最新 2 个主版本), 微信内置浏览器
**Project Type**: web-application (frontend-only page within existing monorepo)
**Performance Goals**: LCP ≤ 2.5s, CLS ≤ 0.1, 动画 60fps 在主流设备上
**Constraints**: 无视频/GIF，动画全部 CSS/轻量 Canvas；支持 prefers-reduced-motion；微信 WebView 兼容
**Scale/Scope**: 2 个路由页面（/ 和 /pricing），3 个主要 UI 区块（HeroSection, PricingSection, UserStatusBar）

## Constitution Check

Constitution 文件为占位符模板，无实际约束。本 feature 为纯前端展示页，不引入新后端服务或存储，复杂度可控，无 Constitution 违规。

## Project Structure

### Documentation (this feature)

```text
specs/009-animated-landing-page/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (UI contracts / pricing API contracts)
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
apps/web/src/
├── pages/
│   ├── LandingPage/
│   │   ├── index.tsx              # Landing Page 入口（Hero + Pricing）
│   │   ├── HeroSection/
│   │   │   ├── index.tsx
│   │   │   ├── HeroSection.module.css   # 纯 CSS 动画（粒子、渐变、数字雨）
│   │   │   └── Slogan.tsx
│   │   └── PricingSection/
│   │       ├── index.tsx
│   │       ├── PricingCard.tsx
│   │       └── PricingSection.module.css
│   └── PricingPage/
│       ├── index.tsx              # 独立定价页 /pricing
│       └── UserStatusBar.tsx      # 当前用户订阅状态摘要
├── components/
│   └── AnimatedBackground/        # 可复用的 CSS 动画背景组件
│       ├── index.tsx
│       └── AnimatedBackground.module.css
├── hooks/
│   └── usePricingTiers.ts         # 读取定价数据（API 或静态配置）
├── services/
│   └── pricing.ts                 # 定价相关 API 封装（如有）
└── types/
    └── pricing.ts                 # PricingTier TypeScript 类型
```

**Structure Decision**: 在现有 `apps/web` 前端项目中新增页面和组件。动画背景提取为可复用组件（`AnimatedBackground`），PricingSection 被 LandingPage 和 PricingPage 共享。

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| 2 个独立页面（/ 和 /pricing）| Landing 页面向未登录用户展示品牌+定价；Pricing 页面向已登录用户展示升级选项，用户意图和交互路径不同 | 单页无法同时满足新用户首屏沉浸和已登录用户快速升级两种场景 |
