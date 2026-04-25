# Quickstart: 灵动欢迎页

**Feature**: 灵动欢迎页（Landing Page）
**Date**: 2026-04-23

---

## 本地开发环境准备

### 1. 启动前端开发服务器

```bash
cd apps/web
pnpm dev
```

### 2. 验证页面

| 场景 | URL | 预期结果 |
|------|-----|----------|
| 未登录访问首页 | http://localhost:5173/ | 显示 Landing Page，Hero 区域有 CSS 动画，向下滚动显示定价卡片 |
| 访问定价页 | http://localhost:5173/pricing | 显示独立定价页，无 Hero，直接展示定价卡片和用户状态栏 |
| 已登录访问首页 | http://localhost:5173/ | 若现有路由策略为自动跳转，则进入 /dashboard；否则保留 Landing Page |

### 3. 切换动画变体

在 `apps/web/src/pages/LandingPage/HeroSection/index.tsx` 中修改 `AnimatedBackground` 的 `variant` prop：

```tsx
// 可选: 'mesh' | 'particles' | 'rain' | 'waves'
<AnimatedBackground variant="mesh" />
```

### 4. Mock 定价数据

定价数据位于 `apps/web/src/config/pricing.ts`，修改后即可实时预览。

---

## 生产部署要点

### 1. 路由配置

确保 Nginx / CDN 对以下路由返回 `index.html`：

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
location /pricing {
    try_files $uri $uri/ /index.html;
}
```

### 2. SEO

- Landing Page `/` 设置 `<title>` 和 `<meta name="description">`。
- Pricing Page `/pricing` 独立设置 title，如 "Maneki 会员定价 - 智能股票分析"。

### 3. 埋点

- Hero 区域停留时间（IntersectionObserver）
- 定价卡片曝光和 CTA 点击（点击事件监听）
- `/pricing` 页面访问来源（document.referrer）

---

## 测试检查清单

### 动画与视觉
- [ ] 首屏 Hero 占视口高度约 2/3（桌面端）
- [ ] Slogan 主标题 ≥ 48px，副标题 ≥ 18px
- [ ] CSS 动画在 3 秒内进入稳定循环，无卡顿
- [ ] 向下滚动时 Hero 与定价区域有平滑过渡

### 响应式
- [ ] 桌面端（≥1024px）定价卡片横向排列（3 列）
- [ ] 平板端（768-1023px）定价卡片横向排列（2 列）
- [ ] 手机端（<768px）定价卡片纵向堆叠（1 列），Slogan 字号缩小

### 交互
- [ ] 未登录用户点击 CTA 跳转 `/login`
- [ ] 已登录用户从首页 CTA 跳转 `/pricing`
- [ ] 已登录用户在 `/pricing` 看到当前等级高亮
- [ ] 定价卡片悬停有浮起/光晕反馈

### 可访问性
- [ ] macOS "减少动态效果"开启后，动画停止，内容可读
- [ ] 所有按钮可通过键盘 Tab 聚焦
- [ ] 颜色对比度符合 WCAG AA 标准

### 性能
- [ ] Lighthouse LCP ≤ 2.5s
- [ ] Lighthouse CLS ≤ 0.1
- [ ] 微信内置浏览器无白屏/报错
