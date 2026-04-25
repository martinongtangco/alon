# ADR 0005: Admin Dashboard Backend Topology

Status: Accepted
Date: 2026-04-25

## Context

The admin dashboard has its own functional surface (RBAC, moderation actions, audit log, platform config) that is largely disjoint from the mobile-app surface (profiles, Vibe matching, proximity tokens, promos, events). Both surfaces operate on the same underlying data — admins moderate the same users that the mobile app serves.

[ADR 0003](0003-backend-framework.md) chose Node.js + Express for the backend. We need to decide whether the admin dashboard:

(a) Has its own service, communicating with the mobile-API service over an internal protocol
(b) Shares one Node/Express service with the mobile API, distinguished by route namespace and authentication
(c) Has its own service that talks directly to a shared database

Per [docs/spec/admin-dashboard-spec.md](../spec/admin-dashboard-spec.md):
- "All admin API endpoints require an admin-scoped JWT separate from the partner or user JWTs" (line 383)
- "RBAC enforced server-side, not just UI-hidden" (line 382)
- "Audit log is append-only and stored separately from the main application DB" (line 384)
- Real-time features over WebSocket or SSE (line 385)

The [admin-dashboard-recommendations.md](../../ImplementationPlanMd/admin-dashboard-recommendations.md) proposed an "API gateway (AWS API Gateway, Kong)" between portals. That is rejected here as premature infrastructure for a single-region v1 deployment per spec line 405.

## Decision

**One Node.js + Express service, route-namespaced, with separate auth middleware per namespace.**

```
backend/
├── src/
│   ├── routes/
│   │   ├── mobile/        ← /api/v1/*           (user JWT)
│   │   ├── partner/       ← /api/v1/partner/*   (partner JWT)
│   │   └── admin/         ← /api/v1/admin/*     (admin JWT, RBAC)
│   ├── middleware/
│   │   ├── authUser.ts
│   │   ├── authPartner.ts
│   │   ├── authAdmin.ts   ← validates admin JWT + role claim
│   │   └── rbac.ts        ← requireRole('SUPER_ADMIN' | ...)
│   ├── services/          ← business logic shared across namespaces
│   ├── db/                ← shared database access layer
│   └── audit/             ← append-only writer (used by admin routes)
```

Three JWT issuers, three middleware chains, one process. Services (e.g. `userService`, `promoService`) are reused across namespaces. Routes do not cross namespaces — an admin route does not call a mobile route handler; both call the underlying service.

## Alternatives considered

1. **Separate admin microservice** — adds a deploy target, a service-to-service auth boundary, and either duplicate DB access or an internal RPC layer. The spec explicitly notes "single-region deployment assumed at launch" (line 405). Microservice overhead is unjustified at v1. Revisit when admin and mobile teams diverge or when load profile demands separation.
2. **API gateway (Kong / AWS API Gateway)** as proposed in [admin-dashboard-recommendations.md](../../ImplementationPlanMd/admin-dashboard-recommendations.md) — rejected. A gateway is for fan-out across services. We have one service. A gateway here is just a reverse proxy with extra latency and an extra config surface. Add later if multi-service architecture emerges.
3. **Admin service talks directly to shared DB** — bypasses the audit writer and the rate limiters. Architecturally invites drift. Rejected.
4. **GraphQL gateway** — admin dashboard usage is dense but tabular and well-known. REST endpoints with stable shapes are easier to cache and audit-log than GraphQL queries.

## Consequences

- Engineers deploying mobile-API changes can accidentally break admin endpoints. Mitigated by namespace isolation in routes/ and integration tests per namespace.
- Admin traffic shares a process with mobile traffic. Acceptable: admin traffic is low-volume (tens of concurrent ops users vs. potentially millions of mobile users). If admin traffic ever causes contention, splitting becomes a future ADR.
- One JWT verification cache, one rate-limit configuration to manage per namespace.
- The audit log writer is a hard dependency of all admin mutating routes — a failure to write an audit entry must fail the request. This must be enforced in middleware, not left to handler discretion. See [ADR 0009](0009-audit-log-architecture.md).
- "Separate JWT" per spec is satisfied: separate signing key, separate `iss` claim, separate middleware. Same library (jose / jsonwebtoken), different keys.

## Implementation notes

- Admin JWTs are short-lived (15 min access) with refresh tokens. See [ADR 0008](0008-admin-auth-rbac.md).
- Admin routes mount under `/api/v1/admin` and require both `authAdmin` and `rbac(...)` middleware.
- Admin endpoints log to the audit table even on read of PII (per spec line 144) — `audit.log()` is callable in middleware, before the handler returns.
- WebSocket / SSE endpoints for live data are separate path prefixes (e.g. `/api/v1/admin/stream/*`) and authenticated via short-lived signed tokens passed as query params (Authorization headers don't work on EventSource).
