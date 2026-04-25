# UI Component Contracts: 灵动欢迎页

**Feature**: 灵动欢迎页（Landing Page）
**Date**: 2026-04-23

---

## AnimatedBackground

纯 CSS 动画背景组件，用于 Hero 区域。

### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| variant | `'mesh' \| 'particles' \| 'rain' \| 'waves'` | No | `'mesh'` | 动画变体类型 |
| colorScheme | `'dark' \| 'light'` | No | `'dark'` | 配色方案 |
| reducedMotion | `boolean` | No | `false` | 是否禁用动画（外部传入 prefers-reduced-motion 状态） |

### Behavior

- `variant='mesh'`：4-6 个径向渐变圆形通过 `@keyframes` 移动和缩放，产生流动效果。
- `variant='particles'`：约 50 个 `div` 点通过 `box-shadow` 模拟粒子，轻量连线效果。
- `variant='rain'`：Canvas 2D 垂直下落的字符/数字流，颜色为主题色。
- `variant='waves'`：SVG 或 CSS `border-radius` 变形的波浪线条。
- `reducedMotion=true` 时：所有 `@keyframes` 暂停，显示静态渐变背景。

---

## PricingSection

定价展示区块，被 LandingPage 和 PricingPage 共享。

### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| context | `'landing' \| 'pricing'` | Yes | - | 使用场景，控制 CTA 行为和顶部上下文 |
| tiers | `PricingTier[]` | Yes | - | 定价层级数据 |
| userTierId | `string \| null` | No | `null` | 当前用户 tier id，用于高亮当前方案 |
| onCTAClick | `(tierId: string) => void` | Yes | - | CTA 按钮点击回调 |

### Behavior

- `context='landing'`：无顶部用户状态栏，CTA 按钮文案根据 `userTierId` 判断（未登录 = "立即体验"，已登录 = "升级会员"）。
- `context='pricing'`：顶部展示 `UserStatusBar`，CTA 根据当前 tier 显示"当前方案"（禁用）或"升级"。
- 卡片按 `highlight` 字段将中间卡片视觉高亮（推荐方案）。

---

## PricingCard

单个定价卡片。

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| tier | `PricingTier` | Yes | 定价数据 |
| isCurrent | `boolean` | No | 是否为当前用户方案 |
| onCTAClick | `() => void` | Yes | 点击回调 |

---

## UserStatusBar

定价页顶部用户订阅状态摘要。

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| summary | `UserSubscriptionSummary \| null` | Yes | 用户订阅摘要 |

### Behavior

- `summary=null`：显示骨架屏或提示"加载中..."。
- `summary.isExpired=true`：显示过期警告，提示续费。
- `summary.upgradeTarget`：显示"推荐升级至 XXX"引导。
