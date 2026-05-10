# ADR 0020: Haptic Proximity Loop Wiring

Status: Accepted
Date: 2026-05-10
Accepted: 2026-05-10
Depends on: [ADR 0013](0013-proximity-rssi-smoothing.md), [ADR 0016](0016-android-foreground-service.md)

## Context

ADR 0013 specifies the RSSI smoothing algorithm and the `ProximityService` interface (`onBandChange`). It does not specify what consumes `onBandChange` or where the passive haptic loop lives. The `hapticsService` (in `app/src/services/haptics/index.ts`) already has `play(pattern)` and `patternForDistance()` but is never called passively — haptics only fire today on explicit Buzz Me tap.

The spec (§ Proximity Vibration Engine) requires:
> *Phone vibrates in graduated patterns based on distance to compatible users. Fully passive — no need to open the app.*

M1 constraint (ADR 0016): haptics require the app in the foreground on Android. Background haptic delivery is deferred to M2.

Two design questions this ADR resolves:
1. **Where does the haptic subscription live?** — it must start/stop with the radar lifecycle and respect ghost mode.
2. **How do we prevent haptic spam?** — `onBandChange` fires on every band transition, not on every RSSI reading. But rapid physical movement (or multipath noise surviving hysteresis) could still trigger multiple transitions in quick succession. A per-band cooldown prevents buzzing the user repeatedly for the same proximity event.

## Decision

### Location

A custom hook `useProximityHaptics` in `app/src/hooks/useProximityHaptics.ts`. It is called once in `RadarScreen` alongside the existing BLE useEffect.

Rationale: hooks are the correct React primitive for side-effect subscriptions tied to component lifecycle. The hook is not a component and not a service — it lives in `app/src/hooks/` per engineer.md conventions.

### Band → pattern mapping

| `ProximityBand` | `HapticPattern` | Spec description |
|---|---|---|
| `very-near` | `strong_buzz` | Within ~20m — right next to you |
| `near` | `steady_rhythm` | Within ~100m |
| `far` | `faint_pulse` | Within ~500m |
| `out-of-range` | _(none)_ | No one nearby |

Ascending transitions (moving closer) always fire. Descending transitions (moving away) do not fire — silence is the correct signal for someone leaving range.

### Per-band cooldown

After a haptic fires for a given band, the same band cannot fire again for `HAPTIC_COOLDOWN_MS = 8000` (8 seconds). The cooldown resets when the band changes. This prevents buzz spam if a user is hovering at a boundary.

### Ghost mode

When `ghostMode` is true, the hook does not subscribe to `onBandChange`. If ghost mode is toggled on while active, the subscription is cleaned up in the hook's cleanup function via the standard `useEffect` dependency array.

### File to create

**`app/src/hooks/useProximityHaptics.ts`** (new file):

```ts
import { useEffect, useRef } from 'react';
import { proximityService } from '../services/proximity';
import { hapticsService } from '../services/haptics';
import { ProximityBand } from '../services/proximity';

const HAPTIC_COOLDOWN_MS = 8000;

export function useProximityHaptics(ghostMode: boolean): void {
  const lastFiredBand = useRef<ProximityBand | null>(null);
  const cooldownUntil = useRef<number>(0);

  useEffect(() => {
    if (ghostMode) return;

    const unsub = proximityService.onBandChange((band) => {
      if (band === 'out-of-range') return;

      const now = Date.now();
      const sameband = band === lastFiredBand.current;
      const inCooldown = now < cooldownUntil.current;

      if (sameband && inCooldown) return;

      const pattern = band === 'very-near'
        ? 'strong_buzz'
        : band === 'near'
        ? 'steady_rhythm'
        : 'faint_pulse';

      hapticsService.play(pattern).catch(() => {});
      lastFiredBand.current = band;
      cooldownUntil.current = now + HAPTIC_COOLDOWN_MS;
    });

    return unsub;
  }, [ghostMode]);
}
```

### Wiring in `RadarScreen`

Add one line to `app/src/screens/Radar/index.tsx`:

```ts
import { useProximityHaptics } from '../../hooks/useProximityHaptics';

// inside RadarScreen component, alongside existing hooks:
useProximityHaptics(profile.ghostMode);
```

No other files change.

## Alternatives considered

**Wiring haptics directly in `RadarScreen`'s existing `useEffect`** — possible but conflates two concerns (BLE lifecycle + haptic response) in one effect. Rejected: the hook separation keeps each effect focused and independently testable.

**Wiring haptics in the Zustand store action** — the store is not the right place for side effects that depend on React component lifecycle and ghost mode state. Rejected.

**Firing haptics on both ascending and descending band transitions** — buzzing when someone walks away adds no useful information and trains users to ignore the vibration. Rejected: ascending only.

**No cooldown** — if multipath noise causes rapid `far → near → far → near` transitions, the user gets buzzed every few seconds. Rejected: 8-second cooldown matches the 5-reading smoothing window (~5s) plus a 3-second buffer.

## Consequences

- Passive haptics are now live whenever the app is in the foreground and ghost mode is off. This is the core M1 product behaviour.
- The `hapticsService.patternForDistance()` helper (which maps distance in metres to a pattern) is no longer used — band-based mapping replaces it. It can be deleted from `app/src/services/haptics/index.ts`.
- M1 limitation: haptics do not fire when the app is backgrounded (ADR 0016). The foreground service keeps BLE scanning alive, but `useProximityHaptics` is tied to `RadarScreen` being mounted. Full background haptic delivery is an open M2 question.
- The 8-second cooldown is a starting point. Real-device testing will determine if it needs tuning — too short causes buzz fatigue, too long misses meaningful proximity events.
