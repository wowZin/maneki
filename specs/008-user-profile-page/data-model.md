# Data Model: 用户端个人信息页面

## Entities

### UserProfile (用户个人信息)

用于个人信息页展示的基础数据。

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | UUID | Yes | 用户唯一标识 |
| nickname | string | Yes | 账户名称/昵称 |
| avatar_url | string | No | 头像 URL，为空时展示默认头像 |
| phone | string | No | 手机号，展示时脱敏处理 |
| vip_level | int | Yes | 用户等级数值 (0=普通, 1=VIP, 2=SVIP) |
| vip_level_name | string | Yes | 等级展示名称（从字典表读取） |
| vip_level_color | string | Yes | 等级 Tag 颜色（从字典表读取） |
| vip_expire_at | string | No | VIP 过期时间，ISO 8601 格式 |
| created_at | string | Yes | 注册时间 |

### RebateSummary (返佣汇总，仅 SVIP)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| total_rebate | decimal | Yes | 累计返佣金额 |
| pending_rebate | decimal | Yes | 待结算返佣金额 |
| settled_rebate | decimal | Yes | 已结算返佣金额 |
| currency | string | Yes | 货币符号，默认 CNY |

### PasswordChangeRequest (密码修改请求)

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| old_password | string | Yes | 当前密码，后端验证 |
| new_password | string | Yes | 最少 6 位，需包含字母和数字 |
| confirm_password | string | Yes | 必须与 new_password 一致 |

### NicknameUpdateRequest (昵称修改请求)

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| nickname | string | Yes | 2-20 字符，支持中文/字母/数字/下划线 |

### AvatarUploadRequest (头像上传请求)

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| file | File | Yes | jpg/png，最大 5MB |

## API Endpoints

### GET /api/v1/users/me
获取当前登录用户个人信息。

**Response**:
```json
{
  "code": 0,
  "data": {
    "id": "uuid",
    "nickname": "用户名",
    "avatar_url": "https://...",
    "phone": "138****5678",
    "vip_level": 1,
    "vip_level_name": "VIP",
    "vip_level_color": "blue",
    "vip_expire_at": "2026-12-31T23:59:59+08:00",
    "created_at": "2026-01-01T00:00:00+08:00"
  }
}
```

### PUT /api/v1/users/me
修改当前用户基本信息（昵称）。

**Request Body**:
```json
{
  "nickname": "新昵称"
}
```

### POST /api/v1/users/me/avatar
上传头像，返回新头像 URL。

**Request**: multipart/form-data, field `file`

**Response**:
```json
{
  "code": 0,
  "data": {
    "avatar_url": "https://..."
  }
}
```

### POST /api/v1/users/me/password
修改登录密码。

**Request Body**:
```json
{
  "old_password": "当前密码",
  "new_password": "新密码",
  "confirm_password": "确认新密码"
}
```

### GET /api/v1/users/me/rebate
获取返佣汇总（仅 SVIP 可访问，其他等级返回 403 或空数据）。

**Response**:
```json
{
  "code": 0,
  "data": {
    "total_rebate": 1234.56,
    "pending_rebate": 100.00,
    "settled_rebate": 1134.56,
    "currency": "¥"
  }
}
```
