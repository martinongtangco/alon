# ADR 0012: Milestone 1 Product Scope

Status: Accepted
Date: 2026-05-03

## Context

The product has no shipped code yet. Before any mobile development begins, the team needs a locked scope for the first milestone that is small enough to ship quickly but large enough to prove the core premise: **passive, proximity-based haptic discovery works reliably in the background on real hardware.**

## Decision

Milestone 1 is a **2-device Android lab test**. It is not a public release. Success criterion: both devices backgrounded, three distance bands trigger escalating haptic patterns correctly.

### In scope

| Area | Decision |
|---|---|
| Platform | Android only |
| BLE | Scanning + advertising via `react-native-ble-plx`, background foreground service |
| Proximity bands | 3 bands: Far (~10–15m), Near (~3–10m), Very Near (~0–3m) |
| Haptic escalation | Frequency-only patterns: `[0,100]` / `[0,100,100,100]` / `[0,100,50,100,50,100]` ms |
| RSSI smoothing | 5-reading rolling average + hysteresis bands (see ADR 0013) |
| Haptic cooldown | `BUZZ_COOLDOWN` platform config, default 2 minutes |
| Ghost Mode | Client-side only: stops BLE advertising and scanning |
| Onboarding | Full flow: display name + Vibe selection + profile photo + permissions |
| Vibe data | Collected and stored; **not used for matching** |
| Buzz Me | Blind Buzz: broadcasts to all users currently in Very Near band; no identity surfaced |
| Radar screen | Anonymous distance blobs only; no names, no photos |
| Backend | Token issuance, device registration, `BUZZ_COOLDOWN` config endpoint |
| Database | Redis only (see ADR 0014) |
| Deployment | Cloud from day one (Railway or Fly.io) |

### Explicitly out of scope

| Feature | Deferred to |
|---|---|
| Vibe matching engine | M2 (feature-flagged) |
| Mutual reveals + Matches screen | M2 |
| iOS port | M2 (parallel to Android beta) |
| Admin dashboard | Ships when useful — no milestone gate |
| Server-enforced Ghost Mode | M3 |
| Push notifications | M2 |
| Haptic intensity escalation | M2+ (OEM amplitude variance makes M1 testing unreliable) |

## Alternatives considered

1. **No backend in M1** — hardcoded UUIDs for the lab test. Rejected: retrofitting token architecture later means throwing away the BLE integration code. Ship the real architecture from day one.
2. **iOS first** — iOS background BLE is the harder platform. Rejected: Android foreground service is faster to implement and unblocks real-device validation sooner. iOS follows in M2.
3. **Match-free onboarding (name only)** — no Vibe data collected in M1. Rejected: collecting Vibes during onboarding sets the correct data model without adding matching complexity. One field vs. five fields is not the bottleneck.

## Consequences

- Ghost Mode client-side-only is a known privacy debt. A rooted device could re-enable BLE advertising while Ghost Mode appears on. Must be tracked and closed in M3 (server-enforced token deactivation).
- Vibe matching is a feature flag from day one. The `BUZZ_COOLDOWN` config endpoint proves the platform config system works before the dashboard ships.
- Anonymous radar blobs are the intentional product experience, not a placeholder. Identity is only surfaced via mutual reveal (M2).
