# Architecture Decision Records

One file per architectural decision. Owned by the architect; read by everyone.

## Format

```
# ADR NNNN: <decision title>
Status: Proposed | Accepted | Superseded by ADR-XXXX
Date: YYYY-MM-DD

## Context
What's the problem? What constraints apply? Cite spec sections.

## Decision
What are we doing?

## Alternatives considered
What else did we look at? Why did we reject it?

## Consequences
What's the trade-off? What does this make harder?
```

## Naming

`NNNN-short-title.md` — NNNN is a zero-padded sequence number (0001, 0002, ...).

## Index

| ADR | Title | Status |
|---|---|---|
| [0001](0001-state-management.md) | State Management Library (Zustand) | Proposed |
| [0002](0002-ble-library.md) | BLE Library Selection | Proposed |
| [0003](0003-backend-framework.md) | Backend Framework (Node/Express) | Proposed |
| [0004](0004-admin-dashboard-frontend-stack.md) | Admin Dashboard Frontend Stack (React + Vite + Tailwind) | Accepted |
| [0005](0005-admin-dashboard-backend-topology.md) | Admin Dashboard Backend Topology (route-namespaced monolith) | Accepted |
| [0006](0006-primary-database-selection.md) | Primary Database Selection (PostgreSQL + PostGIS) | Accepted |
| [0007](0007-admin-realtime-transport.md) | Real-Time Transport for Admin Dashboard (SSE) | Accepted |
| [0008](0008-admin-auth-rbac.md) | Admin Authentication and RBAC (JWT + TOTP + role enum) | Accepted |
| [0009](0009-audit-log-architecture.md) | Audit Log Architecture (append-only Postgres + in-dashboard UI) | Accepted |

## Open decisions awaiting an ADR

From `docs/agents/architect.md` — mobile app decisions still unresolved:

- Matching engine topology (inline / service / batch)
- Proximity token rotation cadence
- Offline radar behaviour
- Event ingestion pipeline shape
- Age verification / safety moderation
- Android OEM background-restriction handling (Samsung / Xiaomi)
