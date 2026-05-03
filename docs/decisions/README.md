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
| [0001](0001-state-management.md) | State Management Library (Zustand) | Accepted |
| [0002](0002-ble-library.md) | BLE Library Selection (react-native-ble-plx) | Accepted |
| [0003](0003-backend-framework.md) | Backend Framework (Node/Express) | Accepted |
| [0004](0004-admin-dashboard-frontend-stack.md) | Admin Dashboard Frontend Stack (React + Vite + Tailwind) | Accepted |
| [0005](0005-admin-dashboard-backend-topology.md) | Admin Dashboard Backend Topology (route-namespaced monolith) | Accepted |
| [0006](0006-primary-database-selection.md) | Primary Database Selection (PostgreSQL + PostGIS) | Accepted |
| [0007](0007-admin-realtime-transport.md) | Real-Time Transport for Admin Dashboard (SSE) | Accepted |
| [0008](0008-admin-auth-rbac.md) | Admin Authentication and RBAC (JWT + TOTP + role enum) | Accepted |
| [0009](0009-audit-log-architecture.md) | Audit Log Architecture (append-only Postgres + in-dashboard UI) | Accepted |
| [0010](0010-app-schema-data-model.md) | App Schema Data Model (app.users, businesses, promos, events, flags) | Accepted |
| [0011](0011-proximity-token-rotation-cadence.md) | Proximity Token Rotation Cadence (15 minutes) | Accepted |
| [0012](0012-milestone-1-product-scope.md) | Milestone 1 Product Scope (Android lab test) | Accepted |
| [0013](0013-proximity-rssi-smoothing.md) | Proximity RSSI Smoothing Strategy (hysteresis + rolling average) | Accepted |
| [0014](0014-redis-first-token-store.md) | Redis-First Token Store (M1), Postgres supplement (M2) | Accepted |

## Open decisions awaiting an ADR

From `docs/agents/architect.md` — mobile app decisions still unresolved:

- Matching engine topology (inline / service / batch)
- Offline radar behaviour
- Event ingestion pipeline shape
- Age verification / safety moderation
- Android OEM background-restriction handling (Samsung / Xiaomi)
- Server-enforced Ghost Mode (client-side accepted for M1 per ADR 0012; server-enforcement deferred to M3)
