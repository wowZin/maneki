# Contract: Rebate Record API

**Feature**: 系统设置 - 返佣规则模块
**Base Path**: `/api/v1/admin/rebate-records`
**Auth**: Admin JWT required

## Endpoints

### List Rebate Records

`GET /api/v1/admin/rebate-records`

**Query Parameters**:
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| page | int | No | Default: 1 |
| page_size | int | No | Default: 20, Max: 100 |
| status | string | No | `pending`, `settled`, `blocked`, `reviewing`, `refunded` |
| agent_id | int | No | Filter by agent |
| creator_id | int | No | Filter by creator |
| start_date | date | No | Filter by created_at >= |
| end_date | date | No | Filter by created_at <= |

**Response 200**:
```json
{
  "data": [
    {
      "id": 1,
      "subscription_id": 1001,
      "agent_id": 5,
      "agent_name": "智能选股助手",
      "creator_id": 20,
      "creator_name": "张三",
      "quantity": 30,
      "unit_price": "10.00",
      "amount": "340.00",
      "rebate_rule_id": 2,
      "status": "pending",
      "arbitrage_tags": null,
      "created_at": "2026-04-19T10:00:00Z",
      "settled_at": null
    }
  ],
  "total": 1,
  "page": 1,
  "page_size": 20
}
```

### Get Rebate Record Detail

`GET /api/v1/admin/rebate-records/:id`

**Response 200**:
```json
{
  "id": 1,
  "subscription_id": 1001,
  "agent_id": 5,
  "agent_name": "智能选股助手",
  "creator_id": 20,
  "creator_name": "张三",
  "quantity": 30,
  "unit_price": "10.00",
  "amount": "340.00",
  "rebate_rule_id": 2,
  "status": "pending",
  "arbitrage_tags": null,
  "created_at": "2026-04-19T10:00:00Z",
  "settled_at": null,
  "audit_logs": [
    {
      "id": 1,
      "admin_name": "管理员A",
      "conclusion": "normal",
      "remark": "经核实为正常推广",
      "created_at": "2026-04-19T12:00:00Z"
    }
  ]
}
```

### Review Rebate Record

`POST /api/v1/admin/rebate-records/:id/review`

**Request Body**:
```json
{
  "conclusion": "normal",
  "remark": "经核实为正常推广"
}
```

**Validation**:
- `conclusion`: required, one of `normal`, `arbitrage`
- Only records with `status = reviewing` can be reviewed

**Behavior**:
- `normal` → status changes to `pending`, will be settled T+1
- `arbitrage` → status changes to `blocked`, amount set to 0

**Response 200**:
Updated record object.

### Export Rebate Records

`GET /api/v1/admin/rebate-records/export`

**Query Parameters**: Same as List

**Response 200**:
Content-Type: `text/csv`
Attachment with filename `rebate-records-YYYY-MM-DD.csv`

---

## Internal Endpoint (Subscription → Rebate)

### Calculate Rebate on Subscription

`POST /api/v1/internal/rebate/calculate`

**Auth**: Internal token (`X-Internal-Token`)

**Request Body**:
```json
{
  "subscription_id": 1001,
  "agent_id": 5,
  "creator_id": 20,
  "user_id": 99,
  "quantity": 30,
  "ip": "192.168.1.1",
  "device_id": "abc123",
  "subscribed_at": "2026-04-19T10:00:00Z"
}
```

**Response 200**:
```json
{
  "rebate_record_id": 1,
  "amount": "340.00",
  "status": "pending",
  "arbitrage_tags": []
}
```

**Error Cases**:
- 409 if subscription already has a rebate record
- 400 if no active rebate rule found for the agent
