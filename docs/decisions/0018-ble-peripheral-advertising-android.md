# ADR 0018: BLE Peripheral Advertising Library for Android

Status: Accepted
Date: 2026-05-09
Accepted: 2026-05-09
Supplements: [ADR 0002](0002-ble-library.md), [ADR 0016](0016-android-foreground-service.md)

## Context

[ADR 0002](0002-ble-library.md) selected `react-native-ble-plx` as the BLE library and noted it "supports both scanning and advertising." In practice, `react-native-ble-plx` only implements the **central** (scanner) role on Android — peripheral/advertiser mode is not exposed via its public API. The current `app/src/services/ble/index.ts` has `@ts-ignore` on both `startAdvertising()` and `stopAdvertising()` calls, which means advertising is silently broken at runtime.

For the M1 lab test ([ADR 0012](0012-milestone-1-product-scope.md)), both devices must advertise their proximity token (a UUID v4, rotated every 15 min per [ADR 0011](0011-proximity-token-rotation-cadence.md)) so the other device can scan and detect it via `react-native-ble-plx`. Without advertising, Device A is invisible to Device B. M1 cannot pass in this state.

Constraints:
- Android only for M1. iOS peripheral mode (CoreBluetooth `CBPeripheralManager`) is deferred to M2.
- Must run inside the foreground service established by [ADR 0016](0016-android-foreground-service.md).
- Advertisement payload must include the vibr8.me service UUID (`f7a5c2-9d4e-11ef-b864-0242ac120002`) so scanning devices can filter on it, plus the current proximity token as manufacturer data.
- Must update the advertised payload when the token rotates without a full BLE restart.
- Battery target: 3–6% / hr total (spec §Battery Efficiency Strategy). Advertising alone contributes ~1% / hr on modern chipsets.

---

## Decision

Use **`react-native-ble-advertiser`** for Android BLE peripheral advertising.

`react-native-ble-advertiser` is a dedicated Android-only BLE advertiser library for React Native. It wraps the Android `BluetoothLeAdvertiser` API directly, is the most referenced solution for this use case in the React Native ecosystem, and has documented interoperability with `react-native-ble-plx` on the scan side — both libraries can run simultaneously on the same device without conflict.

### Install

Add to `app/package.json`:

```json
"react-native-ble-advertiser": "^0.16.0"
```

### Platform file split

Per project convention (engineer.md), platform-specific code uses file suffixes — no `Platform.OS` checks in business logic.

- **`app/src/services/ble/index.android.ts`** — real implementation using `react-native-ble-advertiser` + `react-native-ble-plx`
- **`app/src/services/ble/index.ios.ts`** — stub that satisfies the `BleService` interface; advertiser methods are no-ops with a `console.warn`; scanning via `react-native-ble-plx` can be wired in M2
- **`app/src/services/ble/index.ts`** — deleted; React Native's resolver picks the platform file automatically

### BleService interface

The exported interface gains one method for token rotation. All callers (`RadarScreen`, `bootstrap.ts`) use this interface — never import the platform file directly.

```ts
// app/src/services/ble/types.ts  (new file — shared by both platform files)
export interface BleService {
  start(): Promise<void>;
  stop(): void;
  updateToken(token: string): Promise<void>;          // call after each rotation
  onRssiReading(cb: (rssi: number) => void): () => void;
  subscribe(cb: (nearby: NearbyPerson[]) => void): () => void;
}
```

### Android implementation (`index.android.ts`) — advertising calls

```ts
import BLEAdvertiser from 'react-native-ble-advertiser';

const SERVICE_UUID = 'f7a5c2-9d4e-11ef-b864-0242ac120002';
const MANUFACTURER_ID = 0x4C00; // arbitrary; not Apple-reserved, not conflicting

// Inside start() — call after getCurrentToken()
await BLEAdvertiser.setCompanyId(MANUFACTURER_ID);
await BLEAdvertiser.broadcast(SERVICE_UUID, tokenToBytes(token), {
  advertiseMode: BLEAdvertiser.ADVERTISE_MODE_LOW_LATENCY,
  txPowerLevel: BLEAdvertiser.ADVERTISE_TX_POWER_MEDIUM,
  connectable: false,
  includeDeviceName: false,
  includeTxPowerLevel: false,
});

// Inside stop()
await BLEAdvertiser.stopBroadcast();

// Inside updateToken(token)
await BLEAdvertiser.stopBroadcast();
await BLEAdvertiser.broadcast(SERVICE_UUID, tokenToBytes(token), options);
```

