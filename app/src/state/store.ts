import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  BuzzMatch,
  FeedItem,
  MapEvent,
  MapPromo,
  Mode,
  NearbyPerson,
  SignalLevel,
  UserProfile,
  Vibe,
} from '../types';
import { apiService } from '../services/api';

interface AppState {
  onboarded: boolean;
  profile: UserProfile;

  nearby: NearbyPerson[];
  promos: MapPromo[];
  events: MapEvent[];
  matches: BuzzMatch[];
  feed: FeedItem[];
  peerVibes: string[] | null;

  signalLevel: SignalLevel;

  completeOnboarding: (profile: Partial<UserProfile>) => void;
  setMode: (mode: Mode) => void;
  toggleVibe: (vibe: Vibe) => void;
  toggleGhostMode: () => void;
  setSignalLevel: (level: SignalLevel) => void;
  setNearby: (nearby: NearbyPerson[]) => void;
  buzz: () => Promise<'sent' | 'rate-limited' | 'too-far'>;
  buzzBack: (matchId: string) => void;
  reveal: (token: string) => void;
  hydrate: () => Promise<void>;
}

const defaultProfile: UserProfile = {
  id: 'me',
  name: 'You',
  initials: 'YO',
  vibes: ['tech', 'music', 'food'],
  mode: 'networking',
  ghostMode: false,
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      onboarded: false,
      profile: defaultProfile,

      nearby: [],
      promos: [],
      events: [],
      matches: [],
      feed: [],
      peerVibes: null,

      signalLevel: 3,

      completeOnboarding: (profile) => {
        set((s) => ({
          onboarded: true,
          profile: { ...s.profile, ...profile },
        }));
        apiService.updateProfile(profile).catch(() => {});
      },

      setMode: (mode) =>
        set((s) => ({ profile: { ...s.profile, mode } })),

      toggleVibe: (vibe) =>
        set((s) => {
          const has = s.profile.vibes.includes(vibe);
          const vibes = has
            ? s.profile.vibes.filter((v) => v !== vibe)
            : [...s.profile.vibes, vibe];
          return { profile: { ...s.profile, vibes } };
        }),

      toggleGhostMode: () =>
        set((s) => {
          const ghostMode = !s.profile.ghostMode;
          return {
            profile: { ...s.profile, ghostMode },
            nearby: ghostMode ? [] : s.nearby,
            signalLevel: ghostMode ? 0 : s.signalLevel,
          };
        }),

      setSignalLevel: (signalLevel) => set({ signalLevel }),

      setNearby: (nearby) => set({ nearby }),

      setPeerVibes: (peerVibes: string[] | null) => set({ peerVibes }),

      buzz: async () => {
        try {
          return await apiService.sendBuzz();
        } catch {
          return 'too-far';
        }
      },

      buzzBack: (matchId) => {
        set((s) => ({
          matches: s.matches.map((m) =>
            m.id === matchId ? { ...m, status: 'mutual' } : m,
          ),
        }));
        apiService.buzzBack(matchId).catch(() => {});
      },

      reveal: (token) =>
        set((s) => ({
          nearby: s.nearby.map((n) =>
            n.token === token ? { ...n, revealed: true } : n,
          ),
        })),

      hydrate: async () => {
        const safeFetch = async <T,>(
          fn: () => Promise<T>,
          fallback: T,
        ): Promise<T> => {
          try {
            return await fn();
          } catch {
            return fallback;
          }
        };
        const [promos, events, feed, matches] = await Promise.all([
          safeFetch(() => apiService.fetchPromos(), []),
          safeFetch(() => apiService.fetchEvents(), []),
          safeFetch(() => apiService.fetchFeed(), []),
          safeFetch(() => apiService.fetchMatches(), []),
        ]);
        set({ promos, events, feed, matches });
      },
    }),
    {
      name: 'alon-app-state',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        onboarded: state.onboarded,
        profile: state.profile,
      }),
    },
  ),
);

