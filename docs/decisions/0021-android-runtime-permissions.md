# ADR 0021: Android Runtime Permissions for BLE

Status: Accepted
Date: 2026-05-10
Depends on: [ADR 0016](0016-android-foreground-service.md), [ADR 0018](0018-ble-peripheral-advertising-android.md)

## Context

ADR 0016 established that `app.json` declares BLE permissions at install time via the Expo plugin. This is necessary but not sufficient. Android 12+ (API 31+) classifies `BLUETOOTH_SCAN`, `BLUETOOTH_ADVERTISE`, and `BLUETOOTH_CONNECT` as `PROTECTION_DANGEROUS` — they must also be requested at runtime via `PermissionsAndroid.requestMultiple()` before any BLE call is made. Android <12 (API 23–30) does not require the BT permissions at runtime but does require `ACCESS_FINE_LOCATION` for BLE scanning (the OS uses location to protect passive scanning from revealing the user's physical context).

No part of the current app requests any runtime permission. When `BleManager.startDeviceScan()` is called without grants, it fails silently on Android 12+ — the scan starts but returns zero results. `BLEAdvertiser.broadcast()` throws. The M1 lab test cannot succeed in this state.

The Expo managed workflow does not auto-request runtime permissions — it only manages manifest entries. Permission requests are the app's responsibility.

## Decision

### Library

**`PermissionsAndroid`** from `react-native` (zero new dependencies — already in the RN bundle). Do not use `expo-permissions` (deprecated in SDK 46+).

### Permissions by Android version

```ts
import { PermissionsAndroid, Platform } from 'react-native';

async function requestBlePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true; // iOS: handled by app.json / Info.plist

  // Android 12+ (API 31+): BT permissions are runtime-dangerous
  if (Platform.Version >= 31) {
    const grants = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]);
    return Object.values(grants).every(
      (g) => g === PermissionsAndroid.RESULTS.GRANTED,
    );
  }

  // Android 6–11: BT permissions are install-time only; LOCATION is runtime-required for scanning
  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  );
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}
```

### When to request

During the **`permissions` step of onboarding** (`app/src/screens/Onboarding/index.tsx`), before the user taps "let's go". The function is called when the step renders, not on button press — this gives the OS time to show the system dialog before the user taps through.

Concretely, add a `useEffect` in the onboarding screen that fires when `step === 'permissions'`:

```ts
useEffect(() => {
  if (step === 'permissions') {
    requestBlePermissions().then(setPermissionsGranted);
  }
}, [step]);
```

`setPermissionsGranted` is local state (`useState<boolean>(true)` defaulting to true so non-Android or pre-12 users are never blocked).

### Graceful degradation on denial

Do **not** hard-block onboarding. If permissions are denied:
- Onboarding completes normally.
- `bleService.start()` in `RadarScreen` catches the resulting `BleError` and sets a `bleUnavailable` local state flag.
- The radar placeholder renders with copy: *"bluetooth permission required to detect nearby vibes. grant it in settings to continue."*
- Ghost Mode is implicitly true for the session (no scanning, no advertising), but the toggle is not locked — if the user grants permission later and restarts, the app recovers.

Rationale: blocking onboarding on a permission denial is hostile UX and reduces grant rates. The spec's Ghost Mode handling already covers a "no BLE" state gracefully.

### Copy update — onboarding permissions step

Replace the placeholder copy in `app/src/screens/Onboarding/index.tsx` (permissions step):

```
Alon needs bluetooth to detect nearby vibes. on android 12+, you'll
see a system permission dialog — tap "allow" for each.

why location? android requires it for bluetooth scanning. Alon never
uses your location for anything else.

battery target: 3–6% per hour, comparable to spotify.
```

### File to modify

**`app/src/screens/Onboarding/index.tsx`** — permissions step only. No other files change.

Export `requestBlePermissions` from a new utility file **`app/src/utils/permissions.ts`** so it can be tested in isolation and reused by any future permission re-request flow.

## Alternatives considered

**`expo-permissions`** — deprecated since Expo SDK 46. Would add a dead dependency. Rejected.

**Request on app launch (before onboarding)** — Android UX guidelines recommend requesting permissions in context, when the user understands why they're needed. Launching a permission dialog before the user has seen any product copy produces lower grant rates. Rejected.

**Hard-block onboarding on denial** — Hostile. Users who deny, then change their mind, would need to reinstall. Ghost Mode + settings-link is the right degradation path. Rejected.

**`expo-modules-core` permission utilities** — Wraps `PermissionsAndroid` without adding capability. Unnecessary indirection. Rejected.

## Consequences

- `app/src/utils/permissions.ts` is a new file (small utility, no state).
- Onboarding adds one async call per session. Negligible UX impact — the system dialog itself takes longer than the JS call.
- M1 lab test must run on Android 12+ hardware (Pixel 7 recommended per ADR 0016). The `Platform.Version >= 31` branch is the only one that will execute.
- iOS: no changes. The `react-native-ble-plx` plugin handles `NSBluetoothAlwaysUsageDescription` via `app.json` — no runtime request is needed for iOS BT.
- Ghost Mode privacy debt (ADR 0012): a denied-BLE user is effectively in ghost mode but this is not surfaced as such in the UI. The behaviour is correct (invisible to others, no scanning) even if the label isn't shown. This is acceptable for M1.
