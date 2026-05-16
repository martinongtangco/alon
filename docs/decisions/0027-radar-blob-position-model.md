# ADR 0025: Radar Blob Position Model (BLE-Only Bearing Derivation)

Status: Accepted
Date: 2026-05-14
Depends on: [ADR 0013](0013-proximity-rssi-smoothing.md), [ADR 0011](0011-proximity-token-rotation-cadence.md)

## Context

`RadarMap` places each nearby peer at a screen position derived from two fields on `NearbyPerson`:

```ts
distanceMeters: number   // how far away (maps to radar ring)
bearingDeg: number       // compass bearing 0–360 (maps to angular position)
```

`distanceMeters` is straightforward: the smoothed RSSI band (ADR 0013) maps to a representative distance value for that band's midpoint.

`bearingDeg` is the problem. **BLE cannot determine direction.** RSSI gives signal strength (distance proxy) but no angular information — BLE does not provide bearing. A real compass bearing requires GPS coordinates for both devices, which Alon explicitly does not share between users (spec §Privacy-First Design).

This creates a design question: what angle do we assign to a peer on the radar?

Options:
1. **Random per encounter** — assign a random bearing when a peer is first seen. Stable within a session, but changes every time the peer goes out of range and comes back.
2. **Deterministic from token** — derive the bearing from the peer's proximity token. Stable for the 15-minute token lifetime. Changes on rotation.
3. **All peers at 12 o'clock** — stack everyone at the top. Trivially honest about data limitations but useless as a UI.
4. **Remove bearing entirely** — render peers as a list, not a radar. Breaks the primary UX of the radar map screen.

## Decision

**Bearing is derived deterministically from the peer's proximity token using a stable hash.**

### Algorithm

```ts
function tokenToBearing(token: string): number {
  // Use the first 8 hex chars of the UUID (32 bits).
  // XOR the two 16-bit halves for better distribution across 360°.
  const hex = token.replace(/-/g, '').slice(0, 8);
  const hi = parseInt(hex.slice(0, 4), 16); // 0–65535
  const lo = parseInt(hex.slice(4, 8), 16); // 0–65535
  return ((hi ^ lo) % 360 + 360) % 360;    // 0–359
}
```

This function is pure, deterministic, and produces a uniform-ish distribution over 360° given random UUID inputs. The same token always yields the same bearing — so a peer's dot does not jump around while they are close, and it does not jitter at band transitions.

### Distance mapping (distanceMeters)

The RSSI smoother emits a `ProximityBand`. The representative `distanceMeters` for each band:

| Band | `distanceMeters` |
|---|---|
| `very-near` | 10 |
| `near` | 50 |
| `far` | 175 |
| `out-of-range` | peer removed from `nearby` array |

These values place blobs within the correct visual ring on the radar (rings at 50m / 100m / 250m). The exact value within a band does not change on every RSSI reading — it changes only when the band changes, preventing visual jitter.

### Where this logic lives

**`app/src/services/proximity/index.ts`** — the `ProximityService` already maintains the `NearbyPerson` list. It is responsible for:
1. Calling `tokenToBearing(peer.token)` when a peer is first seen and caching the result.
2. Setting `distanceMeters` from the band → distance table on each band change.
3. Removing the peer from the list when band becomes `out-of-range`.

The `RadarMap` component remains a pure renderer — it reads `distanceMeters` and `bearingDeg` from the store and calls `polarToXY()`. No position logic lives in the component.

### Token rotation and bearing stability

Proximity tokens rotate every 15 minutes (ADR 0011). When a peer rotates their token the old token disappears from BLE scan results and a new UUID appears. The `ProximityService` will treat this as a new peer: the old entry ages out (no RSSI readings → removed from list) and a new entry is created with a new computed bearing.

This is intentional. Token rotation is a privacy mechanism — linking the old and new token would deanonymise the peer. A different bearing per rotation session is the correct behaviour.

### Collision handling

If two peers hash to bearings within 15° of each other, their dots will visually overlap. No collision resolution is applied in M1. The radar is a social awareness layer, not a precise map — approximate positions are intentional. Collision resolution (e.g. minor angular offset) can be added in M2 if user testing reveals it is a problem.

## Alternatives considered

**Random bearing per encounter** — the dot jumps to a new position every time the peer briefly drops out of range (multipath, body blocking). In a crowded environment this makes the radar noisy and unusable. Rejected.

**True GPS-derived bearing** — requires both devices to share location with the backend, which directly contradicts the privacy constraint (spec §Privacy-First Design: "No exact location is ever shared with other users"). Rejected unconditionally.

**Always render peers as a vertical list** — eliminates the radar entirely and contradicts the primary UX intent of the product. Rejected.

**Hash to cluster zones (N/S/E/W quadrants only)** — reduces precision without fixing the jitter problem. No meaningful UX benefit over full-circle derivation. Rejected.

## Consequences

- Bearing is a session artifact, not a physical direction. This is disclosed nowhere to the user — the radar is presented as an ambient awareness display, not a navigation tool. The spec does not claim directional accuracy. This is intentional product design.
- The `ProximityService` now owns the `NearbyPerson` list shape including position fields. It should maintain a `Map<token, { bearingDeg: number, distanceMeters: number }>` cache to avoid recomputing on every update.
- `mockData.ts` should use consistent token → bearing values so the UI looks the same across dev reloads. The `tokenToBearing()` function can be used directly in mock data generation.
- After a token rotation the peer's dot moves to a new position on the radar. This is the expected and correct behaviour — it mirrors the privacy guarantee of token rotation.

### Files changed by this ADR

| File | Change |
|---|---|
| `app/src/services/proximity/index.ts` | Add `tokenToBearing()` helper, per-peer bearing cache, band → distanceMeters table |
| `app/src/constants/mockData.ts` | Use `tokenToBearing()` to derive consistent bearingDeg for mock peers |
