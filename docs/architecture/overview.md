# Architecture Overview

> Status: **Draft / pre-ADR.** This document captures the *intended* architecture from the spec. Concrete decisions (library choices, backend framework, etc.) will be resolved in ADRs under `docs/decisions/` before implementation begins.

---

## High-level

```
┌─────────────────────────────────────────────────────────────┐
│                        React Native app                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Screens   │  │  Navigation │  │    Global state     │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                    │              │
│  ┌──────┴────────────────┴────────────────────┴──────────┐  │
│  │                       Services                         │  │
│  │  ┌───────┐  ┌──────────┐  ┌─────────┐  ┌───────────┐ │  │
│  │  │  BLE  │  │ Location │  │ Haptics │  │ Proximity │ │  │
│  │  └───┬───┘  └─────┬────┘  └────┬────┘  └─────┬─────┘ │  │
│  └──────┼────────────┼────────────┼─────────────┼───────┘  │
│         │            │            │             │           │
│  ┌──────┴────────────┴────────────┴─────────────┴───────┐  │
│  │           Platform APIs  (iOS / Android)              │  │
│  │  CoreBluetooth · CLLocationManager · CoreHaptics      │  │
│  │  android.bluetooth · FusedLocation · VibrationEffect  │  │
│  └───────────────────────────────────────────────────────┘  │
└──────────────────────────────┬──────────────────────────────┘
                               │  HTTPS + anonymized tokens
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                         Backend                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │   Profiles   │  │ Vibe matching│  │ Proximity tokens │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
│  ┌──────────────┐  ┌──────────────┐                         │
│  │   Promo CMS  │  │ Event ingest │                         │
│  └──────────────┘  └──────────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Layers

### Mobile — Screens
Thin views. Compose from `components/`. No direct platform API calls, no network calls. Subscribe to state, render, dispatch actions.

### Mobile — Services
Platform abstraction. Each service is a facade over one platform capability:
- **`services/ble`** — scanning, advertising, proximity token broadcast
- **`services/location`** — significant-change mode on iOS, balanced priority on Android, geofencing
- **`services/haptics`** — named vibration patterns (`faint_pulse`, `steady_rhythm`, `strong_buzz`, `buzz_me`)
- **`services/proximity`** — combines BLE + location signals into "distance + compatibility" events
- **`services/api`** — backend client, auth, retries

### Mobile — State
Single source of truth for UI. Derived from service events. Not yet chosen — see ADR-TBD on state library.

### Backend — Intentionally minimal
Because there is **no chat**, the backend surface area is dramatically smaller than a typical social app:

- **Profiles** — user identity, Vibes, mode
- **Vibe matching** — compatibility scoring based on shared Vibes
- **Proximity tokens** — rotating anonymized tokens so users can be detected via BLE without leaking identity
- **Promo CMS** — partner establishment content
- **Event ingestion** — manual curation for MVP

What the backend is NOT:
- Not a messaging service
- Not a notification fan-out hub for user-to-user content
- Not a content moderation pipeline (no user-generated text to moderate)
- Not a media store (no photo messaging)

---

## Key flows

### Passive proximity detection
1. App is backgrounded, BLE service is scanning + advertising anonymized token
2. Another vibr8 user comes within range → BLE event
3. Proximity service asks backend: "is this token compatible with me?" (using cached compat scores where possible)
4. Haptics service fires the appropriate pattern based on distance + compat
5. Radar UI is **not** updated in the background — it refreshes when the user opens the app

### Buzz Me
1. User taps Buzz Me on another user's Vibe card (must be within ~100m)
2. Client calls backend `/buzz` with sender + recipient proximity tokens
3. Backend validates rate limit (≤3/day/person) and proximity, then pushes a notification to the recipient
4. Recipient's device fires the distinctive Buzz Me haptic pattern
5. Both phones may open the Visualizer as a mutual "hey, that's me" signal

### Ghost Mode
1. User toggles Ghost Mode
2. BLE service stops scanning AND advertising
3. Location service halts (no geofences, no significant-change monitoring)
4. Haptics service ignores any residual proximity events
5. Promos still visible in-app (cached), but no new geofence-triggered notifications

---

## Cross-cutting concerns

### Battery
See spec §Battery Efficiency Strategy. Key architectural rules:
- BLE is primary; GPS is secondary and only in low-power modes
- No continuous high-accuracy location
- Background work is batched (iOS `BGAppRefreshTask`, Android `WorkManager`)
- Radar UI doesn't render in the background
- Visualizer is foreground only

### Privacy
- BLE broadcasts rotating anonymized tokens — never user IDs
- No raw GPS coordinates sync between users
- Reveal = mutual opt-in
- Ghost Mode is a full stop

### Error handling / offline
- Radar gracefully degrades to cached state when network is unavailable
- BLE proximity continues working offline (it's peer-to-peer)
- Haptic proximity alerts can fire without network (compatibility is cached)
- Buzz Me requires network (backend validates + routes)

### Telemetry
- Battery impact measurement is mandatory for any background code
- Event logging is privacy-first: no raw locations, no other-user identifiers

---

## Open architectural questions

See the matching section in [`docs/agents/architect.md`](../agents/architect.md) — drives ADRs to resolve:

- State management library
- BLE library
- Backend framework + hosting
- Matching engine topology (inline / service / batch)
- Proximity token rotation cadence
- Offline radar behavior spec
- Event ingestion pipeline shape
- Age verification / safety moderation
