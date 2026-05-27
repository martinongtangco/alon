import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
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
import { bleService } from '../services/ble';

const GHOST_PENDING_ACTION_KEY = 'ghost_pending_action';

interface Match {
  id: string;
  displayName: string;
  vibes: string[];
  mode: string;
  status: 'pending' | 'mutual';
  createdAt: number;
}

interface AppState {
  onboarded: boolean;
  profile: UserProfile;

  nearby: NearbyPerson[];
  promos: MapPromo[];
  events: MapEvent[];
  matches: Match[];
  feed: FeedItem[];

  signalLevel: SignalLevel;

  completeOnboarding: (profile: Partial<UserProfile>) => void;
  setMode: (mode: Mode) => void;
  toggleVibe: (vibe: Vibe) => void;
  toggleGhostMode: () => Promise<void>;
  setSignalLevel: (level: SignalLevel) => void;
  setNearby: (nearby: NearbyPerson[]) => void;
  buzz: (targetToken?: string) => Promise<'sent' | 'rate-limited' | 'too-far'>;
  buzzBack: (matchId: string) => void;
  reveal: (token: string) => Promise<'pending' | 'matched'>;
  fetchMatches: () => Promise<void>;
  hydrate: () => Promise<void>;
  processPendingGhostActions: () => Promise<void>;
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

      toggleGhostMode: async () => {
        const ghostMode = !useAppStore.getState().profile.ghostMode;

        set((s) => ({
          profile: { ...s.profile, ghostMode },
          nearby: ghostMode ? [] : s.nearby,
          signalLevel: ghostMode ? 0 : s.signalLevel,
        }));
        try {
          if (ghostMode) {
            await apiService.setGhostMode(true);
            // Clear pending action queue on success
            await AsyncStorage.removeItem(GHOST_PENDING_ACTION_KEY);
          } else {
            const result = await apiService.setGhostMode(false);
            if (result.token) {
              await AsyncStorage.setItem('proximity_token', result.token);
              await (bleService as any).updateToken?.(result.token);
            }
            // Clear pending action queue on success
            await AsyncStorage.removeItem(GHOST_PENDING_ACTION_KEY);
          }
        } catch (err) {
          // Revert optimistic update on failure — only ghostMode can be safely reverted;
          // nearby/signalLevel are modified by the optimistic update and their previous
          // values are not available here; they will be corrected on the next UI cycle.
          set((s) => ({
            profile: { ...s.profile, ghostMode: !s.profile.ghostMode },
          }));
          console.warn('[ghost] failed to update server ghost state', err);

          // Queue the action for offline processing (ADR 0036)
          try {
            const pending = await AsyncStorage.getItem(GHOST_PENDING_ACTION_KEY);
            if (!pending) {
              await AsyncStorage.setItem(
                GHOST_PENDING_ACTION_KEY,
                JSON.stringify({ active: ghostMode, ts: Date.now() })
              );
            }
          } catch (queueErr) {
            console.warn('[ghost] failed to queue pending action', queueErr);
          }
        }
      },

      setSignalLevel: (signalLevel) => set({ signalLevel }),

      setNearby: (nearby) => set({ nearby }),

      buzz: async (targetToken?: string) => {
        try {
          return await apiService.sendBuzz(targetToken);
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

      reveal: async (token) => {
        const result = await apiService.reveal(token);
        if (result.status === 'matched') {
          // Refresh matches list to include the new match
          try {
            const matches = await apiService.fetchMatches();
            set({ matches });
          } catch {
            // ignore refresh errors
          }
        }
        return result.status;
      },

      fetchMatches: async () => {
        try {
          const matches = await apiService.fetchMatches();
          set({ matches });
        } catch {
          // Do not overwrite existing matches on error — preserve stale data.
          // The server returns 503 on DB failure; the client retains last known state.
          console.warn('[matches] fetch failed — retaining cached matches');
        }
      },

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
        const [promos, events, feed] = await Promise.all([
          safeFetch(() => apiService.fetchPromos(), []),
          safeFetch(() => apiService.fetchEvents(), []),
          safeFetch(() => apiService.fetchFeed(), []),
        ]);
        const matches = await safeFetch(() => apiService.fetchMatches(), []);
        set({ promos, events, feed, matches });
      },

      processPendingGhostActions: async () => {
        // ADR 0036: process any pending ghost mode action queued while offline
        try {
          const pending = await AsyncStorage.getItem(GHOST_PENDING_ACTION_KEY);
          if (!pending) return;

          const action: { active: boolean; ts: number } = JSON.parse(pending);
          // Only process actions less than 24 hours old
          if (Date.now() - action.ts > 24 * 60 * 60 * 1000) {
            await AsyncStorage.removeItem(GHOST_PENDING_ACTION_KEY);
            return;
          }

          const currentGhostMode = useAppStore.getState().profile.ghostMode;

          if (action.active && !currentGhostMode) {
            // Device came online while ghost mode was pending — activate it
            await apiService.setGhostMode(true);
            set((s) => ({
              profile: { ...s.profile, ghostMode: true },
              nearby: [],
              signalLevel: 0,
            }));
          } else if (!action.active && currentGhostMode) {
            // Device came online while ghost deactivation was pending — deactivate it
            const result = await apiService.setGhostMode(false);
            if (result.token) {
              await AsyncStorage.setItem('proximity_token', result.token);
              await (bleService as any).updateToken?.(result.token);
            }
            set((s) => ({
              profile: { ...s.profile, ghostMode: false },
              signalLevel: 3,
            }));
          }

          await AsyncStorage.removeItem(GHOST_PENDING_ACTION_KEY);
        } catch (err) {
          console.warn('[ghost] failed to process pending actions', err);
        }
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

