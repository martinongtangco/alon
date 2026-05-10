import { SignalLevel } from '../../types';

export type ProximityBand = 'out-of-range' | 'far' | 'near' | 'very-near';

const WINDOW = 5;
const THRESHOLDS = { nearFar: -70, veryNearNear: -55 };
const HYSTERESIS = 5; // dBm guard either side of each threshold
const STALE_MS = 5000; // no reading in 5s → out-of-range

const readings: number[] = [];

function addReading(rssi: number): number {
  readings.push(rssi);
  if (readings.length > WINDOW) readings.shift();
  return readings.reduce((a, b) => a + b, 0) / readings.length;
}

function bandFor(avg: number): ProximityBand {
  if (avg < -90) return 'out-of-range';
  if (avg < THRESHOLDS.nearFar) return 'far';
  if (avg < THRESHOLDS.veryNearNear) return 'near';
  return 'very-near';
}

export function bandToSignalLevel(band: ProximityBand): SignalLevel {
  switch (band) {
    case 'very-near': return 5;
    case 'near':      return 3;
    case 'far':       return 1;
    default:          return 0;
  }
}

interface ProximityServiceInternal {
  start(onRssi: (cb: (rssi: number) => void) => () => void): void;
  stop(): void;
  onBandChange(cb: (band: ProximityBand) => void): () => void;
}

class ProximityServiceImpl implements ProximityServiceInternal {
  private rssiSubscribers = new Set<(cb: (rssi: number) => void) => void>();
  private bandSubscribers = new Set<(band: ProximityBand) => void>();
  private currentBand: ProximityBand = 'out-of-range';
  private staleTimer: ReturnType<typeof setTimeout> | null = null;
  private isRunning = false;

  start(onRssi: (cb: (rssi: number) => void) => () => void): void {
    this.isRunning = true;
    this.rssiSubscribers.add(onRssi);
    onRssi((rssi: number) => this.handleRssi(rssi));
  }

  stop(): void {
    this.isRunning = false;
    this.rssiSubscribers.clear();
    if (this.staleTimer) {
      clearTimeout(this.staleTimer);
      this.staleTimer = null;
    }
    readings.length = 0;
    this.currentBand = 'out-of-range';
  }

  onBandChange(cb: (band: ProximityBand) => void): () => void {
    this.bandSubscribers.add(cb);
    return () => this.bandSubscribers.delete(cb);
  }

  private handleRssi(rssi: number): void {
    if (!this.isRunning) return;

    const avg = addReading(rssi);
    const newBand = bandFor(avg);

    // Hysteresis: only change band if crossed threshold by ±HYSTERESIS
    const bandChanged = this.applyHysteresis(newBand);

    if (bandChanged) {
      this.broadcastBand(this.currentBand);
    }

    this.resetStaleTimer();
  }

  private applyHysteresis(rawBand: ProximityBand): boolean {
    let changed = false;

    // All transitions: [from, to, threshold]
    // Moving to a closer band: need avg ≤ threshold
    // Moving to a farther band: need avg ≥ threshold
    const transitions: [ProximityBand, ProximityBand, number, 'closer'|'farther'][] = [
      ['out-of-range', 'far',       THRESHOLDS.nearFar - HYSTERESIS, 'closer'],   // -75: far requires avg ≤ -75
      ['far', 'out-of-range',       THRESHOLDS.nearFar + HYSTERESIS, 'farther'],  // -65: out-of-range requires avg ≥ -65
      ['far', 'near',               THRESHOLDS.veryNearNear - HYSTERESIS, 'closer'], // -60: near requires avg ≤ -60
      ['near', 'far',               THRESHOLDS.veryNearNear + HYSTERESIS, 'farther'], // -50: far requires avg ≥ -50
      ['near', 'very-near',         -40 - HYSTERESIS, 'closer'],   // -45: very-near requires avg ≤ -45
      ['very-near', 'near',         -40 + HYSTERESIS, 'farther'],  // -35: near requires avg ≥ -35
    ];

    for (const [from, to, threshold, dir] of transitions) {
      if (this.currentBand === from) {
        const avg = readings.length > 0
          ? readings.reduce((a, b) => a + b, 0) / readings.length
          : -999;
        if (dir === 'closer' && avg <= threshold) {
          this.currentBand = to;
          changed = true;
          break;
        }
        if (dir === 'farther' && avg >= threshold) {
          this.currentBand = to;
          changed = true;
          break;
        }
      }
    }

    return changed;
  }

  private broadcastBand(band: ProximityBand): void {
    this.bandSubscribers.forEach((cb) => cb(band));
  }

  private resetStaleTimer(): void {
    if (this.staleTimer) clearTimeout(this.staleTimer);
    this.staleTimer = setTimeout(() => {
      if (this.currentBand !== 'out-of-range') {
        this.currentBand = 'out-of-range';
        this.broadcastBand('out-of-range');
      }
      readings.length = 0;
    }, STALE_MS);
  }
}

export const proximityService = new ProximityServiceImpl();