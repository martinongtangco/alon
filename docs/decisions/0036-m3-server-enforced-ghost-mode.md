# ADR 0034: M3 — Server-Enforced Ghost Mode

Status: Accepted
Date: 2026-05-14
Milestone: M3
Depends on: [ADR 0014](0014-redis-first-token-store.md), [ADR 0015](0015-app-api-topology.md), [ADR 0012](0012-milestone-1-product-scope.md)

## Context

ADR 0012 noted a known privacy debt:
> *Ghost Mode client-side-only is a known privacy debt. A rooted device could re-enable BLE advertising while Ghost Mode appears on. Must be tracked and closed in M3 (server-enforced token deactivation).*

In M1 and M2, Ghost Mode works as follows:
1. The client stops BLE advertising and scanning.
2. The client sets `profile.ghostMode = true` in the Zustand store (persisted).
3. The proximity token remains valid in Redis.

This means a modified client (rooted Android, jailbroken iOS, or a custom BLE broadcaster using the device's stored token) can continue advertising the token even while the app UI shows Ghost Mode as active. Peers can still detect and react to this device.

Ghost Mode is a promise to the user: *"when I'm in Ghost Mode, I'm completely invisible."* The M1 client-side implementation is a good-faith implementation. Server enforcement closes the loophole.

## Decision

### Ghost Mode activation — token revocation

When the user enables Ghost Mode, the app calls a new endpoint:

```
POST /api/ghost
Auth: device JWT
Body: { active: true }
Response: { ok: true }
```

The backend:
1. Looks up the device's current proximity token from `app.users.internal_token` (or the active token Redis key).
2. **Deletes** `token:{proximityToken}` from Redis immediately.
3. Sets a ghost mode flag in Redis: `ghost:{deviceId} = 1` with no TTL (persists until Ghost Mode is deactivated).

Once the token is deleted from Redis, any peer device that scans the BLE advertisement and attempts to resolve the token gets no response from the backend. The device becomes effectively invisible to token resolution — even if it continues to broadcast over BLE.

### Ghost Mode deactivation — new token issuance

When the user disables Ghost Mode:

```
POST /api/ghost
Auth: device JWT
Body: { active: false }
Response: { token: string, expiresAt: number }
```

The backend:
1. Deletes `ghost:{deviceId}` from Redis.
2. Issues a fresh proximity token (same flow as `/api/token/rotate`).
3. Returns the new token to the client.

The client calls `bleService.updateToken(newToken)` to update the BLE advertisement with the new token and resumes scanning. The rotation timer in `bootstrap.ts` is reset to 14 minutes from now.

### Why a new token on deactivation?

Reusing the old token after Ghost Mode would allow a rooted device to pre-cache the token before activating Ghost Mode and continue broadcasting it during the ghost period — the token would resolve after deactivation as if it had been active the whole time. A fresh token guarantees no continuity between ghost sessions.

### Ghost flag on `/api/nearby` and Buzz Me

The `ghost:{deviceId}` flag in Redis is checked in two additional places:

1. **`/api/nearby` response** (ADR 0026) — if the requesting device is ghosted, return an empty array regardless of BLE tokens submitted.
2. **`/api/buzz` handler** (ADR 0015) — if the target device is ghosted (looked up via the token resolution chain), return `"too-far"` instead of `"sent"`. The server does not reveal that the target is in Ghost Mode.

This ensures a ghost device cannot receive Buzz Me signals even if a peer has somehow obtained and cached their token.

### Client changes

The `toggleGhostMode` action in the Zustand store is updated:

```ts
toggleGhostMode: async () => {
  const ghostMode = !get().profile.ghostMode;
  // Optimistically update the store
  set(s => ({ profile: { ...s.profile, ghostMode }, ... }));
  try {
    if (ghostMode) {
      await apiService.setGhostMode(true);
    } else {
      const { token } = await apiService.setGhostMode(false);
      await AsyncStorage.setItem(PROXIMITY_TOKEN_KEY, token);
      await bleService.updateToken(token);
    }
  } catch (err) {
    // Revert optimistic update on failure
    set(s => ({ profile: { ...s.profile, ghostMode: !ghostMode } }));
    console.warn('[ghost] failed to update server ghost state', err);
  }
},
```

The optimistic update means the UI responds instantly. If the server call fails, the toggle reverts. The user sees a brief toggle-back — preferable to showing Ghost Mode as active when the server did not honour the request.

### Offline Ghost Mode behaviour

If the device is offline (ADR 0031) and the user activates Ghost Mode:
- Client-side: BLE stops immediately (same as M1).
- Server-side: the token revocation call is queued and sent when connectivity returns.

During the offline window, the token remains valid on the server but the client has stopped advertising — the gap is acceptable. When connectivity returns, the deferred `POST /api/ghost { active: true }` call is sent and the token is revoked. If the user re-enables Ghost Mode before connectivity returns, the queued ghost-on request is sent, followed immediately by the ghost-off + token rotation.

The queued call uses a simple `AsyncStorage`-backed pending-action queue — not a full job queue. At most one pending ghost state change exists at any time.

## Alternatives considered

**Delete all tokens for the device on ghost activation** — the device only has one active proximity token at any time (ADR 0011). Deleting `token:{proximityToken}` is sufficient. Deleting all tokens by device would require a Redis scan, which is expensive. Rejected.

**Short TTL on ghost flag instead of explicit deactivation** — a TTL-based ghost would automatically re-enable detection after N minutes. This is not what the user expects — Ghost Mode should stay on until they turn it off. Rejected.

**Move ghost state to Postgres instead of Redis** — ghost state changes are frequent (users toggle it situationally) and must be checked on every Buzz Me and `/api/nearby` call. Redis is the correct store for hot, frequently-read flags. Postgres is for durable account state. Rejected.

**Client-side only, indefinitely** — the M1 privacy debt is accepted as a known gap. This ADR exists to close it. Rejected for production.

## Consequences

- New Redis key pattern: `ghost:{deviceId}`. No TTL — persists until explicitly cleared.
- New endpoint `POST /api/ghost` in `routes/app/ghost.ts`. Requires `authDevice` middleware.
- `toggleGhostMode` in `store.ts` becomes async. Any component that calls it must handle the async nature (the optimistic update means the UI does not need to `await`).
- The existing `bleService.stop()` / `bleService.start()` calls in `RadarScreen` (triggered by the ghost mode `useEffect`) remain unchanged. Server enforcement is additive — the client-side BLE stop still happens first.
- Token rotation timer: when ghost mode is active, the rotation timer continues firing (it will attempt `/api/token/rotate` every 14 minutes). These calls will succeed — the backend issues a new token — but the new token is immediately ghost-flagged if ghost mode is still active. The client stores the new token but does not advertise it. This is correct: when the user disables Ghost Mode, `POST /api/ghost { active: false }` issues a fresh token through the existing rotation path, not a new one.
- This closes the M1 privacy debt noted in ADR 0012. After M3 ships, Ghost Mode is enforceable even against a rooted device that continues broadcasting over BLE.
