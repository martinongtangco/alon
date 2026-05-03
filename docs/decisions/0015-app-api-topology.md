# ADR 0015: App-Facing API Topology and Device Authentication (M1)

Status: Accepted
Date: 2026-05-03
Supplements: [ADR 0005](0005-admin-dashboard-backend-topology.md)

## Context

[ADR 0005](0005-admin-dashboard-backend-topology.md) established the monolith topology and planned three route namespaces:

```
routes/mobile/    ← /api/v1/*          (user JWT)
routes/partner/   ← /api/v1/partner/*  (partner JWT)
routes/admin/     ← /api/v1/admin/*    (admin JWT, RBAC)
```

Two constraints from M1 change this picture:

**No user profiles in M1.** [ADR 0014](0014-redis-first-token-store.md) deferred Postgres (and therefore persistent user identities) to M2. In M1 there is no user — only a device. A device JWT is not a user JWT and cannot share the `authUser` middleware chain planned in ADR 0005.

**Mobile clients cannot be force-updated.** A `/api/v1/` prefix on mobile routes creates deployment coupling: if a breaking API change requires a path bump to `/api/v2/`, existing installs on old app versions break until the user updates. Admin clients (browser) and partner clients (server) can be updated in lockstep with the backend; mobile clients cannot. Versioning strategy for mobile APIs must be additive — not path-based.

## Decision

**M1 app routes live at `/api/` (no version segment), in `routes/app/`.**

```
routes/app/       ← /api/*             (device JWT, HS256)
routes/admin/     ← /api/v1/admin/*    (admin JWT, RS256 + RBAC)
```

**Device authentication uses HS256 JWT** (`DEVICE_JWT_SECRET` env var), separate from the admin RS256 key pair. Token payload: `{ sub: deviceId, type: 'device', exp: +90d }`. Verified by `middleware/authDevice.ts`.

### M1 endpoint contracts

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| `POST` | `/api/register` | none | `{ deviceId: string }` | `{ token: string, expiresAt: number, authToken: string }` |
| `POST` | `/api/token/rotate` | device | — | `{ token: string, expiresAt: number }` |
| `GET` | `/api/config` | none | — | `{ BUZZ_COOLDOWN: number }` |
| `POST` | `/api/buzz` | device | — | `"sent" \| "rate-limited"` |
| `GET` | `/api/matches` | device | — | `BuzzMatch[]` |
| `GET` | `/api/ping` | none | — | `{ ok: true, mode: "app" }` |

`"too-far"` is never returned by the server. Proximity is a client-side BLE concern; the server has no knowledge of physical distance.

### Redis key contracts (M1)

| Key | Value | TTL | ADR |
|---|---|---|---|
| `token:{uuid}` | `deviceId` | 930 s (15 min + 30 s grace) | 0011, 0014 |
| `cooldown:{deviceId}` | `1` | `BUZZ_COOLDOWN` s (default 120) | 0012 |

## Alternatives considered

1. **`/api/v1/` prefix for app routes** — symmetric with admin, but adds a version segment that forces a client update on any breaking change. Mobile clients install on user schedules, not deploy schedules. Rejected: path versioning is the wrong versioning strategy for a mobile API.
2. **Separate app service** — rejected per [ADR 0005](0005-admin-dashboard-backend-topology.md). No new justification at M1.
3. **`authUser.ts` for M1 devices** — there is no user yet. A device is not a user. Using a user JWT for a device conflates the two identities and makes M2 migration (real user profiles) harder, not easier.

## Consequences

- `routes/mobile/` as planned in ADR 0005 is renamed `routes/app/`. No structural impact — it is a subdirectory name only.
- `authDevice.ts` (M1) will be **supplemented** by `authUser.ts` in M2 when user profiles are introduced. Device registration will be linked to a user account at that point. `authDevice` will not be removed — it remains the registration/rotation path.
- The partner namespace (`routes/partner/`) from ADR 0005 is deferred. It has no M1 scope.
- Privacy: `authDevice` verifies a registered device, not a person. No PII flows through any M1 app endpoint. `BuzzMatch[]` from `/api/matches` is empty in M1 — identity association happens in M2.
- Battery: no persistent polling endpoints exist. `/api/config` is fetched once on launch. `/api/token/rotate` fires on a 15-min timer. No endpoint creates a background connection that holds a wake lock.
