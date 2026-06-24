import rateLimit from 'express-rate-limit';

// Extract device token from Authorization header for rate limiting.
// For authenticated endpoints, use the token as the key (device identity).
// For unauthenticated endpoints, fall back to IP address.
const extractKey = (req: any) => {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    return `token:${auth.slice(7).slice(0, 32)}`; // use first 32 chars of token as key prefix
  }
  return `ip:${req.ip}`;
};

// Aggressive: OTP request — max 5 per IP per 10 minutes
// Uses IP since OTP endpoints are unauthenticated.
export const otpRequestLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many OTP requests. Try again in 10 minutes.' },
});

// Aggressive: OTP verify — max 10 attempts per IP per 10 minutes
export const otpVerifyLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many verification attempts. Try again in 10 minutes.' },
});

// Moderate: device registration — max 20 per IP per hour
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many registrations from this IP.' },
});

// Moderate: admin login — max 10 attempts per IP per 15 minutes
export const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again later.' },
});

// Light: general authenticated app endpoints — max 120 per device per minute
// Uses device token (from Authorization header) as the rate limit key,
// falling back to IP for unauthenticated requests. This prevents NAT/load
// balancer shared-IP issues and makes limits per-device rather than per-IP.
export const appApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  keyGenerator: extractKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit exceeded.' },
});
