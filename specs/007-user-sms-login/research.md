# Research: 用户手机号登录（号码认证 + 短信验证码）

**Feature**: 用户手机号登录
**Date**: 2026-04-22

## 决策记录

### 1. 登录通道方案：号码认证为主，短信验证码兜底

**Decision**: 采用「阿里云号码认证（本机号码校验）」作为主要登录通道，「阿里云短信验证码」作为 fallback 兜底方案。

**Rationale**:
- 用户明确使用阿里云号码认证服务（时序图所示的 `PhoneNumberServer` / `GetAuthToken` / `VerifyPhoneWithToken` 流程）
- 号码认证体验更优：用户输入手机号后点击验证，通过运营商网关直接校验是否为本机号码，无需等待短信、无需手动输入验证码
- 号码认证成本更低：按次计费，通常比短信便宜
- **但必须保留短信验证码 fallback**，因为号码认证有环境限制：
  - 必须在手机浏览器中使用（依赖蜂窝网络网关）
  - PC 端浏览器、平板 WiFi 环境、部分运营商网络下可能无法使用
  - 阿里云 SDK `checkAuthAvailable` 会返回当前环境是否支持号码认证
- 前端先调用 `checkAuthAvailable` 判断环境，支持则走号码认证，不支持则自动降级为短信验证码

**Alternatives considered**:
- 仅号码认证：无法覆盖 PC 端和 WiFi 场景，不可接受
- 仅短信验证码：与用户提供的阿里云号码认证架构冲突，且体验不如号码认证

---

### 2. 阿里云号码认证技术方案

**Decision**: 后端封装阿里云号码认证 OpenAPI，前端引入阿里云 H5 SDK

**Rationale**:
- 后端职责：
  1. 调用阿里云 `GetAuthToken` 获取 `accessToken` + `jwtToken`
  2. 将 Token 返回给前端
  3. 接收前端提交的 `spToken` + `phone`，调用阿里云 `VerifyPhoneWithToken` 验证
  4. 验证通过后完成登录/自动注册
- 前端职责：
  1. 引入阿里云 `phone-number-server` H5 SDK（`<script>` 或 npm）
  2. 初始化 `new PhoneNumberServer({...})`
  3. 从后端获取 Token，调用 SDK `checkAuthAvailable` 鉴权
  4. 调用 SDK `getVerifyToken` 获取 `spToken`
  5. 将 `spToken` + `phone` 提交给后端验证
- 阿里云 Go SDK（`github.com/alibabacloud-go/dypnsapi-20170525`）或直接用 HTTP 调用 OpenAPI

**Alternatives considered**:
- 纯后端完成所有流程：阿里云号码认证要求前端 SDK 与运营商网关交互，无法纯后端完成
- 前端直接调阿里云 API：不安全，AccessKey 会暴露在前端

---

### 3. 短信验证码方案（Fallback）

**Decision**: 当号码认证不可用时，降级为阿里云短信验证码

**Rationale**:
- 与号码认证同属阿里云生态，账号和签名模板可共用
- 开发环境提供 Mock 实现，避免真实发送短信
- Redis 存储验证码 + 频率限制，与原有架构一致

**实现要点**:
- Redis Key: `sms:login:{phone}`，Value: 6 位数字，TTL: 300s
- 频率限制: `sms:limit:phone:{phone}` TTL 60s，`sms:limit:ip:{ip}` 每分钟 10 次
- 短信模板："您的验证码是 ${code}，5 分钟内有效"

---

### 4. 登录凭证方案

**Decision**: 完全复用现有 JWT 体系（access_token + refresh_token + httpOnly Cookie）

**Rationale**:
- 后端已有成熟的 JWT 生成、解析、刷新、黑名单机制
- 无论号码认证还是短信验证码，验证成功后的凭证发放与现有邮箱/密码登录完全一致
- 前端 auth store 无需改动

---

### 5. 前端登录页交互设计

**Decision**: 在现有登录页面增加 "账号密码登录 / 手机号登录" Tab 切换。手机号登录页内优先尝试号码认证，不支持时显示短信验证码输入框。

**Rationale**:
- 不新增独立路由
- 用户无感切换：进入手机号登录页后，前端自动检测环境并选择最佳验证方式
- 若支持号码认证：显示「一键验证」按钮，点击后输入手机号直接验证
- 若不支持号码认证：显示「获取验证码」按钮 + 验证码输入框，走传统短信流程
- 保留微信一键登录按钮

---

### 6. 自动注册策略

**Decision**: 手机号验证成功后，若该手机号未注册则自动创建用户账户

**Rationale**:
- 简化用户流程，无需先注册再登录
- 新用户字段：`phone` = 手机号，`register_source` = `"phone"`，`nickname` 默认隐藏版手机号，`username` 使用手机号
- 用户后续可在个人中心补全邮箱、设置密码

---

### 7. 安全与防刷策略

**Decision**: 三层防护
1. **号码认证层面**：阿里云 SDK 自带运营商网关安全校验，难以伪造
2. **短信频率限制**：60 秒防重发 + IP 限流（仅 fallback 到短信时生效）
3. **接口通用防护**：后端对 `/auth/phone/*` 接口启用现有 rate limit 中间件

