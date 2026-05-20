import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile, NearbyPerson, MapPromo, MapEvent, FeedItem, BuzzMatch } from '../../types';

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api';
console.log('[api] BASE_URL =', BASE_URL);
console.log('[api] EXPO_PUBLIC_API_BASE_URL env =', process.env.EXPO_PUBLIC_API_BASE_URL);

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

  async sendBuzz(targetToken?: string): Promise<'sent' | 'rate-limited'> {
    const headers = { ...await authHeaders(), 'Content-Type': 'application/json' };
    const res = await fetch(`${BASE_URL}/buzz`, {
      method: 'POST',
      headers,
      body: JSON.stringify(targetToken ? { targetToken } : {}),
    });
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

  async registerPushToken(token: string): Promise<void> {
    const headers = { ...await authHeaders(), 'Content-Type': 'application/json' };
    await checked(await fetch(`${BASE_URL}/push-token`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ token }),
    }));
  },

  // ADR 0036: Toggle Ghost Mode (server-enforced token deactivation)
  async setGhostMode(active: boolean): Promise<{ token?: string; expiresAt?: number }> {
    const headers = { ...await authHeaders(), 'Content-Type': 'application/json' };
    const res = await fetch(`${BASE_URL}/ghost`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ active }),
    });
    if (!res.ok) {
      throw new Error(`${res.status} ${res.statusText}`);
    }
    return res.json();
  },

  // ADR 0042: signal server of logout; caller must clear AsyncStorage after this returns
  async logout(): Promise<void> {
    try {
      const headers = await authHeaders();
      await fetch(`${BASE_URL}/auth/logout`, { method: 'POST', headers });
    } catch { /* best-effort */ }
    await AsyncStorage.removeItem('authToken');
  },

  // ADR 0032: Phone OTP auth
  async requestOtp(phone: string): Promise<{ ok: boolean }> {
    const url = `${BASE_URL}/auth/request-otp`;
    console.log('[api] POST', url, '{ phone }');
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      console.log('[api] requestOtp response', res.status, res.statusText);
      if (!res.ok) {
        const body = await res.text();
        console.log('[api] requestOtp body:', body);
        throw new Error(`${res.status} ${res.statusText}: ${body}`);
      }
      return await res.json();
    } catch (err: any) {
      console.log('[api] requestOtp threw:', err?.message ?? err);
      throw err;
    }
  },

  async verifyOtp(phone: string, code: string, deviceId?: string): Promise<{ userToken: string; expiresAt: number }> {
    const url = `${BASE_URL}/auth/verify-otp`;
    console.log('[api] POST', url, '{ phone, code, deviceId }', { phone, code, deviceId });
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code, deviceId }),
      });
      console.log('[api] verifyOtp response', res.status, res.statusText);
      if (!res.ok) {
        const body = await res.text();
        console.log('[api] verifyOtp body:', body);
        throw new Error(`${res.status} ${res.statusText}: ${body}`);
      }
      return await res.json();
    } catch (err: any) {
      console.log('[api] verifyOtp threw:', err?.message ?? err);
      throw err;
    }
  },
};

