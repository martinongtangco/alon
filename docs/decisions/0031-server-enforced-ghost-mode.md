# ADR 0031: Server-Enforced Ghost Mode

Status: accepted

ADR 0012 acknowledged a known privacy debt: in M1, Ghost Mode is client-side only. A rooted or modified device could re-enable BLE advertising while the app UI shows Ghost Mode as on. This ADR closes that debt by making Ghost Mode enforceable server-side via token deactivation.

## Decision

When a user enables Ghost Mode, the client sends `POST /api/device/ghost` (body: `{ ghost: true }`) to the server. The server immediately deletes the user's active proximity token from Redis. Without a valid token in Redis, other devices scanning for nearby users will not find this user — the server returns no match when peers attempt to resolve the token.

When Ghost Mode is disabled, the client sends `POST /api/device/ghost` (body: `{ ghost: false }`). The server issues a fresh proximity token (same flow as the existing token refresh endpoint in ADR 0015) and returns it. The app begins advertising the new token immediately.

### Redis key changes

The existing token store (ADR 0014) uses:
```
token:<token_value> → user_id  (TTL = 15 min)
user:<user_id>:token → token_value
```

Ghost Mode deactivation:
```
DEL token:<token_value>
DEL user:<user_id>:token
SET user:<user_id>:ghost → "1"  (no TTL — persists until disabled)
```

Ghost Mode activation (re-enable):
```
DEL user:<user_id>:ghost
<issue new token via existing token issuance flow>
```

The `ghost` key is checked by the token resolution endpoint: if `user:<user_id>:ghost` exists, the server refuses to issue a new token even if asked. This closes the rooted-device vector — the server will not hand out a token to a ghosted user.

### `app.users` persistence

Ghost Mode state is also persisted in `app.users.ghost_mode BOOLEAN DEFAULT false` so the admin dashboard can surface it and so the correct state is restored on app reinstall (bootstrap fetches the server-side ghost state).

### Client changes

- `POST /api/device/ghost` is called whenever the ghost toggle changes in `app/src/screens/Profile/index.tsx`.
- The existing client-side ghost check in `useProximityHaptics` and the BLE service remains — it provides instant local response (no waiting for the network round-trip to halt scanning).
- Bootstrap (`app/src/services/bootstrap.ts`) fetches current ghost state from the server on launch and syncs it to Zustand, so a re-install respects the persisted server-side state.

### Failure handling

If the `POST /api/device/ghost` call fails (no network), the client-side ghost mode activates immediately (scanning/advertising halt) but the server token remains valid until it naturally expires (up to 15 minutes per ADR 0011). This residual window is acceptable — the client has stopped advertising, so the device is already functionally invisible even if the token technically exists. The ghost key is set on the next successful sync.

## Alternatives considered

**Revoke token synchronously and block until confirmed** — guarantees zero residual window. Rejected: adds blocking UX on a toggle that should feel instant. The 15-minute natural expiry window is an acceptable residual risk for M3.

**Short token TTL (1–2 minutes) to minimise residual window** — reduces window without adding a network dependency. Rejected: increases token refresh frequency, adding battery cost and server load. ADR 0011's 15-minute cadence was chosen for battery efficiency; the server-enforced delete in this ADR makes the TTL irrelevant for ghost mode.

**Dedicated ghost mode service with immediate peer notification** — actively notifies nearby devices to remove the ghosted user's blob. Rejected: requires real-time peer-to-peer signalling infrastructure and leaks presence information (confirming the user was nearby before ghosting).

## Consequences

- New endpoint: `POST /api/device/ghost` (device JWT auth).
- `app.users` gains `ghost_mode BOOLEAN DEFAULT false` column.
- Bootstrap fetches and syncs ghost state from server on app launch.
- Redis ghost key is checked in the token issuance and resolution paths.
- Ghost Mode toggle in Profile screen triggers a network call (fire-and-forget with local optimistic update).
- Admin Users page can surface ghost status (already reads `app.users` columns).
