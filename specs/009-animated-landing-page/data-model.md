# Data Model: 灵动欢迎页

**Feature**: 灵动欢迎页（Landing Page）
**Date**: 2026-04-23

---

## Entity: PricingTier

定价层级，定义会员权益和价格。

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | Yes | 层级唯一标识，如 `free`, `vip`, `svip` |
| name | string | Yes | 显示名称，如 "免费体验", "VIP 会员" |
| monthlyPrice | number | Yes | 月付价格（元），免费 tier 为 0 |
| yearlyPrice | number | Yes | 年付价格（元），通常月付 × 10 |
| description | string | No | 一句话描述，如 "适合初学者体验" |
| features | FeatureItem[] | Yes | 权益列表 |
| ctaText | string | Yes | 按钮文案，如 "立即体验", "立即开通" |
| highlight | boolean | No | 是否推荐（中间卡片高亮） |
| badge | string | No | 角标文案，如 "最受欢迎" |

### FeatureItem

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| text | string | Yes | 权益描述，如 "每日 3 条 AI 信号" |
| included | boolean | Yes | 是否包含 |
| tooltip | string | No | 悬停提示详细说明 |

---

## Entity: UserSubscriptionSummary

用户订阅状态摘要，用于 `/pricing` 页面顶部展示。

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| currentTierId | string | Yes | 当前 tier id，如 `free` |
| currentTierName | string | Yes | 当前 tier 显示名称 |
| expiresAt | string | No | 到期时间 ISO 字符串，无则为 null |
| isExpired | boolean | Yes | 是否已过期 |
| upgradeTarget | string | No | 可升级的下一个 tier id |

---

## 数据来源

- **PricingTier**: 前端静态配置 `apps/web/src/config/pricing.ts`（初始版本）。
- **UserSubscriptionSummary**: 从现有 `GET /api/v1/auth/users/me` 响应中的 `vip_level`, `vip_expire_at` 字段映射。
