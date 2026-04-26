# Quickstart: Signal Center

## Local Development Setup

### Prerequisites

- Go 1.23+
- Node.js 20+
- PostgreSQL 15+ running with existing `maneki` database
- Redis 7+ running

### Backend

```bash
cd apps/api
go run cmd/main.go
```

The server starts on `:8080`. API base URL: `http://localhost:8080/api/v1`.

### Frontend

```bash
cd apps/web
npm run dev
```

The dev server starts on `:5173`. Access `http://localhost:5173/signals`.

### Database Migration

Run the migration to add `signal_id` to `user_stock_trackings`:

```bash
cd apps/api
go run cmd/main.go migrate
```

Or apply manually:

```sql
ALTER TABLE user_stock_trackings
ADD COLUMN signal_id BIGINT REFERENCES signals(id) ON DELETE SET NULL;

CREATE INDEX idx_user_stock_trackings_signal_id ON user_stock_trackings(signal_id);
```

## Manual Testing Checklist

### Signal List

1. Open `http://localhost:5173/signals`
2. Verify signal list loads with stock name, code, prediction time
3. Verify 15-second auto-refresh (new signals appear with highlight)
4. Verify empty state when no signals exist

### Follow / Unfollow

1. Click "Follow" on a signal
2. Verify button changes to "Following"
3. Refresh page — button should still show "Following"
4. Click "Unfollow"
5. Verify button reverts to "Follow"
6. Try to follow the same signal again — should get "今日已关注该股票"

### My Stats

1. Follow 2-3 signals
2. View "My Stats" section
3. Verify `total_followed` increments
4. After market close (or manually set `hit_status` in DB), verify `total_hit` and `overall_hit_rate` update

## Integration Notes

- The Signal Center reuses the existing `signals` table. No seed data is required if the agent system is already generating signals.
- If testing with an empty `signals` table, insert test signals directly:

```sql
INSERT INTO signals (code, signal_type, confidence, reason, created_at)
VALUES ('000001', 'watch', 0.85, '测试信号', NOW());
```

- Hit status is computed by a background job (not part of this feature). For manual testing, update `user_stock_trackings.hit_status` directly.
