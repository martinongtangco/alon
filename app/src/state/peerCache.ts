import { create } from 'zustand';

export interface PeerCacheEntry {
  token: string;
  vibes: string[];
  score: number;
  compatible: boolean;
  updated_at: string;
}

interface PeerCacheState {
  entries: PeerCacheEntry[];
  setEntries: (entries: PeerCacheEntry[]) => void;
  getEntry: (token: string) => PeerCacheEntry | undefined;
  clear: () => void;
}

export const peerCacheStore = create<PeerCacheState>((set, get) => ({
  entries: [],

  setEntries: (entries) => set({ entries }),

  getEntry: (token) => get().entries.find((e) => e.token === token),

  clear: () => set({ entries: [] }),
}));