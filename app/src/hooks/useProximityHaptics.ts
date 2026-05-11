import { useEffect, useRef } from 'react';
import { proximityService, ProximityBand, compatibilityScore, isCompatible } from '../services/proximity';
import { hapticsService } from '../services/haptics';
import { useAppStore } from '../state/store';

const HAPTIC_COOLDOWN_MS = 8000;

/**
 * Map proximity band + compatibility to haptic pattern.
 * ADR 0024: compatible peers get stronger haptic feedback.
 */
function patternForBand(band: ProximityBand, compatible: boolean): string {
  if (compatible) {
    // Escalate: one level stronger when compatible
    switch (band) {
      case 'very-near': return 'strong_buzz';
      case 'near': return 'strong_buzz';
      case 'far': return 'steady_rhythm';
      default: return 'faint_pulse';
    }
  }
  switch (band) {
    case 'very-near': return 'strong_buzz';
    case 'near': return 'steady_rhythm';
    case 'far': return 'faint_pulse';
    default: return 'none';
  }
}

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

      // ADR 0024: check compatibility against peer vibes from cache
      const me = useAppStore.getState().profile;
      const peerVibes = useAppStore.getState().peerVibes;
      const compatible = peerVibes && me.vibes.length > 0
        ? isCompatible(me.vibes, peerVibes)
        : false;

      const pattern = patternForBand(band, compatible);
      if (pattern === 'none') return;

      hapticsService.play(pattern).catch(() => {});
      lastFiredBand.current = band;
      cooldownUntil.current = now + HAPTIC_COOLDOWN_MS;
    });

    return unsub;
  }, [ghostMode]);
}
