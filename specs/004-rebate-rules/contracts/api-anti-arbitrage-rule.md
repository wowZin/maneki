# Contract: Anti-Arbitrage Rule API

**Feature**: 系统设置 - 返佣规则模块
**Base Path**: `/api/v1/admin/anti-arbitrage-rules`
**Auth**: Admin JWT required

## Endpoints

### List Anti-Arbitrage Rules

`GET /api/v1/admin/anti-arbitrage-rules`

**Query Parameters**:
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| status | string | No | `active`, `inactive` |
| strategy_type | string | No | `self_subscribe`, `ip_freq`, `new_user_threshold`, `linked_account` |

**Response 200**:
```json
{
  "data": [
    {
      "id": 1,
      "name": "同一IP频次限制",
      "strategy_type": "ip_freq",
      "rule_params": {
        "window_hours": 24,
        "max_count": 3
      },
      "action": "block",
      "status": "active",
      "priority": 10,
      "created_by": 1,
      "created_at": "2026-04-19T10:00:00Z",
      "updated_at": "2026-04-19T10:00:00Z"
    }
  ]
}
```

### Create Anti-Arbitrage Rule

`POST /api/v1/admin/anti-arbitrage-rules`

**Request Body**:
```json
{
  "name": "新用户订阅阈值",
  "strategy_type": "new_user_threshold",
  "rule_params": {
    "window_days": 7,
    "max_subscriptions": 10
  },
  "action": "review",
  "priority": 5
}
```

**Validation**:
- `name`: required, 1-128 chars
- `strategy_type`: required, enum
- `rule_params`: required, shape depends on strategy_type
- `action`: required, `block` or `review`
- `priority`: required, integer

**Response 201**:
Created rule object.

### Update Anti-Arbitrage Rule

`PUT /api/v1/admin/anti-arbitrage-rules/:id`

**Request Body**: Same as Create, all fields optional.

**Response 200**:
Updated rule object.

### Toggle Anti-Arbitrage Rule Status

`POST /api/v1/admin/anti-arbitrage-rules/:id/toggle`

**Request Body**:
```json
{
  "status": "inactive"
}
```

**Response 200**:
Updated rule object.

### Delete Anti-Arbitrage Rule

`DELETE /api/v1/admin/anti-arbitrage-rules/:id`

**Response 204**
