import { BleManager, BleError, Device } from 'react-native-ble-plx';

import { BleService } from './types';
import { NearbyPerson } from '../../types';

const SERVICE_UUID = 'f7a5c2d9-9d4e-11ef-b864-0242ac120002';

/**
 * Wait for the BLE manager to reach the PoweredOn state.
 * iOS will only deliver scan results when the adapter is powered on.
 */
function waitForPoweredOn(manager: BleManager): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const subscription = manager.onStateChange((state) => {
      if (state === 'PoweredOn') {
        subscription.remove();
        resolve();
      } else if (state === 'PoweredOff' || state === 'Resetting' || state === 'Unauthorized' || state === 'Unsupported') {
        subscription.remove();
        reject(new Error(`BLE adapter in state: ${state}`));
      }
    }, true);

    // Timeout after 5 seconds — fall back to scanning anyway
    setTimeout(() => {
      subscription.remove();
      resolve();
    }, 5000);
  });
}

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

    // Wait for powered-on state before scanning (iOS requirement)
    await waitForPoweredOn(this.manager);

    // iOS peripheral advertising deferred to M2 (CBPeripheralManager)
    console.warn('[BleService] peripheral advertising is not supported on iOS (deferred to M2)');

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
      },
    );
  }

  stop(): void {
    this.scanSubscription?.remove();
    this.manager?.stopDeviceScan();
    this.manager?.destroy();
    this.manager = null;
    this.nearbyDevices.clear();
  }

  async updateToken(_token: string): Promise<void> {
    // iOS peripheral advertising deferred to M2
    console.warn('[BleService] updateToken is not supported on iOS (deferred to M2)');
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
