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
