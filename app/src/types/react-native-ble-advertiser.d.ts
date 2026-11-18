// The package's index.d.ts omits the Android constants its native module exports
// (BLEAdvertiserModule.getConstants()).
import 'react-native-ble-advertiser';

declare module 'react-native-ble-advertiser' {
  export const ADVERTISE_MODE_LOW_LATENCY: number;
  export const ADVERTISE_TX_POWER_MEDIUM: number;
}
