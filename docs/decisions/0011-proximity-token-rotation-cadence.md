# ADR 0011: Proximity Token Rotation Cadence

Status: Accepted
Date: 2026-05-03
Closes: open decision listed in docs/decisions/README.md

## Context

Each device advertises an anonymized proximity token over BLE. The rotation cadence determines how often a new token is issued. The spec requires anonymized tokens and lists cadence as an open decision.

Two competing concerns:

- **Privacy**: a static token allows passive observers (a Raspberry Pi with a BLE scanner) to track a user's physical movements across time and space by following their token.
- **BLE continuity**: if a token rotates while two devices are in a proximity handshake mid-approach, the scanning device loses the advertised peripheral and must re-discover it. Too-short rotation causes dropped proximity events.

## Decision

Tokens rotate every **15 minutes**.

## Alternatives considered

1. **Static per session** — simplest, but a persistent token is trivially trackable. Rejected on privacy grounds.
2. **60-second rotation** — maximum unlinkability, but a 60-second window is shorter than a typical "walking toward someone" approach sequence (~30–90 seconds). Creates a real product bug where two users mid-approach lose each other mid-rotation. Rejected.
3. **15-minute rotation** — the same cadence Apple uses for randomized MAC address rotation. Established, defensible, and long enough to cover any realistic proximity event. Accepted.

## Consequences

- Backend must accept the old token for a short grace window (~30 seconds) after issuing the new one to handle in-flight proximity events that straddle a rotation boundary.
- Token TTL in Redis: `SET token:{uuid} device_id EX 930` (15 min + 30 s grace).
- Ghost Mode sets the token to inactive server-side at M3; client-side stop of advertising is sufficient for M1 (see ADR 0012).

## Client-side rotation (mobile app)

Rotation is **client-driven**. The server does not push a new token; the app calls `/api/token/rotate` on a timer.

Implementation in `app/src/services/token.ts`:

1. On app launch, call `POST /api/register` → receive `{ token, expiresAt, authToken }`.
2. Store `authToken` for all subsequent API calls.
3. Store `token` as the current proximity token; pass it to the BLE service for advertising.
4. Set a timer to fire at `expiresAt - Date.now()` milliseconds (i.e., when the current token expires).
5. When the timer fires:
   - Call `POST /api/token/rotate` with `Authorization: Bearer <authToken>`.
   - Server returns `{ token: string, expiresAt: number }` — the new proximity token.
   - Update the BLE advertisement's manufacturer data to the new token via `bleService`.
   - Reset the timer for the next rotation using the new `expiresAt`.
6. The 30-second grace window means the old token remains valid in Redis during the BLE advertisement update — no gap in detection.
