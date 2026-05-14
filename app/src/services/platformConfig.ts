import { PlatformConfig } from './api';

const DEFAULTS: PlatformConfig = {
  BUZZ_COOLDOWN: 120,
  COMPATIBILITY_THRESHOLD: 0.5,
};

class PlatformConfigService {
  private config: PlatformConfig = { ...DEFAULTS };

  get(): PlatformConfig {
    return { ...this.config };
  }

  set(config: PlatformConfig): void {
    this.config = { ...this.config, ...config };
  }

  getBuzzCooldown(): number {
    return this.config.BUZZ_COOLDOWN;
  }

  getCompatibilityThreshold(): number {
    return this.config.COMPATIBILITY_THRESHOLD;
  }
}

export const platformConfigService = new PlatformConfigService();