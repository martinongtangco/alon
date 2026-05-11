# ADR 0028: iOS Port — Platform Split Strategy

Status: accepted

M1 is Android-only. M2 ports to iOS in parallel with the Android beta. iOS has different background BLE constraints, a different haptics API, and a stricter permissions model. This ADR defines what is shared, what is split, and where the platform boundary lives.

## Decision

### What is shared (no changes needed)

- All screen components (`app/src/screens/`) — no platform-specific UI
- State management (`app/src/state/store.ts`) — Zustand + AsyncStorage works identically
- Navigation (`app/src/navigation/`) — React Navigation is cross-platform
- API service (`app/src/services/api/`) — fetch-based, no platform dependency
- Proximity scoring (`app/src/services/proximity/`) — pure TypeScript
- Theme and components — cross-platform already

### What is split (`.android.ts` / `.ios.ts`)

**BLE service** — already split (`index.android.ts` / `index.ios.ts`). The iOS file needs:
- Remove `BLEAdvertiser` (Android-only). iOS peripheral advertising uses `react-native-ble-plx`'s `BleManager.startDeviceScan()` in central mode only — iOS restricts background peripheral advertising for third-party apps. **The iOS device can scan but cannot advertise in the background.** This is a known platform constraint; it means iOS users are discoverable only when the app is foregrounded. Document this in the iOS onboarding step.
- Remove `manager.startForegroundService()` — iOS has no equivalent. The foreground service call is already inside a try/catch per ADR 0022; on iOS it will throw and be swallowed. No additional change needed.
- Background BLE on iOS requires the `bluetooth-central` background mode declared in `app.json` (`expo.ios.infoPlist.UIBackgroundModes`). Add `"bluetooth-central"` to the list. **Do not add `bluetooth-peripheral`** — Apple rejects apps that declare peripheral mode without a valid justification and Alon does not have one.

**Permissions utility** (`app/src/utils/permissions.ts`) — already has platform branches. iOS BLE requires `NSBluetoothAlwaysUsageDescription` in `Info.plist` (set via `app.json` `expo.ios.infoPlist`). No code change needed — `react-native-ble-plx` handles the permission request; the description string must be set in config.

**Haptics** — `expo-haptics` already abstracts `CoreHaptics` (iOS) and `VibrationEffect` (Android). No split needed. The existing `app/src/services/haptics/index.ts` works as-is.

### `app.json` additions for iOS

```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "app.alon.mobile",
      "infoPlist": {
        "UIBackgroundModes": ["bluetooth-central", "fetch"],
        "NSBluetoothAlwaysUsageDescription": "Alon uses Bluetooth to sense who's nearby — without ever sharing your location.",
        "NSLocationWhenInUseUsageDescription": "Alon uses your area (never your exact location) to show nearby promos.",
        "NSLocationAlwaysAndWhenInUseUsageDescription": "Alon uses your area in the background to alert you to nearby promos."
      }
    }
  }
}
```

### Known iOS constraint — no background advertising

iOS 13+ prohibits third-party apps from advertising BLE peripherals in the background. This means:
- An iOS device running Alon in the background **cannot be detected** by another device.
- An iOS device **can detect** Android devices and other foregrounded iOS devices.

This asymmetry is acceptable for M2 beta. It must be communicated clearly in iOS onboarding: *"For the best experience, keep Alon in the foreground when you're out."* Server-enforced Ghost Mode (ADR 0031) will handle the corollary privacy case.

## Alternatives considered

**Use a third-party peripheral advertising library for iOS** — some libraries attempt to work around the iOS background advertising restriction using iBeacon framing. Rejected: iBeacon requires an MFi license for some use cases, Apple reviews these closely, and the workarounds are fragile across iOS versions. Accepted constraint.

**iOS-first instead of iOS-parallel** — do iOS before Android beta to capture the higher-value demographic. Rejected: Android unblocks real-device testing faster (ADR 0012), and the iOS port is mostly additive given the existing split architecture.

## Consequences

- `app/src/services/ble/index.ios.ts` — remove `BLEAdvertiser` import, remove foreground service call, keep scanner logic.
- `app.json` — add iOS bundle ID, background modes, and usage description strings.
- iOS onboarding step adds a note about foreground-preferred usage.
- No new packages. `react-native-ble-plx` and `expo-haptics` are already cross-platform.
- CI should run a TypeScript check for both `.ios.ts` and `.android.ts` entry points.
