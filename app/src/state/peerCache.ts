import { create } from 'zustand';
import { Vibe } from '../types';
import { apiService } from '../services/api';
import { useAppStore } from './store';
import { compatibilityScore, isCompatible } from '../services/proximity';

interface PeerProfile {
  token: string;
  vibes: Vibe[];
  fetched_at: number;
}

interface PeerCacheState {
  _profiles: Record<string, PeerProfile>;

  getVibes: (token: string, userToken: string) => Promise<Vibe[]>;
  getCompatibility: (token: string, userToken: string) => Promise<number>;
  isCompatible: (token: string, userToken: string) => Promise<boolean>;
  getCompatiblePeers: (tokens: string[], userToken: string) => Promise<string[]>;
  invalidate: (token: string) => void;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function isStale(p: PeerProfile): boolean {
  return Date.now() - p.fetched_at > CACHE_TTL;
}

export const usePeerCache = create<PeerCacheState>()((set, get) => ({
  _profiles: {},

  getVibes: async (token: string, userToken: string): Promise<Vibe[]> => {
    const profiles = get()._profiles;
    const existing = profiles[token];
    if (existing && !isStale(existing)) {
      return existing.vibes;
    }

    const res = await apiService.fetchVibes(token, userToken);
    if (res.vibes.length === 0) return [];

    // Store vibes in both cache and app store for client-side scoring
    set((s) => ({
      _profiles: {
        ...s._profiles,
        [token]: {
          token,
          vibes: res.vibes as Vibe[],
          fetched_at: Date.now(),
        },
      },
    }));

    // Also update app store's peerVibes for compatibility checks
    useAppStore.getState().setPeerVibes(res.vibes);

    return res.vibes as Vibe[];
  },

  getCompatibility: async (token: string, userToken: string): Promise<number> => {
    const profiles = get()._profiles;
    const existing = profiles[token];
    if (existing && !isStale(existing)) {
      const me = useAppStore.getState().profile;
      return compatibilityScore(me.vibes, existing.vibes);
    }

    const res = await apiService.fetchVibes(token, userToken);
    const me = useAppStore.getState().profile;
    const score = compatibilityScore(me.vibes, res.vibes);

    set((s) => ({
      _profiles: {
        ...s._profiles,
        [token]: {
          token,
          vibes: res.vibes as Vibe[],
          fetched_at: Date.now(),
        },
      },
    }));

    return score;
  },

  isCompatible: async (token: string, userToken: string): Promise<boolean> => {
    const profiles = get()._profiles;
    const existing = profiles[token];
    if (existing && !isStale(existing)) {
      const me = useAppStore.getState().profile;
      return isCompatible(me.vibes, existing.vibes);
    }

    const res = await apiService.fetchVibes(token, userToken);
    const me = useAppStore.getState().profile;
    const compatible = isCompatible(me.vibes, res.vibes);

    set((s) => ({
      _profiles: {
        ...s._profiles,
        [token]: {
          token,
          vibes: res.vibes as Vibe[],
          fetched_at: Date.now(),
        },
      },
    }));

    return compatible;
  },

  getCompatiblePeers: async (tokens: string[], userToken: string): Promise<string[]> => {
    const results = await Promise.all(
      tokens.map(async (t) => {
        const compatible = await get().isCompatible(t, userToken);
        return { token: t, compatible };
      }),
    );
    return results.filter((r) => r.compatible).map((r) => r.token);
  },

  invalidate: (token: string) => {
    set((s) => {
      const next = { ...s._profiles };
      delete next[token];
      return { _profiles: next };
    });
  },
}));