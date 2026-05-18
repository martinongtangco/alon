# ADR 0043: Audit and RBAC Completeness

Status: Accepted
Date: 2026-05-18
Milestone: M3 (security — ship before public deployment)
Depends on: [ADR 0009](0009-audit-log-architecture.md), [ADR 0008](0008-admin-auth-rbac.md), [ADR 0036](0036-m3-server-enforced-ghost-mode.md)

## Context

The security audit identified four gaps in audit coverage and RBAC enforcement:

**M4 — Ghost mode toggle not audited.**
`POST /api/ghost` has no audit log entry. Ghost Mode activation and deactivation are privacy-sensitive user actions. They are also a potential vector for abuse investigation: if a user reports harassment, understanding whether the harasser was ghosted at the time is relevant. There is no `GHOST_TOGGLE` action in the audit enum.

**M6 — Overview endpoint missing role check.**
`backend/src/routes/admin/overview.ts` applies `authAdmin` but no `requireRole`. Any authenticated admin — including `FINANCE` role (normally read-only revenue access) — can view the overview KPIs including total users, open flags, and active ghost count. Inconsistent with the RBAC model.

**L6 — `internal_token` exposed in admin user list.**
`backend/src/routes/admin/users.ts` `SELECT`s `internal_token` and returns it to the admin dashboard. `internal_token` is the BLE broadcast token — the pseudonymous identifier used for proximity detection. Exposing it to admins creates an unnecessary attack surface: a compromised admin account could use a user's token to fabricate proximity events.

**L7 — `GET /api/config` is unauthenticated.**
`backend/src/routes/app/config.ts` returns platform configuration with no device or user auth. Currently it only returns hardcoded defaults (`BUZZ_COOLDOWN: 120`), so there is no immediate data exposure. However, if this endpoint is ever wired to `admin.platform_config` (which contains feature flags and operational settings), it becomes an unauthenticated configuration disclosure endpoint.

## Decision

### 1. Add GHOST_TOGGLE to the device audit log (M4)

Add `GHOST_TOGGLE` to the `AuditAction` enum in `backend/src/audit/index.ts`:

```ts
export enum AuditAction {
  // ... existing values ...
  GHOST_TOGGLE = 'GHOST_TOGGLE',
}
```

In `backend/src/routes/app/ghost.ts`, wrap the ghost operation with `withDeviceAudit()` (from `backend/src/audit/device.ts`):

```ts
import { withDeviceAudit } from '../../audit/device';
import { AuditAction } from '../../audit';

// In the activation branch, after successful Redis operations:
await withDeviceAudit(deviceId, AuditAction.GHOST_TOGGLE, {
  before: { ghostMode: false },
  after: { ghostMode: true },
});

// In the deactivation branch, after successful Redis operations:
await withDeviceAudit(deviceId, AuditAction.GHOST_TOGGLE, {
  before: { ghostMode: true },
  after: { ghostMode: false, tokenIssued: true },
});
```

`withDeviceAudit` writes to `audit.entries` using `deviceId` as `admin_id` and `'user'` as `admin_role` (per the existing device audit convention).

### 2. Add role check to the overview endpoint (M6)

In `backend/src/routes/admin/overview.ts`, add `requireRole` after `authAdmin`:

```ts
import { authAdmin } from '../../middleware/authAdmin';
import { requireRole } from '../../middleware/requireRole';

const SUPER_ADMIN = 'SUPER_ADMIN';
const OPS = 'OPS';

overviewRouter.use(authAdmin());
overviewRouter.use(requireRole([SUPER_ADMIN, OPS]));
```

`FINANCE` role should not see the overview dashboard — they have a dedicated `/revenue` route. This change makes the RBAC model consistent: SUPER_ADMIN and OPS see everything operational; FINANCE sees only revenue.

### 3. Remove `internal_token` from the admin user list response (L6)

In `backend/src/routes/admin/users.ts`, remove `internal_token` from the `SELECT` statement:

```ts
// BEFORE (line ~17)
SELECT id, display_name, email, internal_token, ghost_mode, ...

// AFTER
SELECT id, display_name, email, ghost_mode, current_mode, vibes,
       plan, status, platform, phone, phone_verified,
       suspended_until, banned_at, last_active_at, created_at, updated_at
FROM app.users
```

`internal_token` serves no purpose in the admin UI. If a future admin feature requires looking up a user by token, that should be a dedicated, audited endpoint — not part of the general user list.

Remove `internal_token` from the response mapping object in the same file.

### 4. Add device auth to `GET /api/config` (L7)

In `backend/src/routes/app/config.ts`, add `authDevice` middleware:

```ts
import { authDevice } from '../../middleware/authDevice';

configRouter.use(authDevice);
```

This ensures only registered devices can read platform configuration. The endpoint currently returns hardcoded defaults, but this guard future-proofs against the planned `admin.platform_config` integration.

No change to the response shape — just add the auth middleware.

## Files to modify

| File | Change |
|---|---|
| `backend/src/audit/index.ts` | Add `GHOST_TOGGLE = 'GHOST_TOGGLE'` to `AuditAction` enum |
| `backend/src/routes/app/ghost.ts` | Call `withDeviceAudit()` on both activation and deactivation success paths |
| `backend/src/routes/admin/overview.ts` | Add `requireRole([SUPER_ADMIN, OPS])` after `authAdmin()` |
| `backend/src/routes/admin/users.ts` | Remove `internal_token` from SELECT and response mapping |
| `backend/src/routes/app/config.ts` | Add `authDevice` middleware |

## Alternatives considered

**Audit ghost toggle at the client level** — the audit log is a server-side append-only record (ADR 0009). Client-side audit is not trusted. Rejected.

**Allow FINANCE to see a limited overview** — added complexity for marginal value. FINANCE role is for billing and revenue reporting only. If a FINANCE user needs to see operational KPIs, they should be given an OPS role. Rejected.

**Keep `internal_token` in admin response for debugging** — the risk of exposing proximity tokens outweighs the debugging convenience. Admins can look up tokens via Redis directly if needed for incident response. Rejected.

**Leave `/api/config` unauthenticated** — acceptable if the endpoint is permanently limited to hardcoded defaults. However, the comment in the code suggests this will be wired to `admin.platform_config`. Adding auth now costs one line and prevents a future security regression. Accepted.

## Consequences

- `audit.entries` will now contain `GHOST_TOGGLE` rows with `admin_role = 'user'`. The audit log UI (admin dashboard) may need to handle the `'user'` role display gracefully if it currently only expects admin role values. Check `admin/src/pages/AuditLog.tsx` and add `'user'` to any role filter or display mapping.
- FINANCE-role admin accounts can no longer access `GET /api/v1/admin/overview`. If this breaks a current workflow, the FINANCE user should be re-assigned the OPS role by a SUPER_ADMIN.
- `internal_token` is no longer in the admin user list API response. Any admin dashboard column that currently displays it will show `undefined`. Remove the column from `admin/src/pages/Users.tsx` if it is currently rendered.
- `GET /api/config` now requires a valid device JWT. Unauthenticated API clients (e.g., integration tests that call this endpoint without auth) will receive HTTP 401 and must be updated to provide a valid device token.
