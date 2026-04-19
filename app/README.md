# app/ — vibr8.me mobile client

React Native (Expo) prototype, TypeScript. **All services are mocked** — no real BLE, no real backend yet.

## What works in this prototype

- Onboarding flow (name, vibes, mode)
- Radar screen with sweeping radar, ambient pulse rings, mocked nearby people / promos / events
- Tap a person → Vibe Card → Buzz Me (proximity + rate-limit gated, fires real haptic, opens Visualizer)
- Matches screen (mocked + buzzes you send)
- Feed screen (mocked promos + events)
- Profile (toggle mode, vibes, Ghost Mode — Ghost Mode actually halts the mock BLE scanner)
- Visualizer — full-screen accelerometer-driven art, auto-cycles 5 modes, real device motion via `expo-sensors`

## What's mocked vs. real

| Layer | Status |
|---|---|
| `services/ble` | mocked — emits jittered fake nearby people every 2.5s |
| `services/location` | mocked — emits a fake fix every 30s |
| `services/proximity` | real logic on mocked input |
| `services/haptics` | **real** via `expo-haptics` (will actually buzz on a device) |
| `services/api` | mocked — returns `{ ok: true, mode: 'mock' }` |
| Visualizer accelerometer | **real** via `expo-sensors` |

Per ADR-0002, real BLE will use `react-native-ble-plx` — that requires `expo prebuild` and is intentionally deferred until the engineer is ready to test on hardware.

## Running

### One-time setup

```bash
cd app
npm install
```

### Android emulator (Windows)

1. Install **Android Studio**, then in the SDK Manager grab an Android 14 (API 34) system image.
2. Open **Device Manager** in Android Studio and create a Pixel 7 AVD with that image. Start it.
3. From `app/`:

   ```bash
   npm run android
   ```

   First run takes a couple minutes — Expo dev server boots, then Expo Go is installed into the emulator and the JS bundle is sent over.

4. If Expo can't find the emulator, make sure `adb devices` lists it. ANDROID_HOME / `platform-tools` should be on PATH.

### Expo Go on a physical device (recommended for haptics)

```bash
npm start
```

Scan the QR code with the Expo Go app (Play Store / App Store).

> Haptics and motion **cannot** be validated in an emulator — see engineer hard rule #2. The Buzz Me haptic and Visualizer accelerometer only feel right on a real phone.

### iOS simulator (macOS only)

```bash
npm run ios
```

## Project layout

```
app/
├── App.tsx
├── index.ts
├── app.json                 Expo config
├── src/
│   ├── components/          shared UI (Button, Pill, VibeSignal)
│   ├── screens/             Radar, Matches, Feed, Profile, Visualizer, Onboarding
│   ├── navigation/          stack + bottom tabs
│   ├── services/            ble, location, haptics, proximity, api (all mocked except haptics)
│   ├── state/               Zustand store
│   ├── theme/               colors, spacing, typography (from docs/design/visual-language.md)
│   ├── types/
│   └── constants/           mockData.ts
```

## Type check

```bash
npm run tsc
```

## Engineering notes

- Spec: [`../docs/spec/app-spec.md`](../docs/spec/app-spec.md)
- Engineer role: [`../docs/agents/engineer.md`](../docs/agents/engineer.md)
- ADRs: [`../docs/decisions/`](../docs/decisions/)

### Hard rules respected

- ✗ no in-app chat anywhere
- ✗ no `Poke` — only `Buzz Me`
- ✗ no user IDs in mocked BLE payload — `token` field only
- ✓ Ghost Mode halts the mock scanner (not "reduces")
- ✓ Buzz Me proximity-gated to ~100m and rate-limited to 3/day/person, both enforced in `state/store.ts`

### Known gaps (intentional)

- No backend, no real BLE, no real geofences, no background tasks. Battery telemetry not yet instrumented (no background code to instrument).
- No real-device testing has been done — this prototype has only been type-checked.
