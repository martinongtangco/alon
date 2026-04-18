# app/ — vibr8.me mobile client

React Native app (iOS + Android). **Not yet scaffolded.**

When the architect has resolved the open decisions (state library, BLE library, navigation), this directory will be populated by running the scaffold command from the selected tooling (Expo or React Native CLI — TBD in an ADR).

## Planned structure

```
app/
├── src/
│   ├── components/            shared UI
│   ├── screens/               one folder per feature screen
│   │   ├── Radar/             primary — proximity radar map
│   │   ├── Matches/           mutual reveals
│   │   ├── Feed/              promos + activities
│   │   ├── Profile/           Vibes, mode, Ghost toggle
│   │   ├── Visualizer/        full-screen accelerometer art
│   │   └── Onboarding/        signup + Vibe setup
│   ├── navigation/            stack + tab navigators
│   ├── services/
│   │   ├── ble/               BLE scan + advertise
│   │   ├── location/          low-power GPS, geofencing
│   │   ├── haptics/           vibration patterns (named)
│   │   ├── proximity/         distance + compatibility
│   │   └── api/               backend client
│   ├── state/                 global store
│   ├── hooks/
│   ├── theme/                 color, type, spacing tokens
│   ├── utils/
│   ├── types/
│   └── constants/
└── assets/
    ├── images/
    └── fonts/
```

## Before you code

1. Read [`../CLAUDE.md`](../CLAUDE.md)
2. Read [`../docs/agents/engineer.md`](../docs/agents/engineer.md)
3. Read the feature's spec section in [`../docs/spec/app-spec.md`](../docs/spec/app-spec.md)
4. Check for an ADR that applies (`../docs/decisions/`)

## Haptic / BLE / motion testing

Simulators lie. Real device testing is mandatory for any feature that touches haptics, BLE, or device motion. See the engineer role doc for specifics.