### Token rotation wiring

`bootstrap.ts` owns the 14-min rotation timer. After a successful `POST /api/token/rotate`, it must notify the BLE service to re-advertise the new token. The wiring is:

1. `bootstrap.ts` calls `bleService.updateToken(newToken)` immediately after storing the new token in AsyncStorage
2. `bleService.updateToken()` runs the stop/re-broadcast sequence internally
3. `bootstrap.ts` imports `bleService` from `app/src/services/ble` — the platform resolver picks the correct file

The old token remains valid in Redis for the 30-second grace window ([ADR 0011](0011-proximity-token-rotation-cadence.md)), covering any in-flight scans during the ~100ms advertising gap.

### Advertise mode

`ADVERTISE_MODE_LOW_LATENCY` for M1 (lab test) — maximises detection speed at the cost of slightly higher battery drain. This is acceptable for a controlled 2-device test. Switch to `ADVERTISE_MODE_BALANCED` for M2 beta.

### Permissions

`BLUETOOTH_ADVERTISE` is already declared in `app.json` per [ADR 0016](0016-android-foreground-service.md). No additional permissions required.

---

## Alternatives considered

**`react-native-ble-plx` peripheral mode** — ADR 0002 claimed this library supports advertising, but the Android implementation does not expose `startAdvertising()` in a callable form. The only workaround is calling undocumented internal methods (hence the `@ts-ignore` in the current code), which produces a no-op at runtime. Rejected because it does not actually work on Android.

**`react-native-peripheral-manager`** — mirrors the iOS `CBPeripheralManager` API and provides an Android shim. Smaller community (~150 stars), last meaningful commit in 2023, and the Android implementation has known gaps with manufacturer data payloads. Rejected because maintenance risk is too high for a critical M1 dependency.

**Custom native Android module** — a thin Kotlin module wrapping `BluetoothLeAdvertiser` directly would give full control and zero third-party risk. Rejected for M1: it requires writing, testing, and maintaining native code before the lab test can run, and `react-native-ble-advertiser` provides the same surface area with substantially less effort. Revisit if `react-native-ble-advertiser` proves limiting in M2.

**Expo BLE plugins** — no peripheral/advertiser support exists in the Expo ecosystem as of 2026. Rejected.

---

## Consequences

- Two BLE packages coexist in `app/`: `react-native-ble-plx` (scanning, central role) and `react-native-ble-advertiser` (advertising, peripheral role). This is the standard pattern in the React Native BLE ecosystem — no single library reliably handles both roles on Android.
- The `BleService` interface in `app/src/services/ble/index.ts` does not change. The implementation replaces the two `@ts-ignore` stubs; callers (`RadarScreen`, `useAppStore`) require no changes.
- `react-native-ble-advertiser` is Android-only. The iOS advertising path (`CBPeripheralManager`) requires a separate solution in M2. The `bleService.start()` implementation must guard the advertiser calls with `Platform.OS === 'android'` to avoid runtime errors on iOS.
- Advertisement restarts on token rotation add ~100ms of advertising downtime per rotation cycle (every 15 min). During this window the device is undetectable. The 30-second Redis grace window ([ADR 0011](0011-proximity-token-rotation-cadence.md)) is unaffected — the grace window covers stale tokens on the scanning side, not advertising gaps.
- This ADR closes the advertising gap that was blocking M1. Combined with the RSSI smoothing implementation ([ADR 0013](0013-proximity-rssi-smoothing.md)) and foreground service ([ADR 0016](0016-android-foreground-service.md)), the 2-device lab test becomes runnable.
