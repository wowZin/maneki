# Research: Agent Backtest

**Date**: 2026-04-26
**Feature**: Agent Backtest (014-agent-backtest)

## Decision: PostgreSQL job queue for async backtest execution

**Rationale**: The existing infrastructure already uses PostgreSQL + GORM. Adding a `backtest_jobs` table provides persistence, auditability, and easy polling without introducing new dependencies (no Redis queue, no message broker). The existing `SettlementScheduler` pattern (goroutine + polling) proves this approach works in the codebase.

**Alternatives considered**:
- In-memory goroutine queue — rejected because jobs are lost on restart and status is invisible
- Redis-based queue (`LPUSH/BRPOP`) — rejected because it adds complexity without clear benefit over PostgreSQL for low volume (~10k MAU, occasional backtests)
- Message queue (RabbitMQ/Kafka) — rejected as massive overkill for current scale

## Decision: Reuse `/replay` route for backtest UI

**Rationale**: `App.tsx` already has a `/replay` route with placeholder text "回测分析（开发中）". The Chinese label literally means "Backtest Analysis". Reusing this route avoids navigation changes.

**Alternatives considered**:
- New `/backtest` route — would require updating `App.tsx` and potentially navigation; unnecessary when `/replay` is already wired

## Decision: Backtest computation logic reuses existing `agent_decisions` + `signals` join pattern

**Rationale**: The existing `GetAgentPerformance` repository query already joins `agent_decisions` with `signals` to compute hit rates by `agent_type`. The backtest worker can adapt this pattern to filter by a specific `agent_id` (or `agent_type`) and custom date range instead of pre-defined periods.

**Alternatives considered**:
- Separate backtest scoring engine — rejected because the existing signal/decision schema already captures predictions and outcomes
- Reuse `AgentPerformanceSnapshot` — rejected because snapshots are pre-aggregated 30-day summaries without per-day detail

## Decision: VIP check uses existing `User.IsVIP()` method

**Rationale**: The `User` model already has `IsVIP()` (VIPLevel >= 1 and not expired). Using this method ensures consistency with the existing marketplace free-subscription logic.

**Alternatives considered**:
- Custom middleware — unnecessary duplication when the model method exists

## Decision: Agent management entry point links to `/replay?agent_id={id}`

**Rationale**: The spec says backtest is used when "ordering and managing agents". The agent management page (or agent detail page) is the natural place to show the backtest button. Passing `agent_id` as a query parameter pre-fills the backtest form.

**Alternatives considered**:
- Modal instead of page navigation — rejected because backtest results are complex and benefit from a dedicated full-page layout
