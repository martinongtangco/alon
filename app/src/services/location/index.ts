interface LocationFix {
  lat: number;
  lng: number;
  accuracyMeters: number;
  timestamp: number;
}

type Listener = (fix: LocationFix) => void;

class MockLocationService {
  private listeners = new Set<Listener>();
  private interval: ReturnType<typeof setInterval> | null = null;

  start() {
    if (this.interval) return;
    this.interval = setInterval(() => {
      this.emit({
        lat: 37.7749 + (Math.random() - 0.5) * 0.001,
        lng: -122.4194 + (Math.random() - 0.5) * 0.001,
        accuracyMeters: 65,
        timestamp: Date.now(),
      });
    }, 30000);
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit(fix: LocationFix) {
    this.listeners.forEach((fn) => fn(fix));
  }
}

export const locationService = new MockLocationService();
