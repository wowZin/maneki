# Implementation Plan: Signal Center

**Branch**: `013-signal-center` | **Date**: 2026-04-25 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/013-signal-center/spec.md`

## Summary

Build a dedicated Signal Center page that displays real-time limit-up stock predictions from the main agent, allows authenticated users to follow/unfollow signals with one click, and provides personal hit-rate statistics. The feature heavily reuses existing infrastructure: the `signals` table already stores predictions, `user_stock_trackings` already handles follow records with hit-status computation, and the Dashboard's `RealtimeSignals` component demonstrates the polling pattern.

## Technical Context

**Language/Version**: Go 1.23, TypeScript 5.3
**Primary Dependencies**: Gin 1.9, GORM 1.25, React 18, Vite 5, Ant Design 5, Zustand, Axios
**Storage**: PostgreSQL 15+ (via GORM)
**Testing**: Go standard testing (`go test`), Vitest for frontend
**Target Platform**: Web browser (Chrome/Firefox/Safari/Edge latest 2 versions)
**Project Type**: web-service (backend REST API + frontend SPA)
**Performance Goals**: Signal list load p95 < 200ms, follow action p95 < 300ms
**Constraints**: Polling interval 15s for real-time updates; hit status computed after market close (15:00 CST)
**Scale/Scope**: Single tenant, ~10k MAU, single region deployment

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution (`constitution.md`) is currently a template and has not been ratified with concrete principles. Therefore, no active gates to evaluate. Proceeding with standard web-service best practices.

## Project Structure

### Documentation (this feature)

```text
specs/013-signal-center/
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
│   │   │   ├── overview.go       # Existing: realtime-signals, tracking APIs
│   │   │   └── signal.go         # NEW: follow/unfollow/my-follows endpoints
│   │   ├── model/
│   │   │   ├── signal.go         # Existing: Signal, AgentDecision
│   │   │   └── overview.go       # Existing: UserStockTracking (reused)
│   │   ├── repository/
│   │   │   ├── overview.go       # Existing: signal/tracking queries
│   │   │   └── signal.go         # NEW: follow/unfollow queries
│   │   └── service/
│   │       ├── overview.go       # Existing: aggregation logic
│   │       └── signal.go         # NEW: follow/unfollow business logic
│   └── migrations/               # DB migrations (add signal_id to user_stock_trackings)
├── web/                          # React frontend (user-facing)
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard/        # Existing: has RealtimeSignals component
│   │   │   └── SignalCenter/     # NEW: dedicated signal center page
│   │   │       ├── index.tsx
│   │   │       ├── SignalList.tsx
│   │   │       ├── SignalCard.tsx
│   │   │       └── MyStats.tsx
│   │   ├── services/
│   │   │   ├── overview.ts       # Existing: realtime signals API
│   │   │   └── signal.ts         # NEW: follow/unfollow APIs
│   │   └── App.tsx               # Add SignalCenter route
│   └── package.json
```

**Structure Decision**: Monorepo with Go backend (`apps/api`) and React SPA (`apps/web`). The Signal Center adds minimal new backend surface area because `signals` and `user_stock_trackings` tables already exist. New code is concentrated in `signal.go` handler/service/repository triple and a new frontend page directory `SignalCenter/`.

## Complexity Tracking

> No constitution violations. Existing architecture is sufficient.

| Design Choice | Why Needed | Simpler Alternative Rejected Because |
|---------------|------------|-------------------------------------|
| Reuse `user_stock_trackings` instead of new follow table | `user_stock_trackings` already has user_id, stock_code, track_date, hit_status — exactly what following a signal needs | Creating a new `user_signal_follows` table would duplicate schema and require syncing hit_status between tables |
| Polling (15s) instead of WebSocket/SSE | Existing Dashboard already uses 15s polling; SSE backend handler does not exist yet | WebSocket would require new infrastructure; SSE is acceptable future enhancement |
