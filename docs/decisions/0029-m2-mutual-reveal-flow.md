# ADR 0027: M2 — Mutual Reveal Flow

Status: Accepted
Date: 2026-05-14
Milestone: M2
Depends on: [ADR 0015](0015-app-api-topology.md), [ADR 0012](0012-milestone-1-product-scope.md), [ADR 0014](0014-redis-first-token-store.md)

## Context

ADR 0012 deferred mutual reveals to M2. The spec describes the flow:

> *When two users are close, the app surfaces a minimal anonymous card — just their Vibes and a single conversation starter question. Users can tap to reveal more info if mutually interested.*

Two design questions require a decision:

1. **How is reveal intent stored?** When user A taps "reveal", the backend must hold that intent until user B also reveals (or the proximity session ends).
2. **How does user A know when B has revealed?** The app needs to transition from "pending" to "matched" state without requiring the user to actively poll.

## Decision

### Reveal intent storage — Redis with TTL

When a device calls `POST /api/reveal` with a target proximity token, the backend:

1. Resolves the token to a `deviceId` via `token:{uuid}` in Redis.
2. Writes a reveal intent to Redis: `reveal:{myDeviceId}:{theirDeviceId} = 1` with a TTL equal to `BUZZ_COOLDOWN` (default 120 s, the same window that governs Buzz Me).
3. Checks whether the reciprocal key `reveal:{theirDeviceId}:{myDeviceId}` already exists.
4. If the reciprocal key exists → mutual reveal. Write a match record to `app.matches` (Postgres), delete both Redis keys, and return `{ status: 'matched', matchId }`.
5. If no reciprocal → return `{ status: 'pending' }`.

Redis TTL ensures stale reveal intents self-clean. If user B never reveals within the TTL window, user A's intent expires silently.

### Polling — client-driven, 15-second interval

The app polls `GET /api/matches` every 15 seconds while the Matches screen is focused (via a `useEffect` with `setInterval` that cleans up on blur). The endpoint returns all matches with status `pending | mutual | expired`.

This is not real-time. A mutual reveal can be delayed by up to 15 seconds. This is acceptable — the reveal flow is not time-critical. Both users are physically near each other; a 15-second delay before the Matches screen updates is imperceptible in the context of an in-person interaction.

SSE (ADR 0007) is available in the admin dashboard but is not extended to the app in M2. App-facing SSE would require auth token management on a long-lived connection — that complexity is deferred to M3.

### What is revealed

On mutual match the Matches screen shows:

| Field | Source |
|---|---|
| Display name | `app.users.display_name` |
| Vibes | `app.users.vibes` |
| Mode | `app.users.current_mode` |
| Match timestamp | `app.matches.created_at` |

No photo, no location, no contact info. The spec is explicit: reveals surface name and Vibes. The user is expected to go talk to the person in real life.

### New endpoint contracts

```
POST /api/reveal
Auth: device JWT
Body: { token: string }          // target's proximity token
Response: { status: 'pending' | 'matched', matchId?: string }

GET /api/matches
Auth: device JWT
Response: Array<{
  id: string,
  displayName: string,
  vibes: string[],
  mode: string,
  status: 'pending' | 'mutual',
  createdAt: number              // Unix ms
}>
```

### Postgres schema addition (M2 migration)

```sql
CREATE TABLE IF NOT EXISTS app.matches (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_a    UUID NOT NULL REFERENCES app.users(id),
  device_b    UUID NOT NULL REFERENCES app.users(id),
  status      TEXT NOT NULL DEFAULT 'mutual',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(device_a, device_b)
);
```

The M1 `/api/matches` stub returns an empty array. In M2 the route is replaced with a real Postgres query.

### Matches screen (client)

The existing `MatchesScreen` at `app/src/screens/Matches/index.tsx` is currently a placeholder. In M2 it renders the matches list from `store.matches`, polls on focus, and shows an empty state if no matches exist.

The `store.buzzBack(matchId)` action (already in the store) posts to `POST /api/buzz-back` — a lightweight endpoint that logs the reciprocal buzz intent to the match record. No new architecture needed; the route is added to `routes/app/`.

## Alternatives considered

**Postgres for reveal intents instead of Redis** — reveal intents are short-lived (TTL-governed) and write-heavy. A Postgres row per reveal intent adds disk I/O and requires a background cleanup job. Redis TTL handles expiry for free. Rejected.

**Server-Sent Events for reveal notifications** — real-time push is better UX but requires a persistent authenticated connection from the app. This is non-trivial on mobile (connection lifecycle across app backgrounding, token refresh, reconnect). Deferred to M3 — 15-second polling covers the M2 beta.

**Push notification on mutual reveal** — correct long-term UX (user gets a notification even if they put the app away). Requires the push notification infrastructure from ADR 0029, which is also an M2 deliverable. These two ADRs are parallel work streams; push notification on reveal is additive and can be wired in without changing the reveal storage model.

**Infinite TTL for reveal intents** — a reveal should only be valid while two users are physically near each other. An un-expiring intent means user A could reveal user B hours after they were briefly in proximity. The spec intent is clear: "when two users are close." TTL enforces this. Rejected.

## Consequences

- Redis gets a new key pattern `reveal:{a}:{b}`. The `BUZZ_COOLDOWN` TTL is reused as the reveal window. If a different reveal window is needed, a new env var `REVEAL_TTL_SECONDS` should be introduced at that point.
- The M1 `/api/matches` route file (`routes/app/matches.ts`) is extended in place — not replaced. The route handler gains a Postgres query; the endpoint path and auth model are unchanged.
- The Matches screen goes from a placeholder to a live view. It requires access to `store.matches`, which `store.hydrate()` already populates on launch (ADR 0024). The polling interval adds a recurring network call while the Matches tab is active.
- No chat is introduced. The Matches screen shows name, Vibes, and mode — nothing more. The spec's "no in-app chat" principle is enforced at the route level: no messaging endpoints exist.
