# Architecture Decision Records

One file per architectural decision. Owned by the architect; read by everyone.

## Format

See `.claude/skills/grill-with-docs/ADR-FORMAT.md` for the canonical format. Status values: `proposed | accepted | deprecated | superseded by ADR 0NNNN` (number only — never use filenames or `ADR-NNNN`).

## Quality bar for Accepted ADRs

An ADR is not ready to accept until an engineer can implement it without a single blocker or ambiguous decision. Before accepting, verify:

- **File locations** — every file to create or modify is named explicitly (no "update the BLE service")
- **Interface changes** — if a public interface changes, the new signature is written out in full
- **Wiring** — if two services must coordinate, the call direction is specified (who calls who, when)
- **Platform splits** — if platform-specific code is required, the file naming convention is stated (`.android.ts` / `.ios.ts`, not `Platform.OS` checks in business logic)
- **Install step** — any new package is listed with its exact version
- **Ambiguity test** — read the Decision section cold and ask: could a reasonable engineer make two different choices? If yes, add a sentence resolving it

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
| [0018](0018-ble-peripheral-advertising-android.md) | BLE Peripheral Advertising Library for Android | Accepted |
| [0019](0019-profile-state-persistence.md) | Profile and State Persistence (Zustand persist + AsyncStorage) | Accepted |
| [0020](0020-haptic-proximity-loop.md) | Haptic Proximity Loop Wiring (useProximityHaptics hook) | Accepted |
| [0021](0021-android-runtime-permissions.md) | Android Runtime Permissions for BLE | Accepted |
| [0022](0022-ble-start-sequence-android.md) | BLE Android Start Sequence Corrections | Accepted |
| [0023](0023-dev-seed-app-users.md) | Dev Seed Data for App Users | Accepted |
| [0024](0024-matching-engine-topology.md) | Matching Engine Topology (inline for M1/M2) | Accepted |
| [0025](0025-offline-radar-behaviour.md) | Offline Radar Behaviour (four-state state machine + cache) | Accepted |

## Open decisions awaiting an ADR

Deferred — none blocking M1:

- Event ingestion pipeline shape — M2
- Age verification / safety moderation — M2+ (pre-launch)
- Server-enforced Ghost Mode — M3
