# Implementation Plan: Agent Backtest

**Branch**: `014-agent-backtest` | **Date**: 2026-04-26 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/014-agent-backtest/spec.md`

## Summary

Build an agent backtest system that lets VIP users evaluate subscribed agents against historical limit-up stock data. The backtest is an async long-running job managed via a PostgreSQL job queue. Results are displayed day-by-day with progress updates. Entry point is on the agent management page; no standalone navigation menu.

## Technical Context

**Language/Version**: Go 1.23, TypeScript 5.3
**Primary Dependencies**: Gin 1.9, GORM 1.25, React 18, Vite 5, Ant Design 5, Redis 9
**Storage**: PostgreSQL 15+ (via GORM), Redis 7+
**Testing**: Go standard testing (`go test`), Vitest for frontend
**Target Platform**: Web browser (Chrome/Firefox/Safari/Edge latest 2 versions)
**Project Type**: web-service (backend REST API + frontend SPA)
**Performance Goals**: Backtest job enqueue p95 < 200ms, progress poll p95 < 100ms
**Constraints**: Max 14 days per backtest; VIP-only access; no standalone menu
**Scale/Scope**: Single tenant, ~10k MAU, single region deployment

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution (`constitution.md`) is currently a template and has not been ratified with concrete principles. Therefore, no active gates to evaluate. Proceeding with standard web-service best practices.

## Project Structure

### Documentation (this feature)

```text
specs/014-agent-backtest/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
apps/
├── api/                          # Go backend (Gin)
│   ├── cmd/main.go
│   ├── internal/
│   │   ├── handler/
│   │   │   ├── agent.go          # Existing: agent marketplace, subscription
│   │   │   └── backtest.go       # NEW: backtest endpoints
│   │   ├── model/
│   │   │   ├── signal.go         # Existing: Signal, AgentDecision
│   │   │   ├── agent.go          # Existing: Agent, AgentSubscription
│   │   │   └── backtest.go       # NEW: BacktestJob, BacktestResult
│   │   ├── repository/
│   │   │   ├── signal.go         # Existing: signal queries
│   │   │   ├── agent.go          # Existing: agent queries
│   │   │   └── backtest.go       # NEW: backtest job/result queries
│   │   ├── service/
│   │   │   ├── marketplace.go    # Existing: subscription logic
│   │   │   └── backtest.go       # NEW: backtest business logic + worker
│   │   └── scheduler/
│   │       ├── settlement.go     # Existing: T+1 settlement scheduler
│   │       └── backtest.go       # NEW: backtest job scheduler/worker
│   └── migrations/               # DB migrations (backtest tables)
├── web/                          # React frontend (user-facing)
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Marketplace/      # Existing: agent marketplace
│   │   │   ├── AgentDetail/      # Existing: agent detail
│   │   │   └── Backtest/         # NEW: backtest page (route /replay)
│   │   │       ├── index.tsx
│   │   │       ├── BacktestForm.tsx
│   │   │       ├── BacktestProgress.tsx
│   │   │       └── BacktestResult.tsx
│   │   ├── services/
│   │   │   └── backtest.ts       # NEW: backtest API client
│   │   └── App.tsx               # Update /replay route
│   └── package.json
```

**Structure Decision**: Monorepo with Go backend (`apps/api`) and React SPA (`apps/web`). The backtest feature adds a PostgreSQL-backed job queue, a scheduler worker, and a dedicated frontend page at `/replay` (replacing the existing placeholder). Agent management UI changes are minimal — just a backtest button linking to `/replay?agent_id={id}`.

## Complexity Tracking

> No constitution violations. Existing architecture is sufficient.

| Design Choice | Why Needed | Simpler Alternative Rejected Because |
|---------------|------------|-------------------------------------|
| PostgreSQL job queue instead of in-memory goroutine | Jobs must survive server restarts and be queryable for progress/history | In-memory goroutine loses jobs on restart and is invisible to users |
| Dedicated `backtest_jobs` + `backtest_results` tables instead of reusing `agent_performance_snapshots` | `agent_performance_snapshots` only stores pre-aggregated 30d stats; backtest needs per-day detail with custom date ranges | Reusing snapshots would require overloading the schema and couldn't store per-job params |
| `/replay` route instead of new path | Route already exists as placeholder in App.tsx; "回测分析" is the Chinese label | Creating a new route would require updating navigation; `/replay` is already wired |
