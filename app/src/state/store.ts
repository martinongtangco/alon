import { create } from 'zustand';
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
import {
  mockEvents,
  mockFeed,
  mockMatches,
  mockNearby,
  mockPromos,
} from '../constants/mockData';

interface AppState {
  onboarded: boolean;
  profile: UserProfile;

  nearby: NearbyPerson[];
  promos: MapPromo[];
  events: MapEvent[];
  matches: BuzzMatch[];
  feed: FeedItem[];

  signalLevel: SignalLevel;
  buzzesSentToday: Record<string, number>;

  completeOnboarding: (profile: Partial<UserProfile>) => void;
  setMode: (mode: Mode) => void;
  toggleVibe: (vibe: Vibe) => void;
  toggleGhostMode: () => void;
  setSignalLevel: (level: SignalLevel) => void;
  setNearby: (nearby: NearbyPerson[]) => void;
  buzz: (token: string) => 'sent' | 'rate-limited' | 'too-far';
  buzzBack: (matchId: string) => void;
  reveal: (token: string) => void;
}

const defaultProfile: UserProfile = {
  id: 'me',
  name: 'You',
  initials: 'YO',
  vibes: ['tech', 'music', 'food'],
  mode: 'networking',
  ghostMode: false,
};

export const useAppStore = create<AppState>((set, get) => ({
  onboarded: false,
  profile: defaultProfile,

  nearby: mockNearby,
  promos: mockPromos,
  events: mockEvents,
  matches: mockMatches,
  feed: mockFeed,

  signalLevel: 3,
  buzzesSentToday: {},

  completeOnboarding: (profile) =>
    set((s) => ({
      onboarded: true,
      profile: { ...s.profile, ...profile },
    })),

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
        nearby: ghostMode ? [] : mockNearby,
        signalLevel: ghostMode ? 0 : s.signalLevel,
      };
    }),

  setSignalLevel: (signalLevel) => set({ signalLevel }),

  setNearby: (nearby) => set({ nearby }),

  buzz: (token) => {
    const state = get();
    const target = state.nearby.find((n) => n.token === token);
    if (!target) return 'too-far';
    if (target.distanceMeters > 100) return 'too-far';
    const sent = state.buzzesSentToday[token] ?? 0;
    if (sent >= 3) return 'rate-limited';
    set((s) => ({
      buzzesSentToday: { ...s.buzzesSentToday, [token]: sent + 1 },
      matches: [
        {
          id: `buzz_${Date.now()}`,
          initials: target.initials,
          vibes: target.vibes,
          status: 'pending',
          receivedAt: Date.now(),
        },
        ...s.matches,
      ],
    }));
    return 'sent';
  },

  buzzBack: (matchId) =>
    set((s) => ({
      matches: s.matches.map((m) =>
        m.id === matchId ? { ...m, status: 'mutual' } : m,
      ),
    })),

  reveal: (token) =>
    set((s) => ({
      nearby: s.nearby.map((n) =>
        n.token === token ? { ...n, revealed: true } : n,
      ),
    })),
}));
