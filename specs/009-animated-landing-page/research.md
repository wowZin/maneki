# Research: 灵动欢迎页动画与架构方案

**Feature**: 灵动欢迎页（Landing Page）
**Date**: 2026-04-23

---

## 决策 1: 动画实现方案 — 纯 CSS 为主 + 轻量 Canvas 为辅

**Decision**: 动画背景优先使用纯 CSS `@keyframes` + `transform` 实现；仅在粒子密度超过 CSS 性能阈值（约 200 个独立粒子）时降级为轻量 Canvas 2D。

**Rationale**:
- CSS 动画由浏览器合成器线程处理，不阻塞主线程，60fps 更稳定。
- 无需额外 JS 库，减少 bundle 体积（纯 CSS 约 0KB 额外依赖）。
- `prefers-reduced-motion` 媒体查询可直接禁用 CSS 动画，实现零成本可访问性支持。
- Canvas 粒子作为备选方案，仅在需要复杂交互（如鼠标跟随）时启用。

**Alternatives considered**:
- Three.js / WebGL: 视觉效果最强，但 bundle 体积大（~150KB+），低端设备发热明显，overkill。
- Lottie JSON 动画: 需要设计师配合，文件体积不可控，不支持实时响应式调整。
- GIF/视频背景: 明确被 spec 禁止，且体积大、无法交互、不支持透明。

**推荐动画类型**:
1. **流动渐变网格**（Mesh Gradient）— 纯 CSS `background-size` + `@keyframes` 偏移，最轻量。
2. **粒子连线**（Constellation）— CSS `box-shadow` 模拟粒子 + 伪元素画线，中等复杂度。
3. **数字/字符雨**（Matrix Rain）— Canvas 2D 实现，适合股票/数据类品牌调性。
4. **波浪线条**（Wave Lines）— 纯 CSS `border-radius` + `transform` 变形，极简优雅。

---

## 决策 2: 定价数据来源 — 前端静态配置 + 后端配置兜底

**Decision**: PricingTier 数据以前端静态 TypeScript 配置为主源；若后端未来提供 `/api/v1/pricing` 接口，则通过 hooks 动态拉取并缓存。

**Rationale**:
- 定价变动频率低（月度/季度），前端静态配置足够，减少不必要的 API 请求。
- 首屏定价区域需要在 JS 加载前即可渲染骨架屏，静态配置更利于 SSR/SSG 时序。
- 已登录用户的当前 VIP 状态仍需从后端获取（现有 `/auth/users/me` 已返回 `vip_level`）。

**Alternatives considered**:
- 全部后端 API 驱动：增加首屏请求数，对未登录用户无意义。
- 完全写死在组件内：不利于多环境（测试/生产价格不同）和 A/B 测试。

---

## 决策 3: 路由与布局策略 — Landing Page 替代原首页，PricingPage 为独立路由

**Decision**:
- 路由 `/`：未登录展示 Landing Page；已登录根据现有策略保留或自动跳转 `/dashboard`（由现有路由守卫决定，不修改）。
- 路由 `/pricing`：所有用户可访问，未登录用户也允许浏览（便于分享链接），但 CTA 按钮行为不同。

**Rationale**:
- `/pricing` 允许未登录访问是现代 SaaS 的普遍做法（SEO 友好、便于社交分享）。
- 已登录用户的 Landing Page 策略沿用现有代码，不引入 breaking change。

---

## 决策 4: 样式方案 — CSS Modules + CSS 变量（不引入新 CSS-in-JS 库）

**Decision**: 使用 CSS Modules 组织组件样式，动画关键帧和主题色通过 CSS 变量（`:root`）统一控制。

**Rationale**:
- 项目现有技术栈已使用 Vite + CSS Modules，无需引入 styled-components 或 Emotion，减少依赖。
- CSS 变量支持运行时动态调整（如暗色模式切换），且可被 JS 读取用于 Canvas 动画配色同步。
- `module.css` 文件在构建时会被 Vite 自动 hash 和 tree-shake。

**Alternatives considered**:
- Tailwind CSS: 项目未引入，学习成本和迁移成本高。
- Styled Components: 运行时开销，与 Vite 的 SSR 支持不如 CSS Modules 成熟。

---

## 决策 5: 组件复用策略 — AnimatedBackground 和 PricingSection 提取为共享组件

**Decision**:
- `AnimatedBackground`：纯展示组件，接收 `variant` prop（'mesh' | 'particles' | 'rain' | 'waves'），被 HeroSection 使用。
- `PricingSection`：业务组件，接收 `context` prop（'landing' | 'pricing'），控制 CTA 文案和行为。

**Rationale**:
- Landing Page 和 Pricing Page 的定价卡片 UI 完全一致，仅 CTA 和顶部上下文不同。
- AnimatedBackground 未来可能被其他营销页（如活动页）复用。

---

## 性能预算

| 指标 | 预算 | 说明 |
|------|------|------|
| 首屏额外 CSS | ≤ 15KB | 动画关键帧 + 组件样式 |
| 首屏额外 JS | ≤ 5KB | 定价配置 + hooks |
| Canvas fallback | ≤ 20KB | 仅在启用粒子/字符雨时加载 |
| LCP | ≤ 2.5s | 主标题文本为 LCP 元素 |
| CLS | ≤ 0.1 | 定价卡片使用固定高度骨架屏 |
