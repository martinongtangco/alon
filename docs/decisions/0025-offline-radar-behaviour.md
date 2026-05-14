# ADR 0025: Offline Radar Behaviour

Status: accepted
Date: 2026-05-14
Patches: [ADR 0010](0010-app-schema-data-model.md), [ADR 0014](0014-redis-first-token-store.md), [ADR 0016](0016-android-foreground-service.md)

## Context

The deferred decision from `docs/decisions/README.md` lists "Offline radar behaviour — M2" as an open item. When a user loses network connectivity (enters a dead zone, airplane mode, subway, basement venue), the radar screen must still function — it just cannot show live data. The current app has no explicit offline handling; the radar map shows stale data or errors silently when the network drops.

This ADR defines the offline/online state machine for the radar screen, the data caching strategy, and the reconnect behaviour.

## Decision

**Implement a four-state offline/online state machine on the radar screen.** The state machine is driven by network reachability and SSE connection status. Each state determines what data is shown and what actions are available.

### State machine

```
           ┌──────────┐
           │  Idle    │  (app just launched, no connectivity info yet)
           └────┬─────┘
                │
        ┌───────┴────────┐
        │ fetch() fails  │ fetch() succeeds
        │ on /health     │ on /health
        ▼                ▼
     ┌───────┐      ┌──────────┐
     │ Offline│─────│ Online   │
     │       │reconnect│        │
     └───────┘        └────┬───┘
            │ reconnect     │
            ▼               │
     ┌──────────┐           │
     │ Recovering│──────────┘
     │          │stream drop
     └────┬─────┘
          │
          ▼
     ┌──────────┐
     │ Offline   │  (back to offline, loop continues)
     └──────────┘
```

### State definitions

| State | Network | SSE | Cache | Radar behaviour |
|---|---|---|---|---|
| **Idle** | Unknown | Unknown | Empty | Loading spinner; "Connecting…" banner |
| **Online** | Up | Connected | Warm | Full radar; live updates via SSE |
| **Offline** | Down | Disconnected | Stale | Show cached data with "Offline" banner; disable SSE-dependent actions |
| **Recovering** | Up | Disconnecting | Stale | Attempt SSE reconnect; show cached data with "Reconnecting…" banner |

### Cache strategy

**What to cache:**

| Data | TTL | Source |
|---|---|---|
| User profile (vibes, mode, ghost status) | Until logout | `GET /api/profile` |
| Nearby people list (last known) | 5 minutes | SSE `radar:update` events |
| Active promos (last known) | 10 minutes | SSE `promo:update` events |
| Active events (last known) | 30 minutes | SSE `event:update` events |

**Cache storage:**

- **Mobile:** `AsyncStorage` (persisted) + in-memory LRU map (hot data)
- **Key format:** `alon:cache:<type>:<timestamp>` — timestamp is the wall-clock time of the last fetch, used for TTL expiry checks
- **On TTL expiry:** treat as missing; show cached data with "data may be stale" indicator

**Cache invalidation:**

- TTL expiry → data marked stale but still shown (with indicator)
- Network recovery → force refresh all cached data from server
- User logout → clear all cache

### Radar behaviour per state

**Online:**
- Full radar with live SSE-driven updates
- All actions available (Buzz Me, reveal, etc.)

**Offline:**
- Show cached radar data with a dimmed overlay (`opacity: 0.6`)
- Banner at top: "Offline — showing last known data"
- Disable Buzz Me (requires real-time confirmation)
- Allow Vibe card taps (shows cached data)
- Allow mode switch (uses cached profile)
- Allow Ghost Mode toggle (uses cached profile, syncs on reconnect)

**Recovering:**
- Same as Offline, but banner: "Reconnecting…"
- Attempt SSE reconnect with exponential backoff (1s → 2s → 4s → max 30s)
- On SSE reconnect success → transition to Online
- On SSE reconnect failure → transition to Offline

### SSE reconnect strategy

