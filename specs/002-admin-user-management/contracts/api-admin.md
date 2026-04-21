# Contract: Admin Management API

**Access**: Super Admin only (role == `super`)

## Base URL

`/api/v1/admin/admins`

## Endpoints

### GET /api/v1/admin/admins

获取管理员列表。支持分页和搜索。

**Query Parameters**:
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| page | int | No | 页码，默认 1 |
| page_size | int | No | 每页条数，默认 20，最大 100 |
| keyword | string | No | 按账户名称模糊搜索 |

**Response 200**:
```json
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": 1,
        "name": "superadmin",
        "role": "super",
        "is_active": true,
        "created_at": "2026-04-19T10:00:00Z",
        "last_login_at": "2026-04-19T12:00:00Z"
      }
    ],
    "total": 1,
    "page": 1,
    "page_size": 20
  }
}
```

---

### POST /api/v1/admin/admins

创建普通管理员。初始密码固定为 `111111`。

**Request**:
```json
{
  "name": "admin002"
}
```

**Response 201**:
```json
{
  "code": 0,
  "data": {
    "id": 2,
    "name": "admin002",
    "role": "admin",
    "is_active": true,
    "created_at": "2026-04-19T10:00:00Z"
  }
}
```

**Response 409**:
```json
{
  "code": 1003,
  "message": "账户名称已存在"
}
```

---

### POST /api/v1/admin/admins/:id/disable

禁用管理员。

**Response 200**:
```json
{
  "code": 0,
  "data": null
}
```

**Response 403**:
```json
{
  "code": 1004,
  "message": "不能禁用最后一个启用的超级管理员"
}
```

**Response 404**:
```json
{
  "code": 1005,
  "message": "管理员不存在"
}
```

---

### POST /api/v1/admin/admins/:id/enable

启用管理员。

**Response 200**:
```json
{
  "code": 0,
  "data": null
}
```
