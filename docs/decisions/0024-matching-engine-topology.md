# ADR 0024: Matching Engine Topology

Status: accepted
Date: 2026-05-14
Patches: none

## Context

The deferred decision from `docs/decisions/README.md` lists "Matching engine topology (inline / service / batch) — M2" as an open item. The matching engine is the core system that computes compatibility scores between nearby users and determines which proximity triggers (vibrations, Vibe cards, Buzz Me signals) should fire.

Three topology options exist:

| Option | Description | Pros | Cons |
|---|---|---|---|
| **Inline** | Matching logic embedded in the proximity detection handler (the BLE/GPS event loop) | Simplest; lowest latency; single code path | Couples matching to transport; hard to test in isolation; blocks the scan loop on heavy compute |
| **Service** | Dedicated matching microservice with its own event queue | Isolates compute; independently scalable; easy to test | Adds deployment complexity; introduces network hop latency; overkill for M1/M2 scale |
| **Batch** | Periodic job (e.g., every 30s) that processes a window of proximity events | Decouples from event loop; batched compute is efficient | Introduces latency (up to 30s stale); requires event buffering; complex windowing semantics |

For M1 (lab test with controlled hardware) and M2 (early production), the user base will be small enough (< 1,000 concurrent users) that inline matching is sufficient. The matching computation per event is lightweight: a few vector dot products and a threshold check — well under 1ms.

## Decision

**Choose Inline for M1 and M2.** The matching logic lives as a pure function called from the proximity detection handler (`app/src/services/proximity/matchingEngine.ts`). No separate service or batch job.

### Matching function signature

```ts
interface ProximityEvent {
  device_id: string;
  target_token: string;
  rssi: number;
  distance_m: number;
  timestamp: number;
}

interface CompatibilityProfile {
  user_vibes: string[];
  user_mode: 'networking' | 'chill' | 'dating' | 'explorer';
  compatibility_score: number;  // 0–1
}

interface MatchResult {
  compatible: boolean;
  score: number;
  target_vibes: string[];
  target_mode: string | null;
  trigger: 'pulse' | 'steady' | 'strong' | null;
}

function computeMatch(
  event: ProximityEvent,
  myProfile: CompatibilityProfile,
  targetProfile: CompatibilityProfile
): MatchResult;
```

### Vibration trigger thresholds (ADR 0012, applied here)

| Trigger | Distance | RSSI |
|---|---|---|
| `pulse` | ≤ 500m | ≤ -70 dBm |
| `steady` | ≤ 100m | ≤ -65 dBm |
| `strong` | ≤ 20m | ≤ -45 dBm |

The `trigger` field in `MatchResult` is `null` when the user is not compatible or out of range.

### Compatibility score computation

```
compatibility_score = (shared_vibes / total_unique_vibes) * jaccard_similarity
                      + (mode_bonus if modes_compatible else 0)
                      * 0.3  // mode bonus capped at 30% of total score
```

This is a pure function — no I/O, no network calls. It runs synchronously in the proximity handler.

## Alternatives considered

**Service topology with gRPC** — Would be needed if concurrent users exceed ~10,000 and matching becomes a bottleneck. Rejected for M1/M2: the scale does not justify the complexity.

**Batch processing with a 30-second window** — Would smooth out compute spikes. Rejected: the latency is unacceptable for proximity-triggered haptics. A user walking past someone should feel the buzz within ~1 second, not 30.

## Consequences

- The matching logic is tightly coupled to the proximity detection transport (BLE/GPS). This is acceptable for M1/M2 scale.
- The matching engine is a pure function — easy to unit test, easy to refactor later into a service if needed.
- If the user base grows beyond ~1,000 concurrent users in a single geographic area, the inline approach may become a bottleneck. At that point, migrate to the service topology documented as an alternative.
- The `computeMatch` function is the single source of truth for compatibility scoring. Any future changes to the scoring algorithm must update this function and its tests.

### Files to create

| File | Purpose |
|---|---|
| `app/src/services/proximity/matchingEngine.ts` | `computeMatch()` pure function + unit tests |
| `app/src/services/proximity/matchingEngine.test.ts` | Test suite covering: no shared vibes, full overlap, mode bonus, edge cases |

### Files to modify

| File | Change |
|---|---|
| `app/src/services/proximity/proximityHandler.ts` | Call `computeMatch()` from the proximity event loop; map `MatchResult.trigger` to haptic pattern |
| `app/src/services/ble/index.android.ts` | Pass proximity events to the matching engine |
| `docs/decisions/README.md` | Update open decisions: remove "Matching engine topology" from deferred list |