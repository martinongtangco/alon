# ADR 0002: BLE Library Selection

Status: Accepted
Date: 2026-04-19
Accepted: 2026-05-03

## Context
The vibr8.me app requires a Bluetooth Low Energy (BLE) library that supports both scanning and advertising capabilities on both iOS and Android platforms. The spec mandates that BLE is the primary proximity tool, with strict battery efficiency requirements.

Key constraints:
- Must support both scanning and advertising 
- Must work reliably on both iOS and Android
- Must be compatible with platform-specific background execution models
- Must integrate well with React Native
- Must maintain low power consumption as specified in the Battery Efficiency Strategy

## Decision
We will use **react-native-ble-plx** as the BLE library.

## Alternatives considered
1. **react-native-ble-manager** - Has a good feature set but is more complex and has had some maintenance issues in recent versions.
2. **react-native-ble-android** - Only for Android, doesn't support iOS cross-platform needs.
3. **Native implementation** - Would require significant platform-specific code and maintenance overhead.

## Consequences
- **Pros**:
  - Actively maintained with good community support
  - Cross-platform (iOS + Android) 
  - Supports both scanning and advertising
  - Good TypeScript support
  - Well-documented with examples
  - Integrates smoothly with React Native
  - Active development and bug fixes
- **Cons**:
  - May not have all the advanced features of native libraries
  - Requires careful memory management for continuous scanning
  - Performance may be limited by JavaScript bridge overhead

This library meets our core requirements for both platforms while being well-maintained and documented. It also supports the battery efficiency requirements through its low-level control over BLE operations.

## Implementation Notes

### M1 scope
The BLE service has two responsibilities: **advertising** this device's current proximity token, and **scanning** for nearby vibr8.me devices to generate RSSI readings for the proximity layer. No connection establishment is required — all proximity detection is passive and connectionless.

### Advertising
- Advertise a GATT service using the fixed vibr8.me app identifier UUID: `f7a5c2-9d4e-11ef-b864-0242ac120002`
- Include the current proximity token (UUID v4) as manufacturer data in the advertisement payload
- On token rotation (15-min timer per [ADR 0011](0011-proximity-token-rotation-cadence.md)), call `POST /api/token/rotate` ([ADR 0015](0015-app-api-topology.md)) and update the manufacturer data to the new token — the old token remains valid in Redis for the 30-second grace window
- On Android, advertising runs inside the foreground service — see [ADR 0016](0016-android-foreground-service.md)

### Scanning
- Call `BleManager.startDeviceScan(['f7a5c2-9d4e-11ef-b864-0242ac120002'], { allowDuplicates: true }, callback)` — `allowDuplicates: true` is required to receive continuous RSSI updates from the same peripheral rather than a single discovery event
- Scan interval: 1 second, matching the smoothing window in [ADR 0013](0013-proximity-rssi-smoothing.md)
- For each device event, emit `rssi: number` to the proximity service
- The proximity service owns smoothing (rolling average + hysteresis) — the BLE service emits raw RSSI only

### Install

Add to `app/package.json` dependencies (run from the `app/` directory):

```
"react-native-ble-plx": "^3.4.0"
```

Then run `npm install` inside `app/`.

### Module interface (`app/src/services/ble/index.ts`)
```ts
interface BleService {
  start(): Promise<void>;                              // request permissions, start scan + advertise
  stop(): void;                                        // stop scan + advertise, release foreground service
  onRssiReading(cb: (rssi: number) => void): () => void; // returns unsubscribe fn
}
```
This file already exists as `MockBleService`. The real implementation replaces it; the interface must remain compatible so the proximity service and store require no changes.

### Permissions
Add to `app.json` under `expo.android.permissions`:
`BLUETOOTH`, `BLUETOOTH_ADMIN`, `BLUETOOTH_SCAN`, `BLUETOOTH_ADVERTISE`, `BLUETOOTH_CONNECT`

The foreground service plugin config for `react-native-ble-plx` (under `expo.plugins`) generates the required `AndroidManifest.xml` entries at build time — see [ADR 0016](0016-android-foreground-service.md) for the exact manifest requirements.

### Platform notes
- **Android**: Call `BleManager.startForegroundService()` before `startDeviceScan()`. Test on stock Android (Pixel). Disable battery optimization for the app manually before the M1 lab test.
- **iOS**: CoreBluetooth truncates advertisement payloads in the background — the service UUID remains visible but manufacturer data may be dropped. Acceptable for M1 (Android-only lab test per [ADR 0012](0012-milestone-1-product-scope.md)).
- OEM-specific battery restriction handling (Samsung, Xiaomi) is deferred to M2 per [ADR 0016](0016-android-foreground-service.md).