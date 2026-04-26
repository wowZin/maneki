# Data Model: Signal Center

**Date**: 2026-04-25
**Feature**: Signal Center (013-signal-center)

## Entity Overview

The Signal Center reuses two existing tables with a minor migration, and introduces no new entities.

```
┌─────────────────────┐       ┌──────────────────────────┐
│      signals        │       │   user_stock_trackings   │
├─────────────────────┤       ├──────────────────────────┤
│ id (PK)             │       │ id (PK)                  │
│ code -> stocks      │◄──────│ stock_code               │
│ signal_type         │       │ user_id -> users         │
│ confidence          │       │ track_date               │
│ trigger_price       │       │ hit_status               │
│ reason              │       │ signal_id -> signals (NEW│
│ created_at          │       │ created_at               │
│ is_valid            │       └──────────────────────────┘
└─────────────────────┘
```

## Existing Entities (No Changes)

### Signal

Represents a stock prediction from the agent system.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | uint | PK, auto-increment | |
| code | string | size:20, not null, index | Stock code (e.g., 000001) |
| signal_type | string | size:20, not null | `watch` = limit-up prediction |
| confidence | float64 | decimal(3,2), not null | 0.00-1.00 |
| trigger_price | *float64 | decimal(10,4) | Nullable |
| reason | string | text | Prediction rationale |
| agents_votes | JSON | jsonb | Aggregated agent votes |
| is_valid | bool | default:true | Hit status after market close |
| created_at | time.Time | | Prediction timestamp |

**Relationships**:
- `Stock` (belongs to, foreignKey: Code)
- `AgentDecision[]` (has many, foreignKey: SignalID)

### UserStockTracking

Represents a user's decision to track/follow a stock for a specific trading day.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | uint | PK, auto-increment | |
| user_id | uuid.UUID | type:uuid, not null, index | |
| stock_code | string | size:20, not null, index | |
| track_date | time.Time | type:date, not null, index | Trading date |
| hit_status | *bool | | Null = pending, true = hit, false = miss |
| created_at | time.Time | | Follow timestamp |

## Migration

### Add `signal_id` to `user_stock_trackings`

```sql
ALTER TABLE user_stock_trackings
ADD COLUMN signal_id BIGINT REFERENCES signals(id) ON DELETE SET NULL;

CREATE INDEX idx_user_stock_trackings_signal_id ON user_stock_trackings(signal_id);
```

**Rationale**: Optional traceability link. Nullable to preserve existing records. `ON DELETE SET NULL` ensures follows remain valid even if the original signal is purged.

## Validation Rules

1. **Unique follow per user per stock per day**: A user cannot follow the same stock on the same day more than once. Enforced at application layer (`FR-007`).
2. **Track date must be a trading day**: Not enforced at DB level; application assumes signals are only generated on trading days.
3. **Hit status immutability after set**: Once `hit_status` is computed (not null), it should not change. Enforced by application logic.

## State Transitions

### Signal Lifecycle

```
Created (created_at) -> Pending (is_valid = NULL during trading hours)
                    -> Validated (is_valid = true/false after market close review)
```

### UserStockTracking Lifecycle

```
Followed (created_at, hit_status = NULL) -> Pending (during trading day)
                                        -> Resolved (hit_status = true/false after market close)
                                        -> Unfollowed (row deleted)
```
