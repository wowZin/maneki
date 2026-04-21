# Contract: Rebate Statistics API

**Feature**: 系统设置 - 返佣规则模块
**Base Path**: `/api/v1/admin/rebate-stats`
**Auth**: Admin JWT required

## Endpoints

### Get Dashboard Stats

`GET /api/v1/admin/rebate-stats/dashboard`

**Query Parameters**:
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| start_date | date | No | Default: 30 days ago |
| end_date | date | No | Default: today |

**Response 200**:
```json
{
  "total_rebate_amount": "12500.00",
  "total_subscriptions": 2500,
  "pending_count": 45,
  "blocked_count": 12,
  "reviewing_count": 8,
  "avg_rebate_per_subscription": "5.00"
}
```

### Get Trend Data

`GET /api/v1/admin/rebate-stats/trend`

**Query Parameters**:
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| group_by | string | No | `day`, `week`, `month`. Default: `day` |
| start_date | date | No | |
| end_date | date | No | |
| agent_id | int | No | Filter by agent |
| creator_id | int | No | Filter by creator |

**Response 200**:
```json
{
  "data": [
    {
      "date": "2026-04-01",
      "rebate_amount": "500.00",
      "subscription_count": 100,
      "blocked_count": 2
    }
  ]
}
```

### Get Creator Ranking

`GET /api/v1/admin/rebate-stats/creators`

**Query Parameters**:
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| page | int | No | Default: 1 |
| page_size | int | No | Default: 20 |
| start_date | date | No | |
| end_date | date | No | |

**Response 200**:
```json
{
  "data": [
    {
      "creator_id": 20,
      "creator_name": "张三",
      "total_amount": "5000.00",
      "subscription_count": 1000,
      "agent_count": 5
    }
  ],
  "total": 1
}
```

### Get Agent Stats

`GET /api/v1/admin/rebate-stats/agents`

**Query Parameters**:
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| page | int | No | Default: 1 |
| page_size | int | No | Default: 20 |
| creator_id | int | No | Filter by creator |
| start_date | date | No | |
| end_date | date | No | |

**Response 200**:
```json
{
  "data": [
    {
      "agent_id": 5,
      "agent_name": "智能选股助手",
      "creator_id": 20,
      "creator_name": "张三",
      "total_amount": "3000.00",
      "subscription_count": 600
    }
  ],
  "total": 1
}
```

### Export Stats

`GET /api/v1/admin/rebate-stats/export`

**Query Parameters**:
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| type | string | Yes | `records`, `creators`, `agents` |
| start_date | date | No | |
| end_date | date | No | |
| agent_id | int | No | |
| creator_id | int | No | |

**Response 200**:
Content-Type: `text/csv`
Attachment with filename `rebate-stats-{type}-YYYY-MM-DD.csv`
