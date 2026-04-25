# Admin Dashboard — Engineer Handoff Brief

> Read this before touching any code. All blockers from the prior escalation are resolved.

---

## What changed since the escalation

The engineer agent (Gemini) blocked on five issues. All are now resolved:

| Blocker | Resolution |
|---|---|
| ADR numbering gap (jumped to 0006) | Renumbered correctly: new ADRs are 0004–0009 |
| MongoDB chosen without analysis | Rejected. PostgreSQL + PostGIS selected — see ADR 0006 |
| WebSocket chosen without analysis | Rejected. SSE selected for one-way streams — see ADR 0007 |
| Audit log accessibility unresolved | Resolved: in-dashboard (Super Admin only) + async aggregator mirror — see ADR 0009 |
| All 5 spec open questions unanswered | Resolved inline in spec §Open Questions (now §Open Questions — Resolved) |

---

## Architecture decisions — read these before writing any code

| ADR | What it decides | Why you need it |
|---|---|---|
| [0004](../docs/decisions/0004-admin-dashboard-frontend-stack.md) | React + Vite + TypeScript + Tailwind + Radix + TanStack Query/Table + Recharts | Your entire frontend dependency list |
| [0005](../docs/decisions/0005-admin-dashboard-backend-topology.md) | Route-namespaced monolith; admin routes under `/api/v1/admin/*` | How admin backend fits into existing Node/Express service |
| [0006](../docs/decisions/0006-primary-database-selection.md) | PostgreSQL 16 + PostGIS; schemas: `app`, `admin`, `audit` | Closes the deferred DB choice from ADR 0003 |
| [0007](../docs/decisions/0007-admin-realtime-transport.md) | SSE (not WebSocket) for Live Activity, System Status Bar, System Logs | Real-time transport + auth pattern for EventSource |
| [0008](../docs/decisions/0008-admin-auth-rbac.md) | JWT (RS256) + TOTP + role enum {SUPER_ADMIN, OPS, FINANCE} | Full login flow, token model, RBAC middleware contract |
| [0009](../docs/decisions/0009-audit-log-architecture.md) | Append-only `audit.entries` table, `withAudit()` helper, monthly partitions | Every mutating handler must use `withAudit()` — this is a hard requirement |

---

## Repo structure to create

```
vibr8me/
├── admin/                         ← NEW: admin dashboard SPA
│   ├── src/
│   │   ├── components/            shared UI (tables, badges, dialogs)
│   │   ├── pages/                 one file per nav section
│   │   │   ├── Overview.tsx
│   │   │   ├── LiveActivity.tsx
│   │   │   ├── Users.tsx
│   │   │   ├── Flags.tsx
│   │   │   ├── Businesses.tsx
│   │   │   ├── Promos.tsx
│   │   │   ├── Events.tsx
│   │   │   ├── Revenue.tsx
│   │   │   ├── SystemLogs.tsx
│   │   │   ├── PlatformConfig.tsx
│   │   │   └── AuditLog.tsx       (Super Admin only)
│   │   ├── hooks/                 useSSE.ts, useAdminQuery.ts, etc.
│   │   ├── lib/                   api client, auth helpers, rbac utils
│   │   └── types/                 shared type declarations
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── tsconfig.json
│
└── backend/
    └── src/
        ├── routes/
        │   └── admin/             ← NEW: all admin endpoints
        ├── middleware/
        │   ├── authAdmin.ts       ← NEW
        │   └── rbac.ts            ← NEW
        └── audit/
            └── index.ts           ← NEW: withAudit() helper + audit_writer connection
```

---

## Build sequence — recommended order

Building in this order avoids re-work: each step unblocks the next.

1. **DB schema** — create `app`, `admin`, `audit` schemas; `audit.entries` table with insert-only role; admin user table; monthly partition scaffold
2. **Auth backend** — `POST /auth/login`, `POST /auth/totp`, `POST /auth/refresh`, `POST /auth/logout`; TOTP enrollment; `authAdmin` + `rbac` middleware
3. **Audit writer** — `withAudit()` helper; verify transactional coupling works; log all auth events
4. **Admin user provisioning** — Super Admin creates/deactivates admin accounts (bootstrap needed before anything else works)
5. **SSE infrastructure** — stream token issuance, the three SSE endpoints (status, activity, logs), heartbeat, EventSource reconnect
6. **Core admin REST routes** — Users, Businesses, Promos, Events, Flags — implement table queries with filter/sort/pagination, then mutation endpoints (each mutation uses `withAudit()`)
7. **Revenue routes** — read-only; Finance role restriction
8. **Platform Config routes** — Super Admin only; full before/after diff captured in audit
9. **Frontend shell** — auth flow (login → TOTP → dashboard), persistent nav, System Status Bar, role-gated route rendering
10. **Frontend pages** — implement in spec section order; use TanStack Query for REST data, native EventSource for SSE streams
11. **Audit Log page** — Super Admin only; read from `audit.entries` with filter + pagination

---

## Hard rules for this feature (from engineer.md, applied here)

- **Every mutating admin route uses `withAudit()`** — no exceptions. If you can't find the relevant action type in the registry, add one to the enum and document it. Don't emit an undeclared string.
- **No user GPS coordinates in the admin UI** — city/area only (spec line 141). Do not surface geometry columns from PostGIS in admin API responses.
- **RBAC enforced server-side, not only in the UI** — `requireRole(...)` middleware on every restricted route. Frontend role-gating is UX only.
- **Destructive actions require a second confirmation** — Ban, Kill, Suspend (spec line 371). The frontend must present a confirmation step. The backend must not accept these as fire-and-forget without a confirmation flag in the request body.
- **SSE stream payloads are anonymized** — no user IDs in Live Activity event log (spec line 110).
- **Access token in memory only** — never `localStorage`, never a cookie. Refresh token in `HttpOnly` secure cookie only.
- **Audit log is insert-only** — no `DELETE` or `UPDATE` path exists in the codebase. If you find yourself writing one, stop.

---

## Spec reference

Full feature detail: [docs/spec/admin-dashboard-spec.md](../docs/spec/admin-dashboard-spec.md)

All open questions are resolved in the spec's §Open Questions section (updated 2026-04-25).
