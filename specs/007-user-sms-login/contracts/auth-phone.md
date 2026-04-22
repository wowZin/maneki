# Interface Contract: 手机号登录（号码认证 + 短信验证码）

**Feature**: 用户手机号登录
**Base Path**: `/api/v1/auth/phone`
**Date**: 2026-04-22

## Endpoints

### 1. 获取号码认证 Token

后端调用阿里云 `GetAuthToken` 获取 Token，返回给前端用于 SDK 初始化。

```http
POST /api/v1/auth/phone/token
Content-Type: application/json
```

**Request Body**: 无（或可选携带 `scene` 场景标识）

**Success Response (200)**:

```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "jwt_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "expire_time": 300
}
```

**Error Responses**:

| Status | Error | Message |
|--------|-------|---------|
| 500 | token_fetch_failed | 认证服务暂不可用，请稍后重试 |

---

### 2. 号码认证登录

前端通过阿里云 H5 SDK 完成 `checkAuthAvailable` → `getVerifyToken` 后，将 `spToken` 和用户输入的手机号提交给后端。后端调用阿里云 `VerifyPhoneWithToken` 完成校验，通过后执行登录/自动注册。

```http
POST /api/v1/auth/phone/verify
Content-Type: application/json
```

**Request Body**:

```json
{
  "phone": "13800138000",
  "sp_token": "AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyAhIiMkJSYnKCkqKywtLi8wMTIzNDU2Nzg5Ojs8PT4/QEFCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaW1xdXl9gYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXp7fH1+fw=="
}
```

**Validation Rules**:
- `phone`: required, 必须匹配中国大陆手机号格式 `^1[3-9]\d{9}$`
- `sp_token`: required, string, 由阿里云 H5 SDK 的 `getVerifyToken` 返回

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
| 400 | invalid_request | 请求参数错误（phone/sp_token 格式不符） |
| 401 | verification_failed | 手机号验证失败，请检查后重试 |
| 403 | account_disabled | 账号已被禁用，请联系客服 |
| 500 | token_generation_failed | 登录失败，请稍后重试 |

---

### 3. 发送短信验证码（Fallback）

当号码认证不可用时，前端调用此接口发送短信验证码。

```http
POST /api/v1/auth/phone/send-code
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
| 429 | rate_limited_phone | 请 45 秒后再试 |
| 429 | rate_limited_ip | 操作过于频繁，请稍后再试 |
| 500 | sms_send_failed | 短信发送失败，请稍后重试 |

---

### 4. 短信验证码登录（Fallback）

```http
POST /api/v1/auth/phone/login-by-code
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

与「号码认证登录」成功响应完全一致。

**Error Responses**:

| Status | Error | Message |
|--------|-------|---------|
| 400 | invalid_request | 请求参数错误 |
| 401 | invalid_code | 验证码错误或已过期 |
| 403 | account_disabled | 账号已被禁用，请联系客服 |
| 500 | token_generation_failed | 登录失败，请稍后重试 |

---

### 5. 登出（复用现有接口）

```http
POST /api/v1/auth/logout
Authorization: Bearer {token}
```

复用现有登出接口，清除 Cookie 和 Token。

---

## 前端 API 封装

```typescript
// apps/web/src/services/api.ts 新增

export interface PhoneTokenResponse {
  access_token: string
  jwt_token: string
  expire_time: number
}

export interface PhoneVerifyData {
  phone: string
  sp_token: string
}

export interface SendCodeData {
  phone: string
}

export interface CodeLoginData {
  phone: string
  code: string
}

export const authApi = {
  // ... 现有方法

  // 获取号码认证 Token
  getPhoneAuthToken: async (): Promise<PhoneTokenResponse> => {
    const response = await api.post('/auth/phone/token')
    return response.data
  },

  // 号码认证登录
  verifyPhone: async (data: PhoneVerifyData): Promise<TokenResponse> => {
    const response = await api.post('/auth/phone/verify', data)
    return response.data
  },

  // 发送短信验证码
  sendSMSCode: async (data: SendCodeData) => {
    const response = await api.post('/auth/phone/send-code', data)
    return response.data
  },

  // 短信验证码登录
  loginByCode: async (data: CodeLoginData): Promise<TokenResponse> => {
    const response = await api.post('/auth/phone/login-by-code', data)
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
