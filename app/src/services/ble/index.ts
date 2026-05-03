import { BleManager } from 'react-native-ble-plx';
import { getCurrentToken } from '../token';

const SERVICE_UUID = 'f7a5c2-9d4e-11ef-b864-0242ac120002';

export interface BleService {
  start(): Promise<void>;
  stop(): void;
  onRssiReading(cb: (rssi: number) => void): () => void;
}

const encodeToken = (token: string): Uint8Array => {
  const hex = token.replace(/-/g, '');
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
};

class BleServiceImpl implements BleService {
  private manager: BleManager | null = null;
  private rssiCallbacks = new Set<(rssi: number) => void>();
  private scanSubscription: any;

  async start(): Promise<void> {
    this.manager = new BleManager();
    await this.manager.enable();

    const token = await getCurrentToken(); // TODO: implement token provider
    const data = encodeToken(token);
    await this.manager.startAdvertising(SERVICE_UUID, data);

    try {
      // @ts-ignore – Android only
      await this.manager.startForegroundService();
    } catch (_) {}

    this.scanSubscription = this.manager.startDeviceScan(
      [SERVICE_UUID],
      { allowDuplicates: true },
      (error, device) => {
        if (error || !device) return;
        const rssi = device.rssi ?? 0;
        this.rssiCallbacks.forEach(cb => cb(rssi));
      }
    );
  }

  stop(): void {
    this.scanSubscription?.remove();
    this.manager?.stopDeviceScan();
    this.manager?.stopAdvertising();
    this.manager?.destroy();
    this.manager = null;
  }

  onRssiReading(cb: (rssi: number) => void): () => void {
    this.rssiCallbacks.add(cb);
    return () => this.rssiCallbacks.delete(cb);
  }
}
export const bleService = new BleServiceImpl();


