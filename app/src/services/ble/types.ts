import { NearbyPerson } from '../../types';

export interface BleService {
  start(): Promise<void>;
  stop(): void;
  updateToken(token: string): Promise<void>;
  onRssiReading(cb: (rssi: number) => void): () => void;
  subscribe(cb: (nearby: NearbyPerson[]) => void): () => void;
}
