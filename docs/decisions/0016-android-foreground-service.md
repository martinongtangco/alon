# ADR 0016: Android Foreground Service Strategy

Status: Accepted
Date: 2026-05-03
Closes: open decision listed in docs/decisions/README.md ("Android OEM background-restriction handling")
Supplements: [ADR 0002](0002-ble-library.md)

## Context

[ADR 0012](0012-milestone-1-product-scope.md) defines the M1 success criterion as: **both devices backgrounded, three distance bands trigger escalating haptic patterns correctly.**

This requires BLE scanning and advertising to continue while the app is not in the foreground. Android handles this differently from iOS:

- **Android 8+ (API 26+):** Background processes without a foreground service are eligible for immediate termination. A persistent BLE scan requires a **Foreground Service** — a service that displays a persistent notification and receives a `FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE` or `LOCATION` declaration in `AndroidManifest.xml`.

- **OEM battery overlays:** Samsung One UI, Xiaomi MIUI, OnePlus OxygenOS, and Huawei EMUI apply a second restriction layer on top of Android: **Adaptive Battery / App Standby Buckets / Auto-start controls**. These can kill foreground services despite them being correctly declared. The behaviour is OEM-specific and not fully predictable from code.

`react-native-ble-plx` (selected in [ADR 0002](0002-ble-library.md)) exposes `BleManager.startForegroundService()` for Android background BLE, which wraps the native foreground service API.

## Decision

### M1 (lab test — controlled hardware)

- Implement an Android foreground service via `react-native-ble-plx`'s `startForegroundService()`.
- Notification: minimal — title "vibr8.me is active", body "detecting nearby vibes", no interaction required.
- Require test hardware to have **battery optimization disabled** for the app before the test. Path: `Settings → Apps → vibr8.me → Battery → Unrestricted`.
- Accept: on stock Android (Pixel or AOSP-based) this is sufficient to pass M1.
- Do not attempt to handle OEM-specific restrictions in M1 code. The lab test uses controlled hardware.

### M2 (beta — real users)

- Add an in-app prompt on first BLE permission grant that deep-links to the battery optimization screen.
- Use `IntentLauncher` (from `expo-intent-launcher`) to open the OEM-specific battery settings screen where detectable.
- Add an OEM detection table (Samsung / Xiaomi / OnePlus) that maps to the correct `ACTION_` intent. This logic does not belong in M1.
- Write a separate ADR when implementing M2 background hardening.

### Haptic delivery constraint

Haptics fire on the main thread and **require the app to be in the foreground** on Android (VibrationEffect API limitation). In M1, the foreground service keeps BLE alive in the background, but haptics will only trigger if the user brings the app forward or if the foreground service notifies a `VibrationEffect` directly via the notification channel.

This is an accepted M1 limitation. Full background haptic delivery is an open question for M2 (may require a native module).

## Alternatives considered

1. **WorkManager for background BLE** — WorkManager can reschedule killed background work, but is not designed for persistent scanning. Minimum interval is 15 minutes, which is too coarse for proximity detection. Rejected.
2. **`react-native-background-actions`** — wraps a foreground service more abstractly. Adds a dependency without capability beyond what `react-native-ble-plx` already provides natively. Rejected.
3. **Accept flaky background on OEM devices** — fails the M1 success criterion. Rejected.
4. **Require all M1 testing on Pixel hardware only** — acceptable for the 2-device lab test. This is the M1 recommendation: use a Pixel 7 or equivalent stock Android device.

## Consequences

- A persistent notification is mandatory on Android for background BLE. It cannot be hidden. The notification must be designed as part of the product experience, not treated as a technical afterthought.
- M1 battery impact: a foreground service adds approximately 1–2% baseline drain. Combined with BLE scanning at 1-second intervals, the total is estimated at 4–6% / hr — within the 3–6% target from the spec. Calibration on real hardware is required.
- The engineer must add `FOREGROUND_SERVICE` and `FOREGROUND_SERVICE_CONNECTED_DEVICE` permissions to `AndroidManifest.xml` and declare the service under `<application>`.
- Background haptics in M1 require the app to be in foreground. This is a known limitation, not a bug. The foreground service keeps BLE alive; the user must have the app visible to feel the haptic.
- This ADR closes the "Android OEM background-restriction handling" open decision for M1. OEM-specific hardening is deferred to M2.
