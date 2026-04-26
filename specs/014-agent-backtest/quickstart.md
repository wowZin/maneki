# Quickstart: Agent Backtest

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

The dev server starts on `:5173`. Access `http://localhost:5173/replay?agent_id=1`.

### Database Migration

GORM AutoMigrate will create the new tables automatically on startup:
- `backtest_jobs`
- `backtest_results`
- `backtest_day_results`

## Manual Testing Checklist

### VIP Access Control

1. Log in as a non-VIP user
2. Navigate to an agent detail page with active subscription
3. Verify the backtest button is hidden or shows upgrade prompt

### Backtest Flow

1. Log in as a VIP user (`vip_level >= 1`)
2. Subscribe to an agent from the marketplace
3. Navigate to the agent management page
4. Click "回测" button
5. Verify navigation to `/replay?agent_id={id}` with agent pre-selected
6. Select a date range (up to 14 days)
7. Click "开始回测"
8. Verify progress indicator appears with friendly messages
9. Wait for completion (or mock status in DB)
10. Verify day-by-day results with hit/miss details

### Async Behavior

1. Start a backtest
2. Refresh the page while running
3. Verify progress is restored from server state
4. Start a second backtest for the same agent while one is running
5. Verify rejection with "已有正在进行的回测任务"

## Integration Notes

- Backtest computation reuses the existing `agent_decisions` + `signals` join pattern.
- Test data: Ensure there are `signals` with `signal_type = 'watch'` and linked `agent_decisions` for the target agent within your test date range.
- The backtest worker runs as a scheduler goroutine. It picks up `pending` jobs automatically.
