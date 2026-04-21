# Contract: Rebate Rule API

**Feature**: 系统设置 - 返佣规则模块
**Base Path**: `/api/v1/admin/rebate-rules`
**Auth**: Admin JWT required

## Endpoints

### List Rebate Rules

`GET /api/v1/admin/rebate-rules`

**Query Parameters**:
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| page | int | No | Default: 1 |
| page_size | int | No | Default: 20, Max: 100 |
| status | string | No | Filter by status: `active`, `inactive` |
| agent_id | int | No | Filter by specific agent |

**Response 200**:
```json
{
  "data": [
    {
      "id": 1,
      "name": "默认全局规则",
      "unit_price": "5.00",
      "agent_id": null,
      "agent_name": null,
      "start_at": "2026-01-01T00:00:00Z",
      "end_at": "2026-12-31T23:59:59Z",
      "status": "active",
      "created_by": 1,
      "created_by_name": "超级管理员",
      "created_at": "2026-01-01T00:00:00Z",
      "updated_at": "2026-01-01T00:00:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "page_size": 20
}
```

### Get Rebate Rule Detail

`GET /api/v1/admin/rebate-rules/:id`

**Response 200**:
```json
{
  "id": 1,
  "name": "默认全局规则",
  "unit_price": "5.00",
  "agent_id": null,
  "start_at": "2026-01-01T00:00:00Z",
  "end_at": "2026-12-31T23:59:59Z",
  "status": "active",
  "incentive_rules": [
    {
      "id": 1,
      "range_start": 1,
      "range_end": 10,
      "coefficient": "1.00"
    },
    {
      "id": 2,
      "range_start": 11,
      "range_end": 50,
      "coefficient": "1.20"
    }
  ],
  "created_by": 1,
  "created_at": "2026-01-01T00:00:00Z",
  "updated_at": "2026-01-01T00:00:00Z"
}
```

### Create Rebate Rule

`POST /api/v1/admin/rebate-rules`

**Request Body**:
```json
{
  "name": "VIP Agent 规则",
  "unit_price": "10.00",
  "agent_id": 5,
  "start_at": "2026-04-20T00:00:00Z",
  "end_at": "2026-12-31T23:59:59Z",
  "incentive_rules": [
    {
      "range_start": 1,
      "range_end": 10,
      "coefficient": "1.00"
    },
    {
      "range_start": 11,
      "range_end": null,
      "coefficient": "1.50"
    }
  ]
}
```

**Validation**:
- `name`: required, 1-128 chars
- `unit_price`: required, >= 0
- `start_at` < `end_at`
- If `agent_id` is null and another global rule is active → 409 Conflict
- If `agent_id` is set and that agent already has an active rule in the time range → 409 Conflict
- `incentive_rules`: optional; if provided, intervals must be continuous starting from 1, no gaps/overlaps

**Response 201**:
```json
{
  "id": 2,
  "name": "VIP Agent 规则",
  "unit_price": "10.00",
  "agent_id": 5,
  "start_at": "2026-04-20T00:00:00Z",
  "end_at": "2026-12-31T23:59:59Z",
  "status": "active",
  "created_at": "2026-04-19T10:00:00Z"
}
```

### Update Rebate Rule

`PUT /api/v1/admin/rebate-rules/:id`

**Request Body**:
Same as Create, but all fields optional. Cannot change `agent_id` if rule has associated rebate records.

**Response 200**:
Updated rule object.

### Toggle Rebate Rule Status

`POST /api/v1/admin/rebate-rules/:id/toggle`

**Request Body**:
```json
{
  "status": "inactive"
}
```

**Response 200**:
Updated rule object.

### Delete Rebate Rule

`DELETE /api/v1/admin/rebate-rules/:id`

**Constraints**: Only allowed if no rebate records reference this rule.

**Response 204**
