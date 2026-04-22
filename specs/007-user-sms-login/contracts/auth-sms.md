# Interface Contract: 短信验证码登录

**Feature**: 用户短信验证码登录
**Base Path**: `/api/v1/auth/sms`
**Date**: 2026-04-22

## Endpoints

### 1. 发送验证码

```http
POST /api/v1/auth/sms/send-code
Content-Type: application/json
```

**Request Body**:

```json
{
  "phone": "13800138000"
}
```

**Validation Rules**:
- `phone`: required, 必须匹配中国大陆手机号格式 `^1[3-9]\d{9}$`

**Success Response (200)**:

```json
{
  "message": "验证码已发送"
}
```

**Error Responses**:

| Status | Error | Message |
|--------|-------|---------|
| 400 | invalid_phone | 请输入有效的手机号 |
| 429 | rate_limited_phone | 请 45 秒后再试（倒计时剩余秒数） |
| 429 | rate_limited_ip | 操作过于频繁，请稍后再试 |
| 500 | sms_send_failed | 短信发送失败，请稍后重试 |

---

### 2. 验证码登录

```http
POST /api/v1/auth/sms/login
Content-Type: application/json
```

**Request Body**:

```json
{
  "phone": "13800138000",
  "code": "123456"
}
```

**Validation Rules**:
- `phone`: required, 同上手机号格式
- `code`: required, 6 位数字

**Success Response (200)**:

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 1209600,
  "user": {
    "id": "uuid",
    "email": "",
    "username": "13800138000",
    "nickname": "138****8000",
    "avatar_url": "",
    "vip_level": 0,
    "vip_tier": "free",
    "is_vip": false,
    "is_superuser": false
  }
}
```

> 注意：响应格式与现有 `/api/v1/auth/login` 完全一致，复用 `TokenResponse` 结构。

**Error Responses**:

| Status | Error | Message |
|--------|-------|---------|
| 400 | invalid_request | 请求参数错误（phone/code 格式不符） |
| 401 | invalid_code | 验证码错误或已过期 |
| 403 | account_disabled | 账号已被禁用，请联系客服 |
| 500 | token_generation_failed | 登录失败，请稍后重试 |

---

### 3. 登出（复用现有接口）

```http
POST /api/v1/auth/logout
Authorization: Bearer {token}
```

复用现有登出接口，清除 Cookie 和 Token。

---

## 前端 API 封装

```typescript
// apps/web/src/services/api.ts 新增

export interface SendCodeData {
  phone: string
}

export interface SMSLoginData {
  phone: string
  code: string
}

export const authApi = {
  // ... 现有方法

  // 发送短信验证码
  sendSMSCode: async (data: SendCodeData) => {
    const response = await api.post('/auth/sms/send-code', data)
    return response.data
  },

  // 短信验证码登录
  smsLogin: async (data: SMSLoginData): Promise<TokenResponse> => {
    const response = await api.post('/auth/sms/login', data)
    return response.data
  },
}
```

## Cookie / Token 机制

与现有登录完全一致：

- 后端设置 2 个 httpOnly Cookie：`access_token`（14 天）、`refresh_token`（按配置）
- 前端同时将 `access_token` 存入 Zustand store 和 localStorage（`maneki-auth-storage`）
- 后续请求通过 Axios 拦截器自动注入 `Authorization: Bearer {token}` Header
- 401 响应触发自动登出并跳转登录页
