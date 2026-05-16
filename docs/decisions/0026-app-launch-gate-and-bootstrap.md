# ADR 0024: App Launch Gate and Bootstrap Sequence

Status: Accepted
Date: 2026-05-14
Depends on: [ADR 0015](0015-app-api-topology.md), [ADR 0019](0019-profile-state-persistence.md), [ADR 0022](0022-ble-start-sequence-android.md)

## Context

Three concerns intersect at app launch that each touched different ADRs but were never wired together into one decision:

1. **Bootstrap timing** — `bootstrapDevice()` (ADR 0022, Fix 6) registers the device and fetches platform config. It is async and must complete before the radar screen can meaningfully function. The question is whether the navigator mounts before or after it finishes.

2. **Navigation gate** — ADR 0019 established that `onboarded` is persisted via Zustand + AsyncStorage. It did not specify which component reads it or when the check happens relative to bootstrap.

3. **Hydration trigger** — The Zustand store has a `hydrate()` action that fetches promos, events, feed, and matches from the backend. No ADR specifies when it is called or what triggers a refresh.

The existing implementation in `App.tsx` blocks render on bootstrap via a `ready` flag, and `RootNavigator` gates on `store.onboarded`. The `hydrate()` action is defined but never called. This ADR formalises all three decisions so the engineer has an unambiguous target.

## Decision

### Launch sequence (three phases)

```
Phase 1 — Pre-render (App.tsx, before navigator mounts)
  bootstrapDevice()
    ├── read or create deviceId from AsyncStorage
    ├── POST /api/register → persist authToken + proximityToken
    ├── GET /api/config    → store BUZZ_COOLDOWN via platformConfigService
    └── start 14-minute rotation timer
  .finally(() => setReady(true))

Phase 2 — Navigator gate (RootNavigator, store.onboarded)
  onboarded = false → render <OnboardingScreen>
  onboarded = true  → render <MainTabs> (Radar as initial tab)

Phase 3 — Post-mount hydration (RadarScreen, one-time useEffect)
  store.hydrate()   → fetch promos, events, feed, matches in parallel
```

### Phase 1 — bootstrap blocks mount

`App.tsx` holds a local `ready` state (default `false`). It calls `bootstrapDevice().finally(() => setReady(true))` in a `useEffect` with an empty dependency array. While `ready` is false the app renders a minimal splash (dark background, "Alon" wordmark in muted colour). The navigator is not mounted during this time.

`bootstrapDevice()` never throws — failures are caught and logged, and the app degrades gracefully to mock/cached data. `finally` guarantees `ready` becomes `true` even if registration fails.

### Phase 2 — navigation gate

`RootNavigator` reads `store.onboarded` via `useAppStore`. This value is persisted to AsyncStorage by Zustand's `persist` middleware (ADR 0019), so it survives app restarts. No additional "is returning user?" flag is needed — `onboarded` is the canonical signal.

When `onboarded` is true the navigator renders `<MainTabs>` with Radar as the initial tab. The transition from Onboarding to Main happens inside the navigator when `completeOnboarding()` sets `onboarded: true` — React Navigation re-evaluates the conditional immediately.

### Phase 3 — hydration trigger

`store.hydrate()` is called once in `RadarScreen`'s mount effect, **after** the navigator gate confirms the user is onboarded:

```ts
// app/src/screens/Radar/index.tsx — add to existing mount useEffect
useEffect(() => {
  store.hydrate();
}, []);
```

`hydrate()` already wraps each fetch in `safeFetch` with an empty-array fallback, so a network failure leaves existing cached data intact (or leaves the arrays empty on first launch — the radar still renders correctly with zero promos/events).

There is no periodic refresh timer in M1. Promos and events are refreshed only on app foreground (deferred to M2 via `AppState` listener).

### Returning user flow

On a subsequent launch `store.onboarded` is already `true` (read from AsyncStorage before the navigator mounts). Bootstrap still runs in Phase 1 — it re-uses the stored `deviceId` and re-registers with the backend to get a fresh proximity token. This is intentional: the registration endpoint is idempotent and a fresh token ensures the lab test always starts with a valid BLE advertisement payload.

## Alternatives considered

**Hydrate in `App.tsx` before the navigator mounts** — adds latency to the splash screen for data the user does not see until they are past onboarding. On first install this doubles the time behind the splash with no benefit. Rejected.

**Hydrate in the Zustand store's `completeOnboarding` action** — too early on first install (network call fires while the user is still on the last onboarding step), and does not re-hydrate on subsequent launches. Rejected.

**Make bootstrap non-blocking (remove ready flag)** — the navigator would mount before a proximity token exists, and `RadarScreen` would start BLE advertising with no token payload. This violates the token-first invariant from ADR 0015. Rejected.

**AppState listener for hydration refresh in M1** — adds complexity before the M1 lab test has validated the core loop. Deferred to M2.

## Consequences

- The splash (dark + wordmark) is visible for the duration of bootstrap. On a fast network this is under 500 ms. On a slow or failing network it completes when the timeout fires (fetch default is 5 seconds before the graceful-degradation path exits). This is acceptable for M1 where both test devices are on a known local network.
- `store.hydrate()` call must be added to `RadarScreen`. This is the only file that changes as a result of this ADR.
- The `ready` flag in `App.tsx` and the conditional render are already in place — no changes needed there.
- M2 will add an `AppState` change listener to re-hydrate when the app comes to the foreground. That change does not require a new ADR — it is additive to the `hydrate()` call already established here.

### Files changed by this ADR

| File | Change |
|---|---|
| `app/App.tsx` | Already correct — no change needed |
| `app/src/navigation/RootNavigator.tsx` | Already correct — no change needed |
| `app/src/screens/Radar/index.tsx` | Add `store.hydrate()` call in mount useEffect |
