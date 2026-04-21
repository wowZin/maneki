# Contract: Auth API

## Base URL

`/api/v1/admin/auth`

## Endpoints

### POST /api/v1/admin/auth/login

管理员登录。

**Request**:
```json
{
  "name": "admin001",
  "password": "111111"
}
```

**Response 200**:
```json
{
  "code": 0,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "admin": {
      "id": 1,
      "name": "admin001",
      "role": "admin",
      "force_change_password": true
    }
  }
}
```

**Response 401**:
```json
{
  "code": 1001,
  "message": "账号或密码错误"
}
```

**Notes**:
- Token 有效期 30 分钟
- Token 包含 claims: `sub` (admin_id), `name`, `role`, `jti`, `iat`, `exp`
- 若 `force_change_password` 为 true，前端应跳转到强制改密页

---

### POST /api/v1/admin/auth/logout

管理员登出。需要 Authorization header。

**Headers**:
```
Authorization: Bearer <token>
```

**Response 200**:
```json
{
  "code": 0,
  "data": null
}
```

**Notes**:
- 服务端将 token jti 写入 Redis 黑名单

---

### POST /api/v1/admin/auth/change-password

修改当前登录管理员的密码。需要 Authorization header。

**Request**:
```json
{
  "old_password": "111111",
  "new_password": "newSecurePwd123"
}
```

**Response 200**:
```json
{
  "code": 0,
  "data": null
}
```

**Response 400**:
```json
{
  "code": 1002,
  "message": "旧密码不正确"
}
```

**Notes**:
- 成功后服务端将当前 token 加入黑名单，要求重新登录
