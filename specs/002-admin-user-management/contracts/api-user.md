# Contract: User Management API

**Access**: All Admin (role == `super` or `admin`)

## Base URL

`/api/v1/admin/users`

## Endpoints

### GET /api/v1/admin/users

获取普通用户列表。支持分页、搜索、筛选。

**Query Parameters**:
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| page | int | No | 页码，默认 1 |
| page_size | int | No | 每页条数，默认 20，最大 100 |
| keyword | string | No | 按用户名或手机号模糊搜索 |
| is_active | bool | No | 按状态筛选 |

**Response 200**:
```json
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": 1,
        "name": "张三",
        "phone": "138****8888",
        "is_active": true,
        "created_at": "2026-04-01T10:00:00Z",
        "last_login_at": "2026-04-19T08:00:00Z"
      }
    ],
    "total": 100,
    "page": 1,
    "page_size": 20
  }
}
```

**Notes**:
- 手机号在列表中脱敏展示

---

### GET /api/v1/admin/users/:id

获取用户详情。

**Response 200**:
```json
{
  "code": 0,
  "data": {
    "id": 1,
    "name": "张三",
    "phone": "13812348888",
    "email": "zhangsan@example.com",
    "avatar": "https://cdn.example.com/avatar/1.jpg",
    "is_active": true,
    "force_change_password": false,
    "created_at": "2026-04-01T10:00:00Z",
    "updated_at": "2026-04-10T10:00:00Z",
    "last_login_at": "2026-04-19T08:00:00Z"
  }
}
```

---

### POST /api/v1/admin/users/:id/disable

禁用用户。

**Response 200**:
```json
{
  "code": 0,
  "data": null
}
```

---

### POST /api/v1/admin/users/:id/enable

启用用户。

**Response 200**:
```json
{
  "code": 0,
  "data": null
}
```

---

### POST /api/v1/admin/users/:id/reset-password

重置用户密码。系统生成随机密码，用户下次登录需强制修改。

**Response 200**:
```json
{
  "code": 0,
  "data": {
    "temp_password": "aB3#x9Km"
  }
}
```

**Notes**:
- 重置密码后 `force_change_password` 设为 true
- 临时密码仅在此响应中返回一次，需管理员告知用户
