# API Contracts: 007 用户认证

## Base URL

- Development: `http://localhost:8080/api/v1/client`
- Production: `https://api.maneki.cn/api/v1/client`

## Authentication

All protected endpoints require `Authorization: Bearer <access_token>` header.

---

## 1. Account Password Login

### POST /auth/login

Login with username/email and password.

**Request Body:**
```json
{
  "username": "string",  // username or email
  "password": "string"
}
```

**Response (200):**
```json
{
  "access_token": "string",
  "token_type": "bearer"
}
```

**Error Responses:**
- `401 Unauthorized`: Invalid username or password
- `429 Too Many Requests`: Rate limited

---

## 2. Phone SMS Login

### POST /auth/phone/send-code

Send SMS verification code to phone number.

**Request Body:**
```json
{
  "phone": "13800138000"
}
```

**Response (200):**
```json
{
  "message": "验证码已发送"
}
```

**Error Responses:**
- `429 Too Many Requests`: Rate limited (phone or IP)

### POST /auth/phone/login-by-code

Login with phone number and SMS code.

**Request Body:**
```json
{
  "phone": "13800138000",
  "code": "123456"
}
```

**Response (200):**
```json
{
  "access_token": "string",
  "refresh_token": "string",
  "token_type": "bearer",
  "expires_in": 7200,
  "user": {
    "id": "uuid",
    "username": "string",
    "nickname": "string",
    "phone": "string",
    "avatar_url": "string",
    "vip_level": 0,
    "vip_tier": "basic"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid code or code expired

---

## 3. Phone Number Authentication (PNS)

### POST /auth/phone/token

Get authentication token for PNS SDK.

**Response (200):**
```json
{
  "access_token": "string",
  "jwt_token": "string",
  "expire_time": 1714032000
}
```

### POST /auth/phone/verify

Verify phone with PNS spToken.

**Request Body:**
```json
{
  "phone": "13800138000",
  "sp_token": "string"
}
```

**Response (200):** Same as SMS login success response.

---

## 4. User Registration

### POST /auth/register

Register a new account with username, email, and password.

**Request Body:**
```json
{
  "username": "string",
  "email": "user@example.com",
  "password": "string",
  "full_name": "string"  // optional
}
```

**Validation Rules:**
- `username`: 3-20 chars, alphanumeric and underscore only, unique
- `email`: valid email format, unique
- `password`: min 8 chars, must contain both letters and numbers

**Response (201):**
```json
{
  "id": "uuid",
  "username": "string",
  "email": "string",
  "message": "注册成功"
}
```

**Error Responses:**
- `400 Bad Request`: Validation failed (username/email exists, password too weak)

---

## 5. Forgot Password

### POST /auth/forgot-password/send-code

Send SMS code for password reset.

**Request Body:**
```json
{
  "phone": "13800138000"
}
```

**Response (200):** Same as `/auth/phone/send-code`

### POST /auth/forgot-password/reset

Reset password with phone verification.

**Request Body:**
```json
{
  "phone": "13800138000",
  "code": "123456",
  "new_password": "string"
}
```

**Validation Rules:**
- `new_password`: min 8 chars, must contain both letters and numbers

**Response (200):**
```json
{
  "message": "密码重置成功",
  "access_token": "string",
  "token_type": "bearer"
}
```

**Error Responses:**
- `400 Bad Request`: Invalid code or password too weak

---

## 6. Get Current User

### GET /auth/me

Get current authenticated user info.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "id": "uuid",
  "username": "string",
  "email": "string",
  "phone": "string",
  "nickname": "string",
  "avatar_url": "string",
  "vip_level": 0,
  "vip_tier": "basic",
  "is_active": true,
  "is_verified": true
}
```

---

## 7. Logout

### POST /auth/logout

Logout current user (client-side token removal). Server may blacklist token if implemented.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "message": "已退出登录"
}
```
