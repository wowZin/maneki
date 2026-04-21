# Quickstart: 通知设置管理

## Running the Feature Locally

### 1. Start Dependencies

```bash
make restart-infra
```

This starts PostgreSQL (TimescaleDB) and Redis.

### 2. Start the Go API

```bash
cd apps/api
go run cmd/main.go
```

The API will auto-migrate the `system_notifications` table on startup.

### 3. Test Admin Endpoints

**Create a notification:**

```bash
curl -X POST http://localhost:8080/api/v1/admin/notifications \
  -H "Authorization: Bearer <admin_jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "系统维护通知",
    "content": "<p>系统将于今晚进行维护...</p>",
    "priority": 1,
    "start_time": "2026-04-20T10:00:00+08:00",
    "end_time": "2026-04-20T12:00:00+08:00",
    "min_visible_level": 1
  }'
```

**List notifications:**

```bash
curl "http://localhost:8080/api/v1/admin/notifications?page=1&page_size=10" \
  -H "Authorization: Bearer <admin_jwt>"
```

**Disable a notification:**

```bash
curl -X POST http://localhost:8080/api/v1/admin/notifications/1/disable \
  -H "Authorization: Bearer <admin_jwt>"
```

**Duplicate a notification:**

```bash
curl -X POST http://localhost:8080/api/v1/admin/notifications/1/duplicate \
  -H "Authorization: Bearer <admin_jwt>"
```

### 4. Test User Endpoints

**List active notifications:**

```bash
curl "http://localhost:8080/api/v1/notifications" \
  -H "Authorization: Bearer <user_jwt>"
```

### 5. Run Tests

```bash
cd apps/api
go test ./internal/handler/... -v
go test ./internal/repository/... -v
```
