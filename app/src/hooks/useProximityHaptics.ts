import { useEffect, useRef } from 'react';
import { proximityService, ProximityBand } from '../services/proximity';
import { hapticsService } from '../services/haptics';

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

      // Enforce ascending-only: skip if we're already at a higher band
      const bandOrder: Record<ProximityBand, number> = {
        'out-of-range': 0,
        'far': 1,
        'near': 2,
        'very-near': 3,
      };
      if (lastFiredBand.current !== null && bandOrder[band] < bandOrder[lastFiredBand.current]) {
        return;
      }

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
