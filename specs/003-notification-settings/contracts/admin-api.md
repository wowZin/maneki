# Admin API Contracts: System Notification Management

All endpoints require admin authentication (`Authorization: Bearer <admin_jwt>`).
Base path: `POST /api/v1/admin/notifications`

## 1. List Notifications

```
GET /api/v1/admin/notifications
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| page | int | No | Page number, default: 1 |
| page_size | int | No | Items per page, default: 10, max: 100 |
| status | string | No | Filter by status: `pending`, `active`, `expired`, `disabled` |
| keyword | string | No | Search in title |

**Response 200:**

```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "id": 1,
      "title": "系统维护通知",
      "priority": 1,
      "priority_label": "普通",
      "start_time": "2026-04-20T10:00:00+08:00",
      "end_time": "2026-04-20T12:00:00+08:00",
      "min_visible_level": 1,
      "status": "active",
      "status_label": "生效中",
      "created_at": "2026-04-19T15:00:00+08:00",
      "updated_at": "2026-04-19T15:00:00+08:00"
    }
  ],
  "total": 50,
  "page": 1,
  "page_size": 10
}
```

## 2. Get Notification Detail

```
GET /api/v1/admin/notifications/:id
```

**Response 200:**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 1,
    "title": "系统维护通知",
    "content": "<p>系统将于今晚进行维护...</p>",
    "priority": 1,
    "priority_label": "普通",
    "start_time": "2026-04-20T10:00:00+08:00",
    "end_time": "2026-04-20T12:00:00+08:00",
    "min_visible_level": 1,
    "status": "active",
    "status_label": "生效中",
    "created_at": "2026-04-19T15:00:00+08:00",
    "updated_at": "2026-04-19T15:00:00+08:00"
  }
}
```

## 3. Create Notification

```
POST /api/v1/admin/notifications
```

**Request Body:**

```json
{
  "title": "系统维护通知",
  "content": "<p>系统将于今晚进行维护...</p>",
  "priority": 1,
  "start_time": "2026-04-20T10:00:00+08:00",
  "end_time": "2026-04-20T12:00:00+08:00",
  "min_visible_level": 1
}
```

**Validation Rules:**
- `title`: required, 1-200 chars
- `content`: required
- `priority`: required, enum [1, 2]
- `start_time`: required, RFC3339 format
- `end_time`: optional, must be > `start_time`
- `min_visible_level`: required, >= 1

**Response 200:**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 1,
    "title": "系统维护通知",
    "content": "<p>系统将于今晚进行维护...</p>",
    "priority": 1,
    "start_time": "2026-04-20T10:00:00+08:00",
    "end_time": "2026-04-20T12:00:00+08:00",
    "min_visible_level": 1,
    "created_at": "2026-04-19T15:00:00+08:00",
    "updated_at": "2026-04-19T15:00:00+08:00"
  }
}
```

## 4. Update Notification

```
PUT /api/v1/admin/notifications/:id
```

**Request Body:** (same as create, all fields optional except at least one must be provided)

**Constraints:**
- Cannot update if notification status is `disabled`
- `end_time` if provided must be > `start_time`

**Response 200:** Same as create response with updated fields.

## 5. Disable Notification

```
POST /api/v1/admin/notifications/:id/disable
```

**Response 200:**

```json
{
  "code": 0,
  "message": "通知已失效"
}
```

**Constraints:**
- Only `pending` or `active` notifications can be disabled
- Already `disabled` or `expired` notifications return 400

## 6. Duplicate Notification

```
POST /api/v1/admin/notifications/:id/duplicate
```

**Response 200:**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 2,
    "title": "系统维护通知（副本）",
    "content": "<p>系统将于今晚进行维护...</p>",
    "priority": 1,
    "start_time": "2026-04-20T10:00:00+08:00",
    "end_time": "2026-04-20T12:00:00+08:00",
    "min_visible_level": 1,
    "created_at": "2026-04-19T15:01:00+08:00",
    "updated_at": "2026-04-19T15:01:00+08:00"
  }
}
```

**Behavior:**
- Copies all fields except `id`, `created_at`, `updated_at`
- Appends `（副本）` to title
- Status resets to `pending` (based on start_time)
