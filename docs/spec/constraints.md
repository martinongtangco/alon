# Alon — Agent Constraints

Hard rules and current milestone scope. Read after CLAUDE.md, before your role doc.
Pull `docs/spec/app-spec.md` only for product or design work.

---

## Hard rules

- **No in-app chat.** No `/messages` endpoint, no message store, no typing indicator, no read receipts. Ever.
- **BLE is the primary proximity layer.** Never use continuous high-accuracy GPS.
- **Never advertise user IDs over BLE.** Only rotating anonymized proximity tokens (15-min TTL, ADR 0011).
- **Ghost Mode = full stop.** All BLE and location scanning halts. Not reduced — halted.
- **No exact GPS coordinates** cross the client/server boundary or transit between users.
- **Reveals are mutual and opt-in.** Nothing surfaces without both parties agreeing.
- **Buzz Me, not Poke.** In code, copy, and docs.
- **Battery target: 3–6% / hr background.** Instrument any background code before merge.
- **Visualizer: foreground only.** Never runs in the background.
- **Radar UI: foreground only.** Background process = haptics engine only.

---

## Current milestone: M1 — Android lab test (2 devices)

**Success criterion:** both devices backgrounded, three distance bands trigger escalating haptic patterns correctly.

**In scope:**

| Area | Detail |
|---|---|
| Platform | Android only |
| BLE | Scan + advertise via `react-native-ble-plx` + `react-native-ble-advertiser` |
| Proximity bands | very-near (~0–3m), near (~3–10m), far (~10–15m) |
| Haptic patterns | `faint_pulse` / `steady_rhythm` / `strong_buzz` per band |
| RSSI smoothing | 5-reading rolling average + hysteresis (ADR 0013) |
| Token rotation | 15-min proximity tokens, 14-min client timer (ADR 0011) |
| Ghost Mode | Client-side only: stops BLE advertising and scanning |
| Onboarding | display name + vibe selection + permissions (no photo in M1) |
| Buzz Me | Blind broadcast to very-near band, rate-limited via `BUZZ_COOLDOWN` (default 120s) |
| Radar | Anonymous distance blobs only — no names, no photos, no matching |
| Backend | `/api/register`, `/api/token/rotate`, `/api/config`, `/api/buzz`, `/api/matches` |
| Token store | Redis only |
| Deployment | Railway |

**Explicitly out of scope for M1:**

- Vibe matching / compatibility scoring
- Mutual reveals and Matches screen (M2)
- iOS (M2)
- Push notifications (M2)
- Server-enforced Ghost Mode (M3)
- Haptic intensity escalation (M2+)

---

## M2 — decisions made, not yet implemented

All M2 ADRs are Accepted. Implementation is the next phase.

| Feature | ADR |
|---|---|
| Vibe matching — inline Jaccard via `GET /api/nearby` | 0028 |
| Mutual reveal — Redis intent + Postgres matches | 0029 |
| iOS extension — background BLE modes, CoreHaptics | 0030 |
| Push notifications — `expo-notifications` → Expo push | 0031 |
| User accounts — phone + Twilio OTP | 0032 |
| Offline radar — BLE never stops, fallback token | 0033 |
| Event ingestion — admin CMS | 0034 |
| Age verification — DOB + self-declaration, Stripe Identity feature-flagged | 0035 |

---

## M3 — decided, deferred

| Feature | ADR |
|---|---|
| Server-enforced Ghost Mode — token revocation in Redis | 0036 |

---

## References

- Full product spec: `docs/spec/app-spec.md`
- All ADRs: `docs/decisions/README.md`
- Design system: `docs/design/visual-language.md`