```ts
function reconnectWithBackoff(maxRetries: number = 10): Promise<EventSource> {
  let attempt = 0;
  let delay = 1000; // start at 1 second

  async function tryConnect(): Promise<EventSource> {
    try {
      const stream = await createSSEStream();
      return stream;
    } catch (err) {
      attempt++;
      if (attempt >= maxRetries) {
        throw err; // will transition to Offline
      }
      // Exponential backoff with jitter
      const jitter = Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay + jitter));
      delay = Math.min(delay * 2, 30000); // cap at 30s
      return tryConnect();
    }
  }

  return tryConnect();
}
```

### Network reachability detection

**Mobile (React Native):**

- Use `NetInfo` from `@react-native-community/netinfo` for network state changes
- Subscribe to `change(state)` — state.type values: `wifi`, `cellular`, `none`, `unknown`
- `none` → transition to Offline
- `wifi` or `cellular` → attempt SSE reconnect (transition to Recovering first)

**Health check:**

- On network state change, `GET /api/health` with 3-second timeout
- If health check fails → Offline (even if network is "up")
- If health check succeeds → attempt SSE reconnect

### Files to create

| File | Purpose |
|---|---|
| `app/src/services/offline/stateMachine.ts` | Four-state offline/online state machine |
| `app/src/services/offline/cache.ts` | Cache read/write with TTL expiry |
| `app/src/services/offline/reconnect.ts` | SSE reconnect with exponential backoff |
| `app/src/hooks/useOfflineRadar.ts` | Hook that wires state machine + cache + SSE to radar screen |
| `app/src/components/OfflineBanner.tsx` | UI banner component (shows state-appropriate message) |
| `app/src/services/offline/stateMachine.test.ts` | State machine unit tests |
| `app/src/services/offline/cache.test.ts` | Cache TTL and invalidation tests |

### Files to modify

| File | Change |
|---|---|
| `app/src/screens/Radar/index.tsx` | Wire `useOfflineRadar` hook; render `OfflineBanner` when not Online |
| `app/src/services/api/index.ts` | Add `GET /api/health` endpoint; expose `isOnline` getter |
| `app/src/App.tsx` | Initialize NetInfo subscription at app root |
| `docs/decisions/README.md` | Update open decisions: remove "Offline radar behaviour" from deferred list |

## Alternatives considered

**No offline handling — show blank/error screen** — Rejected: the radar is the primary screen; showing nothing degrades UX significantly. Cached data with clear offline indicators is better than a blank screen.

**Full offline mode with local-only radar** — Rejected: without server-side proximity data, the local radar would show phantom users (devices that have gone offline). This creates false expectations. Cached data with TTL expiry is safer.

**WebSocket instead of SSE for auto-reconnect** — Rejected: ADR 0007 already selected SSE for admin real-time transport. For the mobile app, SSE is sufficient and avoids the complexity of WebSocket connection management. The reconnect logic in this ADR handles the gap.

**P2P offline mesh via BLE** — Rejected: out of scope for M1/M2. Would require a completely different architecture. Deferred to M3+.

## Consequences

- Users see a degraded but functional radar when offline — cached data with clear indicators, not a blank screen.
- Buzz Me is disabled offline (requires real-time confirmation from the recipient). This is a product constraint, not a technical one.
- The SSE reconnect with exponential backoff prevents thundering herd problems when many users come back online simultaneously.
- Cache TTL values are conservative — they prioritise freshness over availability. If users complain about stale data, increase TTLs.
- The four-state machine is simple enough to unit test. Each state transition has a clear trigger and expected behaviour.
- If P2P offline mesh is added in M3+, the state machine can be extended with a new `MeshActive` state without restructuring.

### Data flow diagram

```
User opens Radar screen
        │
        ▼
  useOfflineRadar hook
        │
        ├── NetInfo subscription ──► state machine updates
        ├── SSE connection ──► state machine updates
        ├── Cache warm on online ──► radar renders
        └── OfflineBanner shows current state
        │
        ▼
  Radar screen renders based on state:
  Online  → live SSE data, full interactivity
  Offline → cached data, dimmed, limited actions
  Recovering → cached data, reconnecting banner