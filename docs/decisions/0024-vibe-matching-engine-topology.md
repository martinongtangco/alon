# ADR 0024: Vibe Matching Engine Topology

Status: accepted

Vibe matching must happen somewhere. The three candidates — inline on the client during every BLE scan, a periodic background service, or a server-side batch job — each carry different battery, latency, and privacy trade-offs. The decision is **inline client-side scoring during the proximity window**, with match outcomes written to the server only when a reveal occurs.

## Decision

Compatibility is computed on-device, in the proximity event handler, each time a new peer token is resolved to a profile. The score is a Jaccard similarity over the two users' vibe arrays:

```ts
function compatibilityScore(myVibes: Vibe[], theirVibes: Vibe[]): number {
  const a = new Set(myVibes);
  const b = new Set(theirVibes);
  const intersection = [...a].filter(v => b.has(v)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}
```

A score ≥ 0.5 (one or more shared vibes out of the union) qualifies as a compatible match. The threshold is a platform config value (`COMPATIBILITY_THRESHOLD`, default `0.5`) fetchable via the existing `/api/config` endpoint (ADR 0015) so it can be tuned without an app release.

Peer vibe profiles are fetched once per token and cached in Zustand for the duration of the proximity window. The cache is cleared when the session ends or the token rotates (ADR 0011). No server round-trip happens during scoring — only during profile fetch.

The haptic escalation (ADR 0020) fires regardless of compatibility in M1. In M2, `useProximityHaptics` is updated to pass the compatibility flag: incompatible peers trigger `faint_pulse` only; compatible peers escalate through all three bands.

## Alternatives considered

**Server-side batch scoring** — server computes scores nightly or on a schedule, stores ranked peer lists. Rejected: requires the server to know who is near whom, which means continuous location reporting. Violates the privacy principle (no exact location shared with server outside specific flows).

**Dedicated background service** — a background worker scores all cached tokens every N minutes. Rejected: redundant with the inline path and adds background CPU cost for no latency benefit. The proximity window is already the right trigger — scoring outside it is wasted work.

## Consequences

- `app/src/services/proximity/index.ts` gains a `compatibilityScore()` utility and a peer profile cache (Map keyed by token, TTL = token rotation cadence).
- A new API endpoint `GET /api/users/:token/vibes` returns `{ vibes: Vibe[] }` for a given proximity token. This endpoint is unauthenticated but token-scoped — it returns only vibes, not identity.
- `COMPATIBILITY_THRESHOLD` is added to platform config (backend + admin dashboard Platform Config page).
- No new packages required.
