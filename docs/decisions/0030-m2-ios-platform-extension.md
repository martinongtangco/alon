# ADR 0028: M2 — iOS Platform Extension

Status: Accepted
Date: 2026-05-14
Milestone: M2
Depends on: [ADR 0002](0002-ble-library.md), [ADR 0016](0016-android-foreground-service.md), [ADR 0018](0018-ble-peripheral-advertising-android.md), [ADR 0021](0021-android-runtime-permissions.md)

## Context

M1 is Android-only (ADR 0012). M2 brings iOS online in parallel with the Android beta. iOS and Android differ significantly in three areas that have architectural implications:

1. **BLE background execution** — iOS background BLE is governed by `CBCentralManager` and `CBPeripheralManager` background modes declared in `Info.plist`. There is no foreground service equivalent. iOS background BLE scanning is restricted to known service UUIDs; blind scanning is suspended in background.
2. **Haptics API** — iOS uses `CoreHaptics` (Taptic Engine, `CHHapticEngine`) via `expo-haptics`. Android uses `VibrationEffect`. The `expo-haptics` wrapper abstracts both but the underlying capabilities differ: iOS supports amplitude and sharpness parameters; Android supports millisecond timing arrays. The M1 haptic patterns (ms-array based) must be translated to `ImpactFeedbackStyle` equivalents on iOS.
3. **Runtime permissions** — iOS requires a single `NSBluetoothAlwaysUsageDescription` key in `Info.plist`. No runtime permission dialog for BLE on iOS 13+; permission is requested when `CBCentralManager` is first initialised.

## Decision

### BLE background mode

Add the following to `app.json` (Expo managed workflow):

```json
"ios": {
  "infoPlist": {
    "UIBackgroundModes": ["bluetooth-central", "bluetooth-peripheral"],
    "NSBluetoothAlwaysUsageDescription": "Alon uses Bluetooth to detect nearby users. Your location is never shared."
  }
}
```

`bluetooth-central` enables background BLE scanning for known service UUIDs. `bluetooth-peripheral` enables background advertising. Both are required for the M1 proximity model to function on iOS.

**Critical constraint:** iOS will only deliver BLE scan results in background for devices advertising the `SERVICE_UUID` registered at scan start. The `SERVICE_UUID` (`f7a5c2d9-9d4e-11ef-b864-0242ac120002`, ADR 0022) is the same across platforms — no change needed.

No foreground service is required on iOS. The background modes declaration is sufficient. The Android foreground service notification (ADR 0016) has no iOS equivalent.

### Haptic patterns — iOS translation

The M1 patterns are defined as ms-timing arrays in `app/src/services/haptics/index.ts`. On iOS, `expo-haptics` does not support arbitrary timing arrays — it maps to `Haptics.impactAsync(style)` where style is `Light | Medium | Heavy | Rigid | Soft`.

The iOS haptic implementation in `app/src/services/haptics/index.ios.ts` (new file) maps patterns to impact styles:

| Pattern | iOS style | Rationale |
|---|---|---|
| `faint_pulse` | `Haptics.impactAsync(ImpactFeedbackStyle.Light)` | Subtle — someone in the far band |
| `steady_rhythm` | `Haptics.impactAsync(ImpactFeedbackStyle.Medium)` | Noticeable — someone in the near band |
| `strong_buzz` | `Haptics.impactAsync(ImpactFeedbackStyle.Heavy)` | Unmistakable — someone right next to you |
| `buzz_me` | `Haptics.notificationAsync(NotificationFeedbackType.Success)` | Distinct from passive — Buzz Me confirmation |

The `steady_rhythm` pattern on Android fires three pulses (`[0,100,100,100]`). On iOS a single `Medium` impact is used — CoreHaptics rhythm patterns require `CHHapticPattern` which is not exposed by `expo-haptics`. The single impact is a pragmatic approximation. If user testing requires multi-pulse patterns on iOS, a native module can be introduced in M3.

### Permissions

The `app/src/utils/permissions.ts` file already uses the platform split convention. Add an `index.ios.ts` variant:

```ts
// app/src/utils/permissions.ios.ts
export async function requestBlePermissions(): Promise<boolean> {
  // iOS permission is requested implicitly when CBCentralManager initialises.
  // Expo managed workflow handles this via the Info.plist keys above.
  // Return true — no runtime dialog needed here.
  return true;
}
```

The Android `requestBlePermissions` in `permissions.android.ts` (rename from `permissions.ts`) remains unchanged.

### BLE service — iOS implementation

`app/src/services/ble/index.ios.ts` already exists (created in M1 scaffolding). It must be verified against the following requirements for M2:

- Uses the corrected `SERVICE_UUID` (`f7a5c2d9-9d4e-11ef-b864-0242ac120002`)
- Does not call `manager.startForegroundService()` (Android-only API — this would throw on iOS)
- Does not call `manager.enable()` (Android-only — opens system Bluetooth dialog; iOS handles this natively)
- Start sequence: initialise `BleManager` → wait for `PoweredOn` state → start scan → start advertising

### No OEM battery kill on iOS

Android OEM battery optimisation (Samsung/Xiaomi killing background processes) is not a concern on iOS. The iOS background modes declaration is honoured by the OS. The mitigation strategies in ADR 0016 (foreground service notification, wake-lock) are Android-specific and do not apply to the iOS build.

## Alternatives considered

**CHHapticPattern for multi-pulse patterns on iOS** — provides the exact ms-timing behaviour from M1. Requires a native module (Expo bare workflow or native module plugin). The added complexity is not justified when `expo-haptics` `ImpactFeedbackStyle.Medium` covers the UX need. Deferred to M3 if user testing shows the approximation is insufficient.

**Separate BLE library for iOS** — rejected per ADR 0002. `react-native-ble-plx` supports both platforms.

**iOS as a separate M3 milestone** — the spec lists iOS as an M2 deliverable. The technical risk (BLE background modes, CoreHaptics) is understood and contained. Bringing iOS online in M2 alongside Android beta maximises device coverage for real-world testing.

## Consequences

- Two new files: `app/src/services/haptics/index.ios.ts` and `app/src/utils/permissions.ios.ts`.
- `app/src/utils/permissions.ts` should be renamed `permissions.android.ts` to be explicit. React Native's platform-specific file resolution will pick `.android.ts` on Android and `.ios.ts` on iOS, with `.ts` as the fallback. Renaming makes the split explicit.
- `app.json` gains `ios.infoPlist` keys — requires an Expo build; cannot be tested in Expo Go.
- iOS haptics produce single-impact patterns where Android produces rhythmic buzzes. This is a known divergence. The product experience is "approximately equivalent" not "identical." The spec does not mandate identical haptic output across platforms.
- Background BLE on iOS requires the app to have been launched at least once. On a fresh install with no foreground launch, background scanning does not start. This matches Android behaviour (foreground service requires user to open the app first).
