# ADR 0026: Offline Radar Behaviour

Status: accepted

BLE proximity detection works entirely on-device and does not require a network connection. However, the app also makes network calls (token refresh, profile fetch, config). When the network is unavailable the radar must degrade gracefully rather than blank out or block the user.

## Decision

The radar continues to function offline with the following behaviour:

**BLE scanning and haptics are unaffected.** Network loss does not halt scanning or vibration. The proximity service has no network dependency — it reads RSSI from BLE events and resolves tokens from the local Redis cache (via the last known token set). Haptics fire normally.

**Peer blobs on the radar remain visible** using the last known positions. Blobs are not cleared on network loss. If a peer's token rotates while offline and cannot be refreshed, the blob fades out after two rotation periods (30 minutes, 2× the 15-minute cadence from ADR 0011) rather than disappearing immediately.

**A non-intrusive status indicator** appears on the radar screen when offline — a small badge on the signal icon in the top corner, colour shifting from green to amber. No modal, no blocking UI, no error toast. The user is not interrupted.

**Queued actions.** If the user taps "Buzz Me" while offline, the action is queued locally (Zustand persist) and retried on reconnect. If the network comes back within 5 minutes the buzz is sent; after 5 minutes the queue is discarded silently (the proximity window has likely closed).

**Token expiry while offline.** If the device's own proximity token expires while offline, the app cannot refresh it. BLE advertising continues with the expired token until reconnected. The server will reject the expired token on reconnect; the app re-registers transparently (existing bootstrap flow, ADR 0015). This is acceptable for M2 — the worst case is a missed buzz during the offline window.

**Ghost Mode offline.** Ghost Mode is local state (Zustand). Toggling Ghost Mode offline works correctly — scanning and advertising halt immediately regardless of network state.

## Alternatives considered

**Clear all blobs on network loss** — simpler implementation, no stale-state risk. Rejected: the radar going blank mid-session due to a brief network hiccup is a jarring UX that undermines the "passive, always-on" principle.

**Block all BLE activity until network is restored** — guarantees token freshness. Rejected: violates the passive-by-default principle. Users near each other should still feel the buzz even in a basement with no signal.

## Consequences

- `app/src/screens/Radar/index.tsx` — add a `useNetworkState()` hook (from `@react-native-community/netinfo`, already a common RN dependency) to drive the offline indicator and the blob fade-out timer.
- `app/src/state/store.ts` — add a `buzzQueue` array to persisted state; the queue processor runs on network reconnect.
- No schema changes.
- New dependency: `@react-native-community/netinfo` — standard React Native network state package, minimal footprint.
