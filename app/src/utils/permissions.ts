import { PermissionsAndroid, Platform } from 'react-native';

export async function requestBlePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true; // iOS: handled by app.json / Info.plist

  // Android 12+ (API 31+): BT permissions are runtime-dangerous
  if (Platform.Version >= 31) {
    const grants = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]);
    return Object.values(grants).every(
      (g) => g === PermissionsAndroid.RESULTS.GRANTED,
    );
  }

  // Android 6–11: BT permissions are install-time only; LOCATION is runtime-required for scanning
  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  );
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}