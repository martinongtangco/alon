# ADR 0013: Proximity RSSI Smoothing Strategy

Status: Accepted
Date: 2026-05-03

## Context

BLE RSSI (signal strength) is inherently noisy. A single reading can swing ±10 dBm due to multipath interference, device orientation, and body occlusion. Without smoothing, a user hovering at the boundary between two distance bands would cause rapid oscillation — the haptic would fire-stop-fire-stop in quick succession, degrading the experience.

The three distance bands (see ADR 0012) have nominal RSSI thresholds:
- Far / Near boundary: ~-70 dBm
- Near / Very Near boundary: ~-55 dBm

These thresholds are starting points and will require tuning on real hardware.

## Decision

**5-reading rolling average + hysteresis bands (±5 dBm guard at each threshold).**

A device must cross a threshold by at least 5 dBm — measured on the smoothed average — before the band state changes. Band state does not change on a single exceedance; it changes only when the smoothed average sustains the new level through the guard zone.

## Alternatives considered

1. **Raw RSSI, no smoothing** — triggers haptic oscillation at band boundaries. Rejected.
2. **Simple rolling average only, no hysteresis** — reduces noise but still oscillates when the smoothed average hovers near a threshold. Rejected.
3. **Kalman filter** — optimal for this type of signal, but adds implementation complexity for marginal gain over hysteresis in a 3-band step function. Reserved for future tuning if rolling average + hysteresis proves insufficient. Rejected for M1.
4. **Larger rolling window (10–20 readings)** — more stable but introduces perceptible lag when two users genuinely move between bands quickly. 5 readings (~2–5 seconds at typical scan intervals) is the right balance.

## Consequences

- RSSI thresholds (-90/-70/-55 dBm) are initial estimates. Calibration on real Android hardware is required before M2.
- Hysteresis guard of ±5 dBm means the effective transition zone is 10 dBm wide. At typical BLE signal decay rates (~20 dBm per decade of distance), this corresponds to roughly 1–2 metres of physical distance — acceptable for the 3-band model.
- Scan interval directly affects smoothing latency. A 1-second scan interval with a 5-reading window gives ~5 seconds of smoothing lag. This must be balanced against battery targets (3–6% / hr) set in the spec.

## Implementation

**File:** `app/src/services/proximity/index.ts`

The proximity service subscribes to raw RSSI readings from the BLE service and applies the smoothing algorithm. The BLE service never applies smoothing — it emits raw values only.

**Interface:**

```ts
export type ProximityBand = 'out-of-range' | 'far' | 'near' | 'very-near';

export interface ProximityService {
  start(onRssi: (cb: (rssi: number) => void) => () => void): void;
  stop(): void;
  onBandChange(cb: (band: ProximityBand) => void): () => void;
}
```

**Algorithm:**

```ts
const WINDOW = 5;
const THRESHOLDS = { nearFar: -70, veryNearNear: -55 };
const HYSTERESIS = 5;  // dBm guard either side of each threshold
const STALE_MS = 5000; // no reading in 5s → out-of-range

// Rolling average
const readings: number[] = [];
function addReading(rssi: number): number {
  readings.push(rssi);
  if (readings.length > WINDOW) readings.shift();
  return readings.reduce((a, b) => a + b, 0) / readings.length;
}

// Band from smoothed RSSI (no hysteresis — raw mapping)
function bandFor(avg: number): ProximityBand {
  if (avg < -90) return 'out-of-range';
  if (avg < THRESHOLDS.nearFar) return 'far';
  if (avg < THRESHOLDS.veryNearNear) return 'near';
  return 'very-near';
}

// Hysteresis check: only change band if smoothed avg has crossed threshold by ±HYSTERESIS
// e.g. far→near requires avg ≤ (nearFar - HYSTERESIS) = -75 dBm
// e.g. near→far requires avg ≥ (nearFar + HYSTERESIS) = -65 dBm
```

The service emits `onBandChange` only when the band actually changes after applying hysteresis. Multiple RSSI readings at the same band do not re-fire the callback.

### Stale timer

When no RSSI reading arrives within `STALE_MS`, the band resets to `out-of-range` and `onBandChange` fires. Implemented with a rolling `setTimeout`:

```ts
let staleTimer: ReturnType<typeof setTimeout> | null = null;

function resetStaleTimer(onStale: () => void) {
  if (staleTimer) clearTimeout(staleTimer);
  staleTimer = setTimeout(onStale, STALE_MS);
}
```

Call `resetStaleTimer` on every `addReading()`. On stale: clear the readings buffer, set band to `out-of-range`, emit `onBandChange`.

### Coexistence with existing `signalLevelFor`

The existing `proximityService.signalLevelFor(nearby: NearbyPerson[])` is used by `RadarScreen` to drive the `VibeSignal` UI meter. It must be replaced — the new service owns both band detection and signal level derivation.

Add a `bandToSignalLevel` helper to `proximity/index.ts`:

```ts
export function bandToSignalLevel(band: ProximityBand): SignalLevel {
  switch (band) {
    case 'very-near': return 5;
    case 'near':      return 3;
    case 'far':       return 1;
    default:          return 0;
  }
}
```

`RadarScreen` calls `setSignalLevel(bandToSignalLevel(band))` inside its `onBandChange` subscriber. The old `signalLevelFor` export is deleted.

### Wiring in `RadarScreen`

`app/src/screens/Radar/index.tsx` owns the BLE + proximity lifecycle. The existing `useEffect` expands to:

```ts
useEffect(() => {
  if (profile.ghostMode) {
    bleService.stop();
    proximityService.stop();
    return;
  }

  bleService.start();
  proximityService.start(bleService.onRssiReading.bind(bleService));

  const unsubBle = bleService.subscribe((people) => setNearby(people));
  const unsubBand = proximityService.onBandChange((band) => {
    setSignalLevel(bandToSignalLevel(band));
    // haptic wiring is handled by useProximityHaptics hook — see ADR 0020
  });

  return () => {
    unsubBle();
    unsubBand();
    bleService.stop();
    proximityService.stop();
  };
}, [profile.ghostMode, setNearby, setSignalLevel]);
```

`proximityService` is a singleton exported from `app/src/services/proximity/index.ts`, same pattern as `bleService` and `hapticsService`. No changes to the store or any other caller.
