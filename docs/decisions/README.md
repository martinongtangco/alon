# Architecture Decision Records

One file per architectural decision. All 44 ADRs are Accepted.
Format and quality bar: [CONTRIBUTING.md](CONTRIBUTING.md)

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
| [0026](0026-app-launch-gate-and-bootstrap.md) | App Launch Gate and Bootstrap Sequence | Accepted |
| [0027](0027-radar-blob-position-model.md) | Radar Blob Position Model (BLE-Only Bearing Derivation) | Accepted |
| [0028](0028-m2-vibe-matching-engine.md) | M2 — Vibe Matching Engine (Inline Jaccard Scoring) | Accepted |
| [0029](0029-m2-mutual-reveal-flow.md) | M2 — Mutual Reveal Flow | Accepted |
| [0030](0030-m2-ios-platform-extension.md) | M2 — iOS Platform Extension | Accepted |
| [0031](0031-m2-push-notifications.md) | M2 — Push Notification Strategy | Accepted |
| [0032](0032-m2-user-account-model.md) | M2 — User Account Model (Device → User Identity) | Accepted |
| [0033](0033-offline-radar-behaviour.md) | Offline Radar Behaviour — Supplement to ADR 0025 | Accepted |
| [0034](0034-event-ingestion-pipeline.md) | Event Ingestion Pipeline (Admin CMS, M2) | Accepted |
| [0035](0035-age-verification-strategy.md) | Age Verification Strategy | Accepted |
| [0036](0036-m3-server-enforced-ghost-mode.md) | M3 — Server-Enforced Ghost Mode | Accepted |
| [0037](0037-secret-hygiene-and-env-hardening.md) | Secret Hygiene and Environment Variable Hardening | Accepted |
| [0038](0038-api-rate-limiting.md) | API Rate Limiting | Accepted |
| [0039](0039-request-body-validation.md) | Request Body Validation with Zod | Accepted |
| [0040](0040-http-security-headers-and-cors.md) | HTTP Security Headers and CORS Policy | Accepted |
| [0041](0041-ghost-mode-reveal-race-fix.md) | Ghost Mode Reveal Race Fence | Accepted |
| [0042](0042-authentication-hardening.md) | Authentication Hardening | Accepted |
| [0043](0043-audit-and-rbac-completeness.md) | Audit and RBAC Completeness | Accepted |
| [0044](0044-dos-surface-hardening.md) | DoS Surface Hardening | Accepted |
