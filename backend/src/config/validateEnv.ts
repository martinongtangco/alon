const REQUIRED = [
  'DEVICE_JWT_SECRET',
  'USER_JWT_SECRET',
  'ADMIN_JWT_SECRET',
  'ADMIN_REFRESH_SECRET',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_VERIFY_SERVICE_SID',
  'DATABASE_URL',
  'REDIS_URL',
];

const WEAK_VALUES = [
  'dev-device-secret',
  'dev-device-secret-change-in-prod',
  'dev-user-secret',
  'dev-user-secret-change-in-prod',
  'dev-admin-secret',
  'dev-admin-secret-change-in-prod',
  'dev-admin-refresh-secret-change-in-prod',
  'super_secret_dev_key_123',
];

export function validateEnv(): void {
  const missing = REQUIRED.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`[startup] Missing required env vars: ${missing.join(', ')}`);
  }

  if (process.env.BYPASS_OTP === 'true' && process.env.NODE_ENV === 'production') {
    throw new Error('[startup] BYPASS_OTP=true is not allowed in production');
  }

  const weak = REQUIRED.filter((k) => WEAK_VALUES.includes(process.env[k] ?? ''));
  if (weak.length && process.env.NODE_ENV === 'production') {
    throw new Error(`[startup] Weak/default secret values detected in production for: ${weak.join(', ')}`);
  }
}