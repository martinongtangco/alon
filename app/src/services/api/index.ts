import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile, NearbyPerson, MapPromo, MapEvent, FeedItem, BuzzMatch } from '../../types';

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api';

// Dev-only logger — stripped in production builds
const log = __DEV__ ? (...args: any[]) => console.log('[alon]', ...args) : () => {};
const warn = __DEV__ ? (...args: any[]) => console.warn('[alon]', ...args) : () => {};
log('BASE_URL =', BASE_URL);

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

  async sendBuzz(targetToken?: string): Promise<'sent' | 'rate-limited' | 'too-far'> {
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
    const res = await fetch(`${BASE_URL}/config`, { headers: await authHeaders() });
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
    log('POST', url);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      if (!res.ok) {
        const body = await res.text();
        warn('requestOtp failed:', res.status, body);
        throw new Error(`${res.status} ${res.statusText}: ${body}`);
      }
      return await res.json();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      warn('requestOtp error:', msg);
      throw err;
    }
  },

  async verifyOtp(phone: string, code: string, deviceId?: string): Promise<{ userToken: string; expiresAt: number }> {
    const url = `${BASE_URL}/auth/verify-otp`;
    log('POST', url);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code, deviceId }),
      });
      if (!res.ok) {
        const body = await res.text();
        warn('verifyOtp failed:', res.status, body);
        throw new Error(`${res.status} ${res.statusText}: ${body}`);
      }
      return await res.json();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      warn('verifyOtp error:', msg);
      throw err;
    }
  },

  // ADR 0035: Age Verification — DOB self-declaration
  async verifyAge(dateOfBirth: string): Promise<{ ok: boolean; ageVerified: boolean }> {
    const headers = { ...await authHeaders(), 'Content-Type': 'application/json' };
    const res = await fetch(`${BASE_URL}/auth/verify-age`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ dateOfBirth }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`${res.status} ${res.statusText}: ${body}`);
    }
    return res.json();
  },
};

