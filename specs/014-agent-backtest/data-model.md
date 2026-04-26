# Data Model: Agent Backtest

**Date**: 2026-04-26
**Feature**: Agent Backtest (014-agent-backtest)

## Entity Overview

```
┌─────────────────┐       ┌──────────────────┐       ┌─────────────────┐
│   backtest_jobs │       │ backtest_results │       │ backtest_days   │
├─────────────────┤       ├──────────────────┤       ├─────────────────┤
│ id (PK)         │──────>│ id (PK)          │──────>│ id (PK)         │
│ user_id         │       │ job_id (FK)      │       │ result_id (FK)  │
│ agent_id        │       │ agent_id         │       │ date            │
│ agent_type      │       │ total_days       │       │ total_signals   │
│ status          │       │ total_signals    │       │ hit_count       │
│ params (JSON)   │       │ total_hit        │       │ miss_count      │
│ progress        │       │ total_miss       │       │ hit_rate        │
│ error_msg       │       │ overall_hit_rate │       │ details (JSON)  │
│ created_at      │       │ created_at       │       └─────────────────┘
│ started_at      │       └──────────────────┘
│ completed_at    │
└─────────────────┘
```

## New Entities

### BacktestJob

Represents an asynchronous backtest execution task.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | uint | PK, auto-increment | |
| user_id | uuid.UUID | type:uuid, index, not null | Who initiated |
| agent_id | uint | index | Subscribed agent being tested |
| agent_type | string | size:30, index | Agent type (fallback if agent_id not set) |
| status | string | size:20, default:'pending' | pending / running / completed / failed |
| params | JSON | type:jsonb | start_date, end_date, initial_capital, etc. |
| progress | int | default:0 | 0-100 percentage |
| error_msg | string | type:text | Failure reason |
| created_at | time.Time | not null | Enqueue time |
| started_at | *time.Time | | When worker picked it up |
| completed_at | *time.Time | | When finished or failed |

**State Transitions**:
```
pending -> running -> completed
                   -> failed
```

### BacktestResult

Aggregated outcome of a completed backtest job.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | uint | PK, auto-increment | |
| job_id | uint | unique, not null | One-to-one with BacktestJob |
| agent_id | uint | index | |
| total_days | int | not null, default:0 | Days with limit-up data |
| total_signals | int | not null, default:0 | Total predictions evaluated |
| total_hit | int | not null, default:0 | Correct predictions |
| total_miss | int | not null, default:0 | Incorrect predictions |
| overall_hit_rate | float64 | decimal(5,4), default:0 | 0-1 |
| created_at | time.Time | not null | |

### BacktestDayResult

Per-day breakdown of a backtest result.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | uint | PK, auto-increment | |
| result_id | uint | index, not null | Belongs to BacktestResult |
| date | time.Time | type:date, not null | Trading date |
| total_signals | int | not null, default:0 | Predictions that day |
| hit_count | int | not null, default:0 | Hits that day |
| miss_count | int | not null, default:0 | Misses that day |
| hit_rate | float64 | decimal(5,4), default:0 | 0-1 |
| details | JSON | type:jsonb | Array of prediction records |

**details JSON schema**:
```json
[
  {
    "stock_code": "000001",
    "stock_name": "平安银行",
    "decision": "buy",
    "score": 0.85,
    "reasoning": "...",
    "actual_hit": true
  }
]
```

## Existing Entities (Reused, No Changes)

### Signal

From `model/signal.go`. Backtest worker queries `signal_type = 'watch'` within the date range and joins `agent_decisions` to evaluate the agent's predictions.

### AgentDecision

From `model/signal.go`. The backtest worker filters by `agent_type` (matching the subscribed agent) and evaluates each `decision` against `Signal.is_valid`.

### AgentSubscription

From `model/agent.go`. Used to verify the user has an active subscription to the agent before allowing backtest initiation.

## Validation Rules

1. **Max 14 days**: `end_date - start_date <= 14 days` enforced at application layer.
2. **VIP-only**: `User.IsVIP()` must return true before job creation.
3. **Active subscription**: User must have an active `AgentSubscription` for the requested `agent_id`.
4. **One concurrent job per agent per user**: Enforced by unique index or application check on `status IN ('pending', 'running')`.

## Indexes

```sql
CREATE INDEX idx_backtest_jobs_user_status ON backtest_jobs(user_id, status);
CREATE INDEX idx_backtest_jobs_agent_status ON backtest_jobs(agent_id, status);
CREATE INDEX idx_backtest_jobs_status_created ON backtest_jobs(status, created_at);
CREATE INDEX idx_backtest_day_results_result_id ON backtest_day_results(result_id);
```
