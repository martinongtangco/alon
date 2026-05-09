import { BleManager, BleError, Device } from 'react-native-ble-plx';
import { NearbyPerson } from '../../types';
import { getCurrentToken } from '../token';

const SERVICE_UUID = 'f7a5c2-9d4e-11ef-b864-0242ac120002';

export interface BleService {
  start(): Promise<void>;
  stop(): void;
  onRssiReading(cb: (rssi: number) => void): () => void;
  subscribe(cb: (nearby: NearbyPerson[]) => void): () => void;
}

const encodeToken = (token: string): Uint8Array => {
  const hex = token.replace(/-/g, '');
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
};

function rssiToDistance(rssi: number): number {
  return Math.pow(10, (-59 - rssi) / 20);
}

class BleServiceImpl implements BleService {
  private manager: BleManager | null = null;
  private rssiCallbacks = new Set<(rssi: number) => void>();
  private nearbyCallbacks = new Set<(nearby: NearbyPerson[]) => void>();
  private nearbyDevices = new Map<string, NearbyPerson>();
  private scanSubscription: any;

  async start(): Promise<void> {
    this.manager = new BleManager();
    // @ts-ignore – Android only
    await this.manager.enable();

    const token = await getCurrentToken();
    const data = encodeToken(token);
    // @ts-ignore – peripheral advertising requires react-native-ble-advertiser
    await this.manager.startAdvertising(SERVICE_UUID, data);

    try {
      // @ts-ignore – Android only
      await this.manager.startForegroundService();
    } catch (_) {}

    this.scanSubscription = this.manager.startDeviceScan(
      [SERVICE_UUID],
      { allowDuplicates: true },
      (error: BleError | null, device: Device | null) => {
        if (error || !device) return;
        const rssi = device.rssi ?? 0;
        this.rssiCallbacks.forEach(cb => cb(rssi));

        const distanceMeters = rssiToDistance(rssi);
        const existing = this.nearbyDevices.get(device.id);
        this.nearbyDevices.set(device.id, {
          token: device.id,
          initials: existing?.initials ?? '??',
          vibes: existing?.vibes ?? [],
          distanceMeters,
          bearingDeg: existing?.bearingDeg ?? 0,
          compatibility: existing?.compatibility ?? 0,
          revealed: existing?.revealed ?? false,
          icebreaker: existing?.icebreaker ?? '',
        });
        const nearby = Array.from(this.nearbyDevices.values());
        this.nearbyCallbacks.forEach(cb => cb(nearby));
      }
    );
  }

  stop(): void {
    this.scanSubscription?.remove();
    this.manager?.stopDeviceScan();
    // @ts-ignore – peripheral advertising requires react-native-ble-advertiser
    this.manager?.stopAdvertising();
    this.manager?.destroy();
    this.manager = null;
    this.nearbyDevices.clear();
  }

  onRssiReading(cb: (rssi: number) => void): () => void {
    this.rssiCallbacks.add(cb);
    return () => this.rssiCallbacks.delete(cb);
  }

  subscribe(cb: (nearby: NearbyPerson[]) => void): () => void {
    this.nearbyCallbacks.add(cb);
    return () => this.nearbyCallbacks.delete(cb);
  }
}
export const bleService = new BleServiceImpl();


