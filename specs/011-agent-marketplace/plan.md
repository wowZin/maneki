# Implementation Plan: Agent Marketplace

**Branch**: `011-agent-marketplace` | **Date**: 2026/04/25 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/011-agent-marketplace/spec.md`

## Summary

Build an Agent Marketplace where users can browse, rank, and subscribe to prediction agents. VIP users subscribe for free; SVIP users can create and publish their own agents. The feature reuses existing `agents` and `agent_subscriptions` tables, extending backend handlers and creating new frontend pages.

## Technical Context

**Language/Version**: Go 1.23 (backend), TypeScript/React 18 (frontend)
**Primary Dependencies**: Gin (HTTP), GORM (ORM), Ant Design 5 (UI), react-router-dom (routing)
**Storage**: PostgreSQL (existing `agents`, `agent_subscriptions`, `agent_performance_snapshots` tables)
**Testing**: Go test (backend), Vitest (frontend)
**Target Platform**: Web application (desktop + mobile responsive)
**Project Type**: Web application (monorepo: `apps/api/` backend + `apps/web/` frontend)
**Performance Goals**: Marketplace list loads in < 2s for 100 agents; subscription completes in < 3s
**Constraints**: Agent prediction accuracy derived from `agent_performance_snapshots` (may be stale up to snapshot interval)
**Scale/Scope**: Up to ~500 agents in marketplace; targeting existing user base

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution (`constitution.md`) is a template with no ratified principles. No gates to enforce.

**Post-design re-check**: N/A — constitution has no active constraints.

## Project Structure

### Documentation (this feature)

```text
specs/011-agent-marketplace/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
apps/api/
├── internal/
│   ├── handler/
│   │   └── agent.go              # Extend: marketplace endpoints, SVIP checks
│   ├── repository/
│   │   ├── agent.go              # Extend: sorting, owner join, accuracy lookup
│   │   └── agent_subscription.go # Extend: subscribe, check existing
│   ├── model/
│   │   └── agent.go              # Existing — no changes needed
│   └── middleware/
│       └── auth.go               # Existing — SVIPAuthMiddleware pattern available
└── cmd/
    └── main.go                   # Extend: register new marketplace routes

apps/web/
├── src/
│   ├── pages/
│   │   ├── Marketplace/
│   │   │   ├── index.tsx         # Marketplace listing page
│   │   │   └── components/
│   │   │       ├── AgentCard.tsx
│   │   │       ├── AgentFilters.tsx
│   │   │       └── SortSelector.tsx
│   │   ├── AgentDetail/
│   │   │   └── index.tsx         # Agent detail page with subscribe button
│   │   └── AgentCreate/
│   │       └── index.tsx         # Agent creation form (SVIP only)
│   ├── services/
│   │   └── marketplace.ts        # Marketplace API client
│   ├── App.tsx                   # Extend: add marketplace routes
│   └── components/
│       └── Layout/
│           └── index.tsx         # Extend: add sidebar menu item
└── package.json
```

**Structure Decision**: Monorepo structure already established. Backend follows handler→repository pattern (no separate service layer for simple CRUD). Frontend follows pages + components pattern with Ant Design. No new packages or directories needed beyond the feature pages.

## Complexity Tracking

> No constitution violations. All complexity is justified by existing patterns.

| Decision | Why Needed | Simpler Alternative Rejected Because |
|----------|-----------|-------------------------------------|
| Extend existing `AgentHandler` | Reuse existing repo injection, auth patterns, response formatting | New handler would duplicate auth/user extraction logic |
| Reuse existing `agents` table | Schema already covers all marketplace fields | New table would require data migration and dual maintenance |
| Frontend page-per-feature | Matches existing Dashboard, Pricing, Profile patterns | Modal-based marketplace would not support deep-linking to agent detail |
