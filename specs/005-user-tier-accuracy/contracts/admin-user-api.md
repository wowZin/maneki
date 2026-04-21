# Contract: Admin User Management API

## Base URL

All endpoints are prefixed with `/v1/admin` and require admin authentication.

## Endpoints

### GET /v1/admin/users

List users with filtering, pagination and sorting.

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| page | int | No | Page number, default 1 |
| page_size | int | No | Items per page, default 20, max 100 |
| keyword | string | No | Search by email, username, nickname or phone |
| vip_levels | string | No | Comma-separated VIP levels, e.g. `1,2` |
| sort_by | string | No | Sort field: `created_at` (default), `accuracy` |
| sort_order | string | No | `desc` (default) or `asc`. Only effective when `sort_by` is set. |

#### Response 200

```json
{
  "data": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "username": "john",
      "nickname": "John",
      "phone": "13800138000",
      "avatar_url": "https://...",
      "is_active": true,
      "vip_level": 1,
      "vip_level_label": "VIP",
      "board_accuracy": 82.50,
      "register_source": "email",
      "created_at": "2026-04-21 10:00:00",
      "updated_at": "2026-04-21 10:00:00"
    }
  ],
  "total": 150,
  "page": 1,
  "size": 20
}
```

### GET /v1/admin/users/:id

Get detailed user information including associated Agent data.

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | uuid | Yes | User ID |

#### Response 200

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "username": "john",
  "nickname": "John",
  "phone": "13800138000",
  "avatar_url": "https://...",
  "is_active": true,
  "is_superuser": false,
  "is_verified": true,
  "vip_level": 1,
  "vip_level_label": "VIP",
  "vip_expire_at": "2027-04-21T00:00:00Z",
  "board_accuracy": 82.50,
  "register_source": "email",
  "created_at": "2026-04-21 10:00:00",
  "updated_at": "2026-04-21 10:00:00",
  "agents": [
    {
      "agent_id": 1,
      "agent_name": "打板先锋",
      "agent_type": "technical",
      "subscription_status": "active",
      "subscription_end_date": "2027-04-21T00:00:00Z",
      "weight": 1.20,
      "is_weight_enabled": true,
      "agent_rating": 4.5,
      "agent_use_count": 128
    }
  ]
}
```

#### Response 404

```json
{
  "error": "user not found"
}
```

## Error Codes

| HTTP Status | Error Message | Condition |
|-------------|---------------|-----------|
| 400 | invalid user id | Malformed UUID |
| 401 | unauthorized | Missing or invalid admin token |
| 403 | forbidden | Non-admin user accessing admin endpoint |
| 404 | user not found | User ID does not exist |
| 500 | failed to fetch users | Internal server error |

## Changelog

- **2026-04-21**: Added `vip_levels`, `sort_by`, `sort_order` query params to list endpoint. Added `vip_level_label`, `board_accuracy` to list response. Added `agents` array to detail response.
