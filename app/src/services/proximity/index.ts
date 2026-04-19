import { NearbyPerson, SignalLevel } from '../../types';

export const proximityService = {
  signalLevelFor(nearby: NearbyPerson[]): SignalLevel {
    if (nearby.length === 0) return 0;
    const closest = nearby.reduce((min, p) =>
      p.distanceMeters < min.distanceMeters ? p : min,
    );
    if (closest.distanceMeters <= 10) return 5;
    if (closest.distanceMeters <= 25) return 4;
    if (closest.distanceMeters <= 75) return 3;
    if (closest.distanceMeters <= 150) return 2;
    if (closest.distanceMeters <= 300) return 1;
    return 0;
  },
};
