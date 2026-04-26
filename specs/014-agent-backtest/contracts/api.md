# API Contracts: Agent Backtest

**Base URL**: `/api/v1`
**Authentication**: JWT Bearer token in Authorization header (required; VIP-only)

---

## POST /backtests

Enqueue a new backtest job. Requires VIP and active agent subscription.

### Request

```http
POST /api/v1/backtests
Content-Type: application/json

{
  "agent_id": 123,
  "start_date": "2026-04-10",
  "end_date": "2026-04-20"
}
```

**Body Fields**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| agent_id | uint | Yes | Agent to backtest |
| start_date | string | Yes | YYYY-MM-DD, max 14 days before end_date |
| end_date | string | Yes | YYYY-MM-DD |

### Response 201

```json
{
  "id": 456,
  "agent_id": 123,
  "status": "pending",
  "progress": 0,
  "params": {
    "start_date": "2026-04-10",
    "end_date": "2026-04-20"
  },
  "created_at": "2026-04-26T10:00:00+08:00"
}
```

### Response 400 - Invalid Date Range

```json
{
  "error": {
    "code": "INVALID_DATE_RANGE",
    "message": "回测日期范围不能超过14天"
  }
}
```

### Response 403 - Not VIP

```json
{
  "error": {
    "code": "VIP_REQUIRED",
    "message": "回测功能仅限 VIP 用户使用"
  }
}
```

### Response 403 - No Active Subscription

```json
{
  "error": {
    "code": "SUBSCRIPTION_REQUIRED",
    "message": "您未订阅该 Agent，无法回测"
  }
}
```

### Response 409 - Already Running

```json
{
  "error": {
    "code": "JOB_ALREADY_RUNNING",
    "message": "该 Agent 已有正在进行的回测任务"
  }
}
```

---

## GET /backtests

List the current user's backtest history.

### Request

```http
GET /api/v1/backtests?limit=20&offset=0
```

**Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| limit | int | No | 20 | Max items |
| offset | int | No | 0 | Pagination offset |

### Response 200

```json
{
  "items": [
    {
      "id": 456,
      "agent_id": 123,
      "agent_name": "趋势动量 Agent",
      "status": "completed",
      "progress": 100,
      "params": {
        "start_date": "2026-04-10",
        "end_date": "2026-04-20"
      },
      "created_at": "2026-04-26T10:00:00+08:00",
      "started_at": "2026-04-26T10:00:05+08:00",
      "completed_at": "2026-04-26T10:00:30+08:00"
    }
  ],
  "total": 5
}
```

---

## GET /backtests/:id

Get backtest job status and result.

### Request

```http
GET /api/v1/backtests/456
```

### Response 200 — Pending/Running

```json
{
  "id": 456,
  "agent_id": 123,
  "agent_name": "趋势动量 Agent",
  "status": "running",
  "progress": 45,
  "params": {
    "start_date": "2026-04-10",
    "end_date": "2026-04-20"
  },
  "created_at": "2026-04-26T10:00:00+08:00",
  "started_at": "2026-04-26T10:00:05+08:00",
  "completed_at": null,
  "result": null
}
```

### Response 200 — Completed

```json
{
  "id": 456,
  "agent_id": 123,
  "agent_name": "趋势动量 Agent",
  "status": "completed",
  "progress": 100,
  "params": {
    "start_date": "2026-04-10",
    "end_date": "2026-04-20"
  },
  "created_at": "2026-04-26T10:00:00+08:00",
  "started_at": "2026-04-26T10:00:05+08:00",
  "completed_at": "2026-04-26T10:00:30+08:00",
  "result": {
    "total_days": 11,
    "total_signals": 85,
    "total_hit": 42,
    "total_miss": 43,
    "overall_hit_rate": 0.4941,
    "days": [
      {
        "date": "2026-04-10",
        "total_signals": 8,
        "hit_count": 5,
        "miss_count": 3,
        "hit_rate": 0.625,
        "details": [
          {
            "stock_code": "000001",
            "stock_name": "平安银行",
            "decision": "buy",
            "score": 0.85,
            "actual_hit": true
          }
        ]
      }
    ]
  }
}
```

### Response 200 — Failed

```json
{
  "id": 456,
  "agent_id": 123,
  "status": "failed",
  "progress": 60,
  "error_msg": "计算第 7 天数据时发生异常",
  "created_at": "2026-04-26T10:00:00+08:00",
  "started_at": "2026-04-26T10:00:05+08:00",
  "completed_at": "2026-04-26T10:00:20+08:00",
  "result": null
}
```

### Response 404

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "回测任务不存在"
  }
}
```

---

## GET /backtests/:id/progress

Lightweight endpoint for polling progress (smaller payload than full result).

### Request

```http
GET /api/v1/backtests/456/progress
```

### Response 200

```json
{
  "id": 456,
  "status": "running",
  "progress": 45,
  "message": "正在计算第 5 / 11 天的数据..."
}
```
