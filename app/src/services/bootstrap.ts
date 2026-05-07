import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from './api';

const DEVICE_ID_KEY = 'deviceId';
const AUTH_TOKEN_KEY = 'authToken';
const PROXIMITY_TOKEN_KEY = 'proximityToken';
const PROXIMITY_TOKEN_EXPIRES_AT_KEY = 'proximityTokenExpiresAt';

const ROTATION_INTERVAL_MS = 14 * 60 * 1000; // 14 minutes (1-min buffer before 15-min server TTL)

let rotationIntervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Generate a UUID v4 string without external dependencies.
 * Uses crypto.getRandomValues when available (Expo/React Native).
 */
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof (crypto as any).getRandomValues === 'function') {
    const bytes = (crypto as any).getRandomValues(new Uint8Array(16));
    // Set version to 4 and variant to RFC 4122
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes as Uint8Array).map((b: number) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
  }
  // Fallback for environments without crypto.getRandomValues
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Bootstrap the device: register with the backend, store tokens,
 * and start the proximity token rotation timer.
 *
 * Does not throw — registration failures are logged and the app
 * degrades gracefully to mocked data.
 */
export async function bootstrapDevice(): Promise<void> {
  // 1. Read or create deviceId
  let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = generateUUID();
    await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
  }

  // 2. Register device and persist auth + proximity tokens
  try {
    const result = await apiService.registerDevice(deviceId);
    await AsyncStorage.setItem(AUTH_TOKEN_KEY, result.authToken);
    await AsyncStorage.setItem(PROXIMITY_TOKEN_KEY, result.token);
    await AsyncStorage.setItem(PROXIMITY_TOKEN_EXPIRES_AT_KEY, String(result.expiresAt));
  } catch (err) {
    console.warn('[bootstrap] registerDevice failed — app will use mocked data', err);
    // Do not throw — app degrades gracefully
  }

  // 3. Start rotation timer
  stopRotationTimer(); // safety: clear any previous interval
  rotationIntervalId = setInterval(async () => {
    try {
      const result = await apiService.rotateToken();
      await AsyncStorage.setItem(PROXIMITY_TOKEN_KEY, result.token);
      await AsyncStorage.setItem(PROXIMITY_TOKEN_EXPIRES_AT_KEY, String(result.expiresAt));
      console.log('[bootstrap] proximity token rotated, expiresAt:', result.expiresAt);
    } catch (err) {
      console.warn('[bootstrap] rotateToken failed', err);
    }
  }, ROTATION_INTERVAL_MS);
}

/**
 * Stop the rotation timer. Useful for testing or cleanup.
 */
export function stopRotationTimer(): void {
  if (rotationIntervalId !== null) {
    clearInterval(rotationIntervalId);
    rotationIntervalId = null;
  }
}
