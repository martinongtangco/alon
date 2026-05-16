// iOS BLE permissions
// iOS permission is requested implicitly when CBCentralManager initialises.
// Expo managed workflow handles this via the NSBluetoothAlwaysUsageDescription Info.plist key.
// No runtime permission dialog needed here.

export async function requestBlePermissions(): Promise<boolean> {
  return true;
}