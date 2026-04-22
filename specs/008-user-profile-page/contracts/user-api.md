# User Profile API Contract

## GET /api/v1/users/me

获取当前登录用户的个人信息。

**Auth**: Bearer Token (required)

**Response 200**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "uuid",
    "nickname": "string",
    "avatar_url": "string | null",
    "phone": "string | null",
    "vip_level": 0 | 1 | 2,
    "vip_level_name": "string",
    "vip_level_color": "string",
    "vip_expire_at": "string | null",
    "created_at": "string"
  }
}
```

**Response 401**: 未登录或 Token 过期

---

## PUT /api/v1/users/me

修改当前用户昵称。

**Auth**: Bearer Token (required)

**Request Body**:
```json
{
  "nickname": "string (2-20 chars)"
}
```

**Response 200**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "uuid",
    "nickname": "string"
  }
}
```

**Response 400**: 昵称格式错误
**Response 409**: 昵称已被占用

---

## POST /api/v1/users/me/avatar

上传用户头像。

**Auth**: Bearer Token (required)
**Content-Type**: multipart/form-data

**Form Fields**:
- `file`: File (jpg/png, max 5MB)

**Response 200**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "avatar_url": "string"
  }
}
```

**Response 400**: 文件格式不支持或超过大小限制

---

## POST /api/v1/users/me/password

修改登录密码。

**Auth**: Bearer Token (required)

**Request Body**:
```json
{
  "old_password": "string",
  "new_password": "string (min 6 chars)",
  "confirm_password": "string"
}
```

**Response 200**:
```json
{
  "code": 0,
  "message": "密码修改成功"
}
```

**Response 400**: 参数校验失败（密码规则、两次输入不一致）
**Response 403**: 旧密码错误

---

## GET /api/v1/users/me/rebate

获取返佣汇总（仅 SVIP）。

**Auth**: Bearer Token (required)

**Response 200**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "total_rebate": 1234.56,
    "pending_rebate": 100.00,
    "settled_rebate": 1134.56,
    "currency": "¥"
  }
}
```

**Response 403**: 非 SVIP 用户无权访问
