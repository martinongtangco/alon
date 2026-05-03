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
