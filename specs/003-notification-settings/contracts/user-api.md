# User API Contracts: System Notification

All endpoints require user authentication (`Authorization: Bearer <user_jwt>`).
Base path: `GET /api/v1/notifications`

## 1. List Active Notifications (for current user)

```
GET /api/v1/notifications
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| page | int | No | Page number, default: 1 |
| page_size | int | No | Items per page, default: 10, max: 50 |

**Response 200:**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "urgent": [
      {
        "id": 2,
        "title": "重大故障公告",
        "content": "<p>因网络故障，部分功能暂时不可用...</p>",
        "priority": 2,
        "start_time": "2026-04-19T10:00:00+08:00",
        "created_at": "2026-04-19T09:00:00+08:00"
      }
    ],
    "normal": [
      {
        "id": 1,
        "title": "版本更新通知",
        "content": "<p>v2.0 版本已发布，新增...</p>",
        "priority": 1,
        "start_time": "2026-04-18T10:00:00+08:00",
        "created_at": "2026-04-18T09:00:00+08:00"
      }
    ]
  }
}
```

**Filtering Logic (server-side):**

```sql
WHERE is_disabled = false
  AND start_time <= NOW()
  AND (end_time IS NULL OR end_time >= NOW())
  AND min_visible_level <= :current_user_vip_level
ORDER BY priority DESC, created_at DESC
```

**Response format note:** Results are grouped by `priority` field into `urgent` (priority=2) and `normal` (priority=1) arrays. Within each group, items are unordered (as per spec requirement).

## 2. Get Notification Detail

```
GET /api/v1/notifications/:id
```

**Response 200:**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 1,
    "title": "版本更新通知",
    "content": "<p>v2.0 版本已发布...</p>",
    "priority": 1,
    "start_time": "2026-04-18T10:00:00+08:00",
    "end_time": null,
    "created_at": "2026-04-18T09:00:00+08:00"
  }
}
```

**Access Control:** Returns 404 if:
- Notification does not exist
- Notification is disabled
- Current time is outside effective range
- User's VIP level < `min_visible_level`
