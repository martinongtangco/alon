import { BuzzMatch, FeedItem, MapEvent, MapPromo, NearbyPerson } from '../types';

export const mockNearby: NearbyPerson[] = [
  {
    token: 'tok_a1',
    initials: 'JM',
    vibes: ['music', 'art', 'food'],
    distanceMeters: 18,
    bearingDeg: 35,
    compatibility: 0.92,
    revealed: false,
    icebreaker: 'where do you go to hear live music?',
  },
  {
    token: 'tok_b2',
    initials: 'AR',
    vibes: ['tech', 'startups', 'reading'],
    distanceMeters: 64,
    bearingDeg: 200,
    compatibility: 0.78,
    revealed: false,
    icebreaker: 'what are you reading right now?',
  },
  {
    token: 'tok_c3',
    initials: 'SK',
    vibes: ['fitness', 'travel'],
    distanceMeters: 145,
    bearingDeg: 290,
    compatibility: 0.55,
    revealed: false,
    icebreaker: 'last trip that surprised you?',
  },
  {
    token: 'tok_d4',
    initials: 'PL',
    vibes: ['film', 'gaming', 'music'],
    distanceMeters: 220,
    bearingDeg: 110,
    compatibility: 0.61,
    revealed: false,
    icebreaker: 'best movie nobody talks about?',
  },
];

export const mockPromos: MapPromo[] = [
  {
    id: 'promo_cafe',
    label: 'Bell & Bean',
    emoji: '☕',
    distanceMeters: 80,
    bearingDeg: 320,
    detail: '20% off oat lattes — show this to redeem',
  },
  {
    id: 'promo_bar',
    label: 'Six Mile Tap',
    emoji: '🍻',
    distanceMeters: 180,
    bearingDeg: 60,
    detail: 'happy hour — 4 to 7, today only',
  },
];

export const mockEvents: MapEvent[] = [
  {
    id: 'evt_open_mic',
    label: 'Open Mic',
    emoji: '🎤',
    distanceMeters: 230,
    bearingDeg: 250,
    detail: 'tonight at the Kettle, 8pm',
  },
];

export const mockMatches: BuzzMatch[] = [
  {
    id: 'm_1',
    initials: 'JM',
    vibes: ['music', 'art', 'food'],
    status: 'pending',
    receivedAt: Date.now() - 1000 * 60 * 4,
  },
  {
    id: 'm_2',
    initials: 'TQ',
    name: 'Theo',
    vibes: ['tech', 'film'],
    status: 'mutual',
    receivedAt: Date.now() - 1000 * 60 * 60 * 2,
  },
];

export const mockFeed: FeedItem[] = [
  {
    id: 'f_1',
    kind: 'promo',
    title: 'Bell & Bean — 20% off oat lattes',
    body: 'around the corner, until 4pm',
    distanceMeters: 80,
    emoji: '☕',
  },
  {
    id: 'f_2',
    kind: 'event',
    title: 'Open Mic at the Kettle',
    body: 'tonight, 8pm — sign-ups at the door',
    distanceMeters: 230,
    emoji: '🎤',
  },
  {
    id: 'f_3',
    kind: 'promo',
    title: 'Six Mile Tap — happy hour',
    body: '4 to 7, today only',
    distanceMeters: 180,
    emoji: '🍻',
  },
  {
    id: 'f_4',
    kind: 'event',
    title: 'Sunday morning run',
    body: 'meet at the riverfront, 7am',
    distanceMeters: 1200,
    emoji: '🏃',
  },
];
