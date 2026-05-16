import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile, NearbyPerson, MapPromo, MapEvent, FeedItem, BuzzMatch } from '../../types';

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api';

export interface PlatformConfig {
  BUZZ_COOLDOWN: number;
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await AsyncStorage.getItem('authToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function checked(res: Response): Promise<Response> {
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res;
}

export const apiService = {
  async registerDevice(deviceId: string): Promise<{ token: string; expiresAt: number; authToken: string }> {
    const res = await fetch(`${BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId }),
    });
    const data = await (await checked(res)).json();
    // Persist the auth token for future authenticated requests
    if (data.authToken) {
      await AsyncStorage.setItem('authToken', data.authToken);
    }
    return { token: data.token, expiresAt: data.expiresAt, authToken: data.authToken };
  },

  async rotateToken(): Promise<{ token: string; expiresAt: number }> {
    const headers = { ...await authHeaders(), 'Content-Type': 'application/json' };
    const res = await fetch(`${BASE_URL}/token/rotate`, { method: 'POST', headers });
    return (await checked(res)).json();
  },

  async ping(): Promise<{ ok: boolean; mode: string }> {
    const res = await fetch(`${BASE_URL}/ping`);
    return (await checked(res)).json();
  },

  // Not part of M1 spec; keep for compatibility
  async getProfile(): Promise<UserProfile> {
    const res = await fetch(`${BASE_URL}/profile`, { headers: await authHeaders() });
    return (await checked(res)).json();
  },

  async updateProfile(patch: Partial<UserProfile>): Promise<void> {
    const headers = { ...await authHeaders(), 'Content-Type': 'application/json' };
    await checked(await fetch(`${BASE_URL}/profile`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(patch),
    }));
  },

  async fetchNearby(): Promise<NearbyPerson[]> {
    const res = await fetch(`${BASE_URL}/nearby`, { headers: await authHeaders() });
    return (await checked(res)).json();
  },

  async sendBuzz(): Promise<'sent' | 'rate-limited'> {
    const headers = { ...await authHeaders(), 'Content-Type': 'application/json' };
    const res = await fetch(`${BASE_URL}/buzz`, { method: 'POST', headers });
    return (await checked(res)).json();
  },

  async buzzBack(matchId: string): Promise<void> {
    const headers = { ...await authHeaders(), 'Content-Type': 'application/json' };
    await checked(await fetch(`${BASE_URL}/buzz/${matchId}/back`, { method: 'POST', headers }));
  },

  async fetchPromos(): Promise<MapPromo[]> {
    const res = await fetch(`${BASE_URL}/promos`);
    return (await checked(res)).json();
  },

  async fetchEvents(): Promise<MapEvent[]> {
    const res = await fetch(`${BASE_URL}/events`);
    return (await checked(res)).json();
  },

  async fetchFeed(): Promise<FeedItem[]> {
    const res = await fetch(`${BASE_URL}/feed`);
    return (await checked(res)).json();
  },

  async fetchMatches(): Promise<Array<{
    id: string;
    displayName: string;
    vibes: string[];
    mode: string;
    status: 'pending' | 'mutual';
    createdAt: number;
  }>> {
    const res = await fetch(`${BASE_URL}/matches`, { headers: await authHeaders() });
    return (await checked(res)).json();
  },

  async reveal(token: string): Promise<{ status: 'pending' | 'matched'; matchId?: string; createdAt?: number }> {
    const headers = { ...await authHeaders(), 'Content-Type': 'application/json' };
    const res = await fetch(`${BASE_URL}/reveal`, { method: 'POST', headers, body: JSON.stringify({ token }) });
    return (await checked(res)).json();
  },

  async fetchConfig(): Promise<PlatformConfig> {
    const res = await fetch(`${BASE_URL}/config`);
    return (await checked(res)).json();
  },
};

