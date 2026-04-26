# Research: Signal Center

**Date**: 2026-04-25
**Feature**: Signal Center (013-signal-center)

## Decision: Reuse existing `user_stock_trackings` table for signal follows

**Rationale**: The `user_stock_trackings` table already contains `user_id`, `stock_code`, `track_date`, and `hit_status`. When a user follows a signal, they are essentially saying "track this stock for me today" — which is exactly what `user_stock_trackings` represents. Adding a new table would duplicate this schema and require keeping hit_status in sync.

**Alternatives considered**:
- New `user_signal_follows` table with foreign key to `signals` — rejected because hit_status resolution depends on stock+date, not signal_id, and would require duplicate hit-status computation
- Add `is_followed_from_signal` boolean to `user_stock_trackings` — unnecessary; the presence of a row is sufficient

## Decision: Add nullable `signal_id` to `user_stock_trackings`

**Rationale**: While not strictly required for hit-rate calculation, adding an optional `signal_id` column provides traceability (which specific signal the user followed) and enables future features like "show me the signal details for this follow". It is nullable to preserve backward compatibility with existing tracking records.

**Alternatives considered**:
- No signal_id, pure stock+date tracking — simpler but loses provenance
- Junction table `user_stock_tracking_signals` — overkill for a single optional attribute

## Decision: Use 15-second polling for real-time updates

**Rationale**: The existing Dashboard `RealtimeSignals` component already implements this pattern with `after_id` incremental fetching. No new infrastructure is needed. The spec's 5-second freshness target (SC-001) is relaxed to the existing 15-second interval to avoid unnecessary backend load; this is acceptable for a stock prediction use case where signals are not generated sub-second.

**Alternatives considered**:
- WebSocket — would require new Gin WebSocket handler, connection management, and heartbeat logic; overkill for ~10k MAU
- SSE — frontend `sse.ts` already exists but no backend SSE handler exists; could be a future enhancement

## Decision: Create dedicated `SignalHandler` instead of extending `OverviewHandler`

**Rationale**: Signal follow/unfollow operations are distinct from overview aggregation. A dedicated handler keeps REST resource boundaries clean (`/signals` vs `/overview`) and follows the existing pattern where each domain has its own handler file (e.g., `agent.go`, `stock.go`).

**Alternatives considered**:
- Extend `OverviewHandler` with signal endpoints — would mix concerns and bloat the overview handler

## Decision: Show `signal_type = 'watch'` signals in Signal Center

**Rationale**: The existing accuracy-trend queries filter `signal_type = 'watch'` for limit-up predictions. The spec asks for "涨停股票" (limit-up stocks), which corresponds to `watch` signals in the existing schema.

**Alternatives considered**:
- Filter by main agent via `agent_decisions` join — more complex and requires identifying the "main agent"; `watch` signals already represent the intended prediction type
