# ADR 0031: Offline Radar Behaviour

Status: Accepted
Date: 2026-05-14
Milestone: M2
Depends on: [ADR 0024](0024-app-launch-gate-and-bootstrap.md), [ADR 0013](0013-proximity-rssi-smoothing.md)

## Context

The spec is silent on what the radar should show when the device has no network connectivity. This is not a theoretical case — BLE scanning works entirely offline (no internet required), so a user can be actively detecting nearby devices while the backend is unreachable.

Three sub-scenarios exist:

1. **First launch, no network** — `bootstrapDevice()` fails silently (ADR 0024). No `authToken` or `proximityToken` exists. BLE advertising has no valid token payload.
2. **Mid-session network loss** — the user has a valid token and is actively scanning. Promos/events are cached in the store. Token rotation will fail when due.
3. **Returning user, no network** — `onboarded = true` (persisted). Bootstrap attempts registration but fails. Existing token may still be valid (within its 15-minute window) or expired.

## Decision

### Core principle: BLE never stops for network reasons

Proximity detection (scan + advertise) does not depend on the network. `bleService.start()` and `proximityService.start()` run regardless of connectivity state. If the backend is unreachable, the BLE layer continues operating with whatever token is currently loaded.

The network affects token freshness and match data — not detection.

### Scenario 1 — First launch, no network

Bootstrap fails silently (existing behaviour, ADR 0024). A synthetic `proximityToken` is generated client-side as a UUID v4 and stored in AsyncStorage:

```ts
// bootstrap.ts — if registerDevice() fails:
const fallbackToken = generateUUID();
await AsyncStorage.setItem(PROXIMITY_TOKEN_KEY, fallbackToken);
await AsyncStorage.setItem(PROXIMITY_TOKEN_EXPIRES_AT_KEY, String(Date.now() + 15 * 60 * 1000));
```

The fallback token is not registered with the backend — peers who receive it via BLE will not be able to resolve it to a user. This is acceptable: on first launch with no network, the app functions as a "local radar" that detects nearby BLE devices (they appear as anonymous blobs with `compatibility: 0`) but cannot resolve matches or send Buzz Me signals.

The radar renders normally. The stat bar shows `people` count from BLE scan results. A non-intrusive banner ("not connected — some features unavailable") appears below the mode badge.

### Scenario 2 — Mid-session network loss

The app detects network loss via the React Native `NetInfo` API (`@react-native-community/netinfo`). When the connection drops:

- BLE continues scanning and advertising with the current token.
- The "not connected" banner appears on the Radar screen.
- Buzz Me is disabled (grayed out in `VibeCard`) — the server cannot process it.
- Promos and events remain visible from the last successful hydration (Zustand store is not cleared).

When connectivity returns:
- The banner disappears.
- `store.hydrate()` is called immediately to refresh promos, events, and matches.
- If the proximity token is within 2 minutes of expiry (rotation timer would have missed a cycle), `apiService.rotateToken()` is called immediately.

### Scenario 3 — Returning user, no network

The user has a persisted `authToken` and `proximityToken` in AsyncStorage. Bootstrap fails but the existing tokens are still available. BLE advertises the stored token.

If the stored token has expired (older than 15 minutes, determined by comparing `proximityTokenExpiresAt` with `Date.now()`), a new token is generated client-side using the fallback UUID strategy from Scenario 1. This prevents advertising a token the backend has already TTL-evicted from Redis — advertising an expired token would make this device invisible to token resolution.

### Where network state is tracked

`NetInfo` is used at the component level — not in the store. `RadarScreen` subscribes to network state and passes `isConnected` as a prop to the banner component:

```ts
// app/src/screens/Radar/index.tsx
import NetInfo from '@react-native-community/netinfo';

const [isConnected, setIsConnected] = useState(true);
useEffect(() => {
  const unsub = NetInfo.addEventListener(state => {
    setIsConnected(state.isConnected ?? true);
  });
  return unsub;
}, []);
```

Network state is not persisted to the Zustand store — it is ephemeral device state, not application state.

### Offline banner

A new component `OfflineBanner` is added to `app/src/components/OfflineBanner.tsx`:

```
┌────────────────────────────────────────────┐
│  ◌  not connected — nearby detection only  │
└────────────────────────────────────────────┘
```

Shown between the mode header and the radar map when `isConnected` is false. Amber background (`colors.amber100`), amber border. No dismiss button — it disappears automatically when connectivity returns.

## Alternatives considered

**Stop BLE when offline** — penalises the user for network conditions they cannot control. The core value (proximity detection, haptics) works entirely peer-to-peer via BLE. Stopping it when the backend is unreachable removes the primary product feature for no reason. Rejected.

**Show a full-screen error state** — appropriate for a network-dependent app. Alon's core feature (detect and feel) is not network-dependent. A full-screen error would be misleading about what still works. Rejected.

**Persist network state in Zustand** — network connectivity is not application state; it is system state. Storing it in the global store adds unnecessary coupling between components that don't need it. Rejected.

**Generate a UUID token client-side at registration regardless** — requires the backend to accept client-generated tokens and validate them. This complicates the registration endpoint and opens a vector for token spoofing. The fallback token is only used when the server is unreachable; server-generated tokens remain the norm. Rejected as a primary flow.

## Consequences

- New dependency: `@react-native-community/netinfo`. Add to `package.json`.
- New component: `app/src/components/OfflineBanner.tsx`.
- `bootstrap.ts` gains a fallback token generation path in the catch block of `registerDevice()`.
- Buzz Me is disabled when offline. The `VibeCard` receives `isConnected` as a prop and disables the Buzz Me button accordingly with a "not connected" label.
- Expired token fallback (Scenario 3) means a returning offline user advertises a locally generated UUID. Other devices that scan this token will get no match from the server — they see an anonymous blob with `compatibility: 0`. This is the correct degraded behaviour.
- The proximity token rotation timer (set to 14 minutes) may miss a cycle while offline. When connectivity returns, the token-expired check in Scenario 3 catches this and immediately rotates. No manual timer reset is needed.
