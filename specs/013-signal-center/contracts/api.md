# API Contracts: Signal Center

**Base URL**: `/api/v1`
**Authentication**: JWT Bearer token in Authorization header (required for all `/signals/*` endpoints except `GET /signals`)

---

## GET /signals

List today's limit-up prediction signals (`signal_type = 'watch'`). Ordered by `created_at` DESC.

### Request

```http
GET /api/v1/signals?limit=20&after_id=0
```

**Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| limit | int | No | 20 | Max items to return (max 100) |
| after_id | uint | No | 0 | Return only signals with id > after_id (for polling) |

### Response 200

```json
{
  "items": [
    {
      "id": 12345,
      "stock_code": "000001",
      "stock_name": "平安银行",
      "signal_type": "watch",
      "confidence": 0.85,
      "trigger_price": 12.50,
      "reason": "突破前期高点，成交量放大",
      "created_at": "2026-04-25T09:35:00+08:00",
      "is_followed": false
    }
  ],
  "has_more": false,
  "latest_id": 12345
}
```

**Fields**:

| Field | Type | Description |
|-------|------|-------------|
| items | array | Signal list |
| items[].id | uint | Signal ID |
| items[].stock_code | string | Stock code |
| items[].stock_name | string | Stock name |
| items[].signal_type | string | Always "watch" for this endpoint |
| items[].confidence | float | 0.00-1.00 |
| items[].trigger_price | float\|null | Trigger price if set |
| items[].reason | string | Prediction rationale |
| items[].created_at | string | ISO 8601 timestamp |
| items[].is_followed | bool | Whether current user has followed (false for unauthenticated) |
| has_more | bool | Whether more items exist |
| latest_id | uint | Highest id in this response (use for next poll) |

### Response 401

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "请先登录"
  }
}
```

---

## POST /signals/:id/follow

Follow a signal. Creates a `user_stock_trackings` record for the signal's stock on today's date.

### Request

```http
POST /api/v1/signals/12345/follow
```

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| id | uint | Signal ID to follow |

### Response 200

```json
{
  "success": true,
  "tracking_id": 987,
  "stock_code": "000001",
  "stock_name": "平安银行",
  "track_date": "2026-04-25"
}
```

### Response 400 - Already Followed

```json
{
  "error": {
    "code": "ALREADY_FOLLOWED",
    "message": "今日已关注该股票"
  }
}
```

### Response 404 - Signal Not Found

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "信号不存在"
  }
}
```

---

## DELETE /signals/:id/follow

Unfollow a signal. Removes the corresponding `user_stock_trackings` record for today.

### Request

```http
DELETE /api/v1/signals/12345/follow
```

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| id | uint | Signal ID to unfollow |

### Response 200

```json
{
  "success": true
}
```

### Response 404 - Not Followed

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "未关注该信号"
  }
}
```

---

## GET /signals/my-follows

Get the current user's followed signals for today.

### Request

```http
GET /api/v1/signals/my-follows
```

### Response 200

```json
{
  "items": [
    {
      "tracking_id": 987,
      "signal_id": 12345,
      "stock_code": "000001",
      "stock_name": "平安银行",
      "confidence": 0.85,
      "reason": "突破前期高点，成交量放大",
      "created_at": "2026-04-25T09:35:00+08:00",
      "hit_status": null
    }
  ],
  "total": 1
}
```

**Fields**:

| Field | Type | Description |
|-------|------|-------------|
| items | array | Followed signals |
| items[].tracking_id | uint | UserStockTracking record ID |
| items[].signal_id | uint | Original signal ID |
| items[].stock_code | string | Stock code |
| items[].stock_name | string | Stock name |
| items[].confidence | float | Signal confidence |
| items[].reason | string | Signal reason |
| items[].created_at | string | Signal prediction time |
| items[].hit_status | bool\|null | null = pending, true = hit, false = miss |
| total | int | Total followed today |

---

## GET /signals/my-stats

Get the current user's signal follow statistics (reuses existing tracking aggregation).

### Request

```http
GET /api/v1/signals/my-stats?period=7d
```

**Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| period | string | No | 7d | `7d`, `30d`, `90d` |

### Response 200

```json
{
  "period": "7d",
  "total_followed": 15,
  "total_hit": 8,
  "overall_hit_rate": 0.5333,
  "updated_at": "2026-04-25T15:30:00+08:00"
}
```

**Fields**:

| Field | Type | Description |
|-------|------|-------------|
| period | string | Requested period |
| total_followed | int | Total signals followed in period |
| total_hit | int | Total hits in period |
| overall_hit_rate | float | Hit rate (0-1) |
| updated_at | string | Last computation time |
