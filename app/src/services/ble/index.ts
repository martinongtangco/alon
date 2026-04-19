import { NearbyPerson } from '../../types';
import { mockNearby } from '../../constants/mockData';

type Listener = (people: NearbyPerson[]) => void;

class MockBleService {
  private listeners = new Set<Listener>();
  private interval: ReturnType<typeof setInterval> | null = null;
  private active = false;

  start() {
    if (this.active) return;
    this.active = true;
    this.emit(mockNearby);
    this.interval = setInterval(() => {
      const jittered = mockNearby.map((p) => ({
        ...p,
        distanceMeters: Math.max(
          5,
          Math.round(p.distanceMeters + (Math.random() - 0.5) * 20),
        ),
        bearingDeg: (p.bearingDeg + (Math.random() - 0.5) * 12 + 360) % 360,
      }));
      this.emit(jittered);
    }, 2500);
  }

  stop() {
    this.active = false;
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
    this.emit([]);
  }

  isActive() {
    return this.active;
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit(people: NearbyPerson[]) {
    this.listeners.forEach((fn) => fn(people));
  }
}

export const bleService = new MockBleService();
