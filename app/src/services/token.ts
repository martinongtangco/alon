import AsyncStorage from '@react-native-async-storage/async-storage';

const PROXIMITY_TOKEN_KEY = 'proximityToken';
const PROXIMITY_TOKEN_EXPIRES_AT_KEY = 'proximityTokenExpiresAt';

/**
 * Fallback token used when bootstrap has not yet run or failed.
 * Prevents BLE from crashing during development.
 */
const FALLBACK_TOKEN = '00000000-0000-4000-a000-000000000000';

/**
 * Read the current proximity token from AsyncStorage.
 * Returns the fallback if no token is stored (bootstrap hasn't run yet).
 */
export async function getCurrentToken(): Promise<string> {
  const token = await AsyncStorage.getItem(PROXIMITY_TOKEN_KEY);
  if (token) {
    return token;
  }
  return FALLBACK_TOKEN;
}

/**
 * Check whether the stored proximity token is expired.
 * Returns true if no token exists, or if the token has passed its expiry.
 */
export async function isTokenExpired(): Promise<boolean> {
  const expiresAt = await AsyncStorage.getItem(PROXIMITY_TOKEN_EXPIRES_AT_KEY);
  if (!expiresAt) {
    return true;
  }
  return Date.now() >= Number(expiresAt);
}

/**
 * Generate a fallback proximity token when the backend is unreachable.
 * Stores the token and its expiry in AsyncStorage.
 * Returns the generated token.
 */
export async function generateFallbackToken(): Promise<string> {
  // Import generateUUID inline to avoid circular dependency
  const generateUUID = (): string => {
    if (typeof crypto !== 'undefined' && typeof (crypto as any).getRandomValues === 'function') {
      const bytes = (crypto as any).getRandomValues(new Uint8Array(16));
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes as Uint8Array).map((b: number) => b.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  const fallbackToken = generateUUID();
  const fallbackExpiresAt = Date.now() + 15 * 60 * 1000;
  await AsyncStorage.setItem(PROXIMITY_TOKEN_KEY, fallbackToken);
  await AsyncStorage.setItem(PROXIMITY_TOKEN_EXPIRES_AT_KEY, String(fallbackExpiresAt));
  return fallbackToken;
}
