# API Contracts: 用户认证

## Base URL

`/api/v1/auth`

---

## 1. 发送短信验证码

### POST /send-code

发送登录/注册用的短信验证码。

**Request:**
```json
{
  "phone": "13800138000"
}
```

**Response 200:**
```json
{
  "message": "验证码已发送"
}
```

**Response 429 (Rate Limited):**
```json
{
  "error": "请稍后再试",
  "code": "rate_limited_phone",
  "retry_after": 45
}
```

---

## 2. 短信验证码登录

### POST /login/phone

使用手机号 + 短信验证码登录。未注册手机号将自动创建账户。

**Request:**
```json
{
  "phone": "13800138000",
  "code": "123456"
}
```

**Response 200:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 1209600,
  "user": {
    "id": "...",
    "nickname": "138****8000",
    "phone": "13800138000",
    "avatar_url": "",
    "vip_level": 0,
    "vip_tier": "free",
    "is_vip": false,
    "is_superuser": false
  }
}
```

**Response 401 (Invalid/Expired Code):**
```json
{
  "error": "验证码错误，请重新输入",
  "code": "invalid_code"
}
```

**Cookies:**
- `access_token` (httpOnly, 14 days)
- `refresh_token` (httpOnly, 30 days)

---

## 3. 密码登录

### POST /login

使用手机号或昵称 + 密码登录。

**Request:**
```json
{
  "account": "13800138000",
  "password": "mypassword123"
}
```

> `account` 可以是手机号或昵称。

**Response 200:** 同短信登录成功响应

**Response 401:**
```json
{
  "error": "账号或密码错误"
}
```

**Response 423 (Account Locked):**
```json
{
  "error": "登录失败次数过多，账号已锁定，请5分钟后再试",
  "retry_after": "5分钟"
}
```

---

## 4. 用户注册

### POST /register

显式注册新账户。

**Request:**
```json
{
  "nickname": "我的昵称",
  "phone": "13800138000",
  "password": "mypassword123",
  "confirm_password": "mypassword123"
}
```

**Response 201:** 同登录成功响应（自动登录）

**Response 409 (Duplicate):**
```json
{
  "error": "该手机号已被注册"
}
```
或
```json
{
  "error": "该昵称已被使用"
}
```

**Response 400 (Password Mismatch):**
```json
{
  "error": "两次输入的密码不一致"
}
```

**Response 400 (Weak Password):**
```json
{
  "error": "密码至少8位，且必须同时包含字母和数字"
}
```

---

## 5. 退出登录

### POST /logout

清除登录状态（Cookie + Token 黑名单）。

**Request:** 无需 body，依赖 Cookie 中的 access_token。

**Response 200:**
```json
{
  "message": "logged out successfully"
}
```

---

## 6. 刷新 Token

### POST /refresh

使用 refresh_token 获取新的 access_token。

**Request:**
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response 200:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 1209600
}
```

---

## 7. 获取当前用户信息

### GET /me

**Headers:** `Authorization: Bearer {access_token}` 或自动携带 Cookie。

**Response 200:**
```json
{
  "id": "...",
  "nickname": "我的昵称",
  "phone": "13800138000",
  "avatar_url": "",
  "vip_level": 0,
  "vip_tier": "free",
  "is_vip": false,
  "is_superuser": false
}
```

---

## 8. 设置/修改密码

### POST /password

已登录用户设置或修改密码。短信自动注册用户首次设置密码时无需旧密码；已设置过密码的用户需提供旧密码。

**Request:**
```json
{
  "old_password": "",          // 首次设置可为空
  "new_password": "newpass123",
  "confirm_password": "newpass123"
}
```

**Response 200:**
```json
{
  "message": "密码设置成功"
}
```

**Response 403 (Wrong Old Password):**
```json
{
  "error": "旧密码错误"
}
```

---

## 通用错误格式

所有 4xx/5xx 错误统一返回：

```json
{
  "error": "人类可读的错误描述"
}
```

部分错误包含 `code` 字段供前端做特定处理（如 `rate_limited_phone`, `invalid_code`, `code_expired`）。
