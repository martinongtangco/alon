import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from './api';
import { bleService } from './ble';
import { platformConfigService } from './platformConfig';
import { isTokenExpired, generateFallbackToken } from './token';
import * as Notifications from 'expo-notifications';
import { useAppStore } from '../state/store';

const DEVICE_ID_KEY = 'deviceId';
const AUTH_TOKEN_KEY = 'authToken';

const ROTATION_INTERVAL_MS = 14 * 60 * 1000; // 14 minutes (1-min buffer before 15-min server TTL)

let rotationIntervalId: ReturnType<typeof setInterval> | null = null;

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
    await AsyncStorage.setItem('proximityToken', result.token);
    await AsyncStorage.setItem('proximityTokenExpiresAt', String(result.expiresAt));

    // 3. Request notification permissions and register push token
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === 'granted') {
        const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync();
        await apiService.registerPushToken(expoPushToken);
        console.log('[bootstrap] push token registered:', expoPushToken);
      }
    } catch (pushErr) {
      console.warn('[bootstrap] push token registration failed', pushErr);
    }
  } catch (err) {
    console.warn('[bootstrap] registerDevice failed — generating fallback token', err);

    // Scenario 1 & 3: Generate a client-side fallback token when the backend is unreachable.
    // This allows BLE advertising to continue (app functions as a "local radar").
    // Peers who receive this token via BLE will not be able to resolve it to a user,
    // so they see anonymous blobs with compatibility: 0.
    try {
      await generateFallbackToken();
      console.log('[bootstrap] fallback proximity token generated');
    } catch (storageErr) {
      console.error('[bootstrap] failed to store fallback token', storageErr);
    }

    // Do not throw — app degrades gracefully
  }

  // 4. Scenario 3 — Returning user, no network: check if stored token is expired
  // If the token has expired (older than 15 minutes), generate a new fallback token.
  // This prevents advertising a token the backend has TTL-evicted from Redis.
  try {
    const expired = await isTokenExpired();
    if (expired) {
      console.log('[bootstrap] stored token expired — generating fallback');
      await generateFallbackToken();
    }
  } catch (err) {
    console.warn('[bootstrap] token expiry check failed — keeping stored token', err);
  }

  // 5. Fetch platform config from backend
  try {
    const config = await apiService.fetchConfig();
    platformConfigService.set(config);
  } catch (err) {
    console.warn('[bootstrap] fetchConfig failed — using defaults', err);
  }

  // 6. ADR 0036: process any pending ghost mode actions queued while offline
  try {
    await useAppStore.getState().processPendingGhostActions();
  } catch (err) {
    console.warn('[bootstrap] processPendingGhostActions failed', err);
  }

  // 7. Start rotation timer
  stopRotationTimer(); // safety: clear any previous interval
  rotationIntervalId = setInterval(async () => {
    try {
      const result = await apiService.rotateToken();
      await AsyncStorage.setItem('proximityToken', result.token);
      await AsyncStorage.setItem('proximityTokenExpiresAt', String(result.expiresAt));
      // Notify BLE service to re-advertise the new token
      await bleService.updateToken(result.token);
      console.log('[bootstrap] proximity token rotated, expiresAt:', result.expiresAt);
    } catch (err) {
      console.warn('[bootstrap] rotateToken failed', err);
    }
  }, ROTATION_INTERVAL_MS);
}

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
 * Stop the rotation timer. Useful for testing or cleanup.
 */
export function stopRotationTimer(): void {
  if (rotationIntervalId !== null) {
    clearInterval(rotationIntervalId);
    rotationIntervalId = null;
  }
}