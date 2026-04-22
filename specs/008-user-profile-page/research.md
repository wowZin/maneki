# Research: 用户端个人信息页面

## Decision: 前端技术栈沿用现有用户端项目

- **Rationale**: 用户端项目 (`apps/web`) 已使用 React 18 + TypeScript + Vite + Ant Design 5 + Zustand，个人信息页作为用户端功能，直接复用现有技术栈
- **Alternatives considered**: 引入新 UI 库（如 shadcn/ui）—  rejected，增加维护成本且无必要

## Decision: 头像上传采用前端直传 OSS 预签名 URL 方案

- **Rationale**: 减少后端带宽压力，上传速度快，符合行业标准
- **Flow**: 前端请求后端获取预签名 URL → 前端直传 OSS → 后端回调/前端告知上传完成
- **Alternatives considered**: 前端传 Base64 给后端再转存 — rejected，增加后端压力和请求体积

## Decision: 密码修改表单使用独立 Modal，非页面内联

- **Rationale**: 密码修改是低频安全操作，独立 Modal 减少页面视觉复杂度，符合 Ant Design 表单最佳实践
- **Alternatives considered**: 页面内展开表单 — rejected，占用常驻空间且干扰主要信息展示

## Decision: 返佣金额区域条件渲染，非 SVIP 完全移除 DOM

- **Rationale**: 避免非 SVIP 用户看到空白占位或提示升级，直接移除 DOM 更干净
- **Alternatives considered**: 展示灰色锁定状态提示升级 — rejected，产品策略上暂不引导升级，保持页面简洁
