import AsyncStorage from '@react-native-async-storage/async-storage';

const PROXIMITY_TOKEN_KEY = 'proximityToken';

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
