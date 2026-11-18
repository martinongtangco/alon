import { BleManager, BleError, Device } from 'react-native-ble-plx';
import BLEAdvertiser from 'react-native-ble-advertiser';

import { BleService } from './types';
import { NearbyPerson } from '../../types';
import { getCurrentToken } from '../token';
import { tokenToBearing, BAND_DISTANCE } from '../proximity';

const SERVICE_UUID = 'f7a5c2d9-9d4e-11ef-b864-0242ac120002';
const MANUFACTURER_ID = 0x4c00;

const tokenToBytes = (token: string): Uint8Array => {
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

    // Start BLE peripheral advertising
    const token = await getCurrentToken();
    await BLEAdvertiser.setCompanyId(MANUFACTURER_ID);
    await BLEAdvertiser.broadcast(SERVICE_UUID, Array.from(tokenToBytes(token)), {
      advertiseMode: BLEAdvertiser.ADVERTISE_MODE_LOW_LATENCY,
      txPowerLevel: BLEAdvertiser.ADVERTISE_TX_POWER_MEDIUM,
      connectable: false,
      includeDeviceName: false,
      includeTxPowerLevel: false,
    });

    try {
      // @ts-ignore – Android only
      this.manager.startForegroundService(
        'ic_notification',
        'Alon is active',
        'detecting nearby vibes',
      );
    } catch (_) {}

    this.scanSubscription = this.manager.startDeviceScan(
      [SERVICE_UUID],
      { allowDuplicates: true },
      (error: BleError | null, device: Device | null) => {
        if (error || !device) return;
        const rssi = device.rssi ?? 0;
        this.rssiCallbacks.forEach(cb => cb(rssi));

        const rssiDistance = rssiToDistance(rssi);
        const existing = this.nearbyDevices.get(device.id);
        // ADR 0025: bearing is derived once from the token and cached — never
        // recomputed on subsequent RSSI readings so the dot does not jump.
        const bearingDeg = existing?.bearingDeg ?? tokenToBearing(device.id);
        // ADR 0025: clamp distanceMeters to the nearest band midpoint to
        // prevent jitter from noisy RSSI; preserve the cached value until the
        // ProximityService signals a band change (belt-and-suspenders for M1).
        const distanceMeters = existing?.distanceMeters
          ?? (rssiDistance < 3 ? BAND_DISTANCE['very-near']
            : rssiDistance < 10 ? BAND_DISTANCE['near']
            : BAND_DISTANCE['far']);
        this.nearbyDevices.set(device.id, {
          token: device.id,
          initials: existing?.initials ?? '??',
          vibes: existing?.vibes ?? [],
          distanceMeters,
          bearingDeg,
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

    // Stop BLE peripheral advertising
    BLEAdvertiser?.stopBroadcast().catch(() => {});

    this.manager?.destroy();
    this.manager = null;
    this.nearbyDevices.clear();
  }

  async updateToken(token: string): Promise<void> {
    if (!BLEAdvertiser) return;
    await BLEAdvertiser.stopBroadcast();
    await BLEAdvertiser.broadcast(SERVICE_UUID, Array.from(tokenToBytes(token)), {
      advertiseMode: BLEAdvertiser.ADVERTISE_MODE_LOW_LATENCY,
      txPowerLevel: BLEAdvertiser.ADVERTISE_TX_POWER_MEDIUM,
      connectable: false,
      includeDeviceName: false,
      includeTxPowerLevel: false,
    });
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
