export type Vibe =
  | 'tech'
  | 'music'
  | 'fitness'
  | 'food'
  | 'startups'
  | 'art'
  | 'travel'
  | 'gaming'
  | 'film'
  | 'reading';

export const ALL_VIBES: Vibe[] = [
  'tech', 'music', 'fitness', 'food', 'startups',
  'art', 'travel', 'gaming', 'film', 'reading',
];

export type Mode = 'networking' | 'chill' | 'dating' | 'explorer';

export const ALL_MODES: Mode[] = ['networking', 'chill', 'dating', 'explorer'];

export interface UserProfile {
  id: string;
  name: string;
  initials: string;
  bio?: string;
  vibes: Vibe[];
  mode: Mode;
  ghostMode: boolean;
}

export interface NearbyPerson {
  token: string;
  initials: string;
  vibes: Vibe[];
  distanceMeters: number;
  bearingDeg: number;
  compatibility: number;
  revealed: boolean;
  name?: string;
  icebreaker: string;
}

export type PinKind = 'person' | 'promo' | 'event';

export interface MapPromo {
  id: string;
  label: string;
  emoji: string;
  distanceMeters: number;
  bearingDeg: number;
  detail: string;
}

export interface MapEvent {
  id: string;
  label: string;
  emoji: string;
  distanceMeters: number;
  bearingDeg: number;
  detail: string;
}

export interface BuzzMatch {
  id: string;
  initials: string;
  name?: string;
  vibes: Vibe[];
  status: 'pending' | 'mutual';
  receivedAt: number;
}

export interface FeedItem {
  id: string;
  kind: 'promo' | 'event';
  title: string;
  body: string;
  distanceMeters: number;
  emoji: string;
}

export type SignalLevel = 0 | 1 | 2 | 3 | 4 | 5;

// Mutual Reveal types
export type RevealStatus = 'PENDING' | 'MUTUAL' | 'EXPIRED';

export interface RevealMatch {
  id: string;
  name: string;
  initials: string;
  photo_url: string | null;
  vibes: Vibe[];
  mutual_at: string;
  role: 'self' | 'other';
  isRevealed: boolean;
  revealPending: boolean;
}
