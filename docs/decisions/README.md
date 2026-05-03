# Architecture Decision Records

One file per architectural decision. Owned by the architect; read by everyone.

## Format

See `.claude/skills/grill-with-docs/ADR-FORMAT.md` for the canonical format. Status values: `proposed | accepted | deprecated | superseded by ADR 0NNNN` (number only — never use filenames or `ADR-NNNN`).

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
| [0015](0015-app-api-topology.md) | App-Facing API Topology and Device Authentication (M1) | Accepted |
| [0016](0016-android-foreground-service.md) | Android Foreground Service Strategy | Accepted |
| [0017](0017-deployment-platform.md) | Deployment Platform — Railway (M1) | Accepted |

## Open decisions awaiting an ADR

Deferred — none blocking M1:

- Matching engine topology (inline / service / batch) — M2
- Offline radar behaviour — M2
- Event ingestion pipeline shape — M2
- Age verification / safety moderation — M2+ (pre-launch)
- Server-enforced Ghost Mode — M3
