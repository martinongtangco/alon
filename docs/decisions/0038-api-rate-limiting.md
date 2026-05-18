# ADR 0038: API Rate Limiting

Status: Accepted
Date: 2026-05-18
Milestone: M3 (security — ship before public deployment)
Depends on: [ADR 0015](0015-app-api-topology.md), [ADR 0008](0008-admin-auth-rbac.md)

## Context

The security audit found **no rate limiting on any endpoint** (H1). The most severe consequences:

- `POST /api/auth/request-otp` — an attacker can blast any phone number with unlimited OTP SMS, causing Twilio billing amplification and user harassment.
- `POST /api/auth/verify-otp` — 6-digit OTP codes are brute-forceable in at most 1,000,000 attempts with no lockout.
- `POST /api/register` — device JWTs can be minted at unlimited rate, flooding Redis with `token:*` keys.
- All admin auth endpoints (`/api/v1/admin/auth/login`, `/totp`) — unlimited password and TOTP attempts.
- `POST /api/buzz` — the existing per-device Redis cooldown (`cooldown:{deviceId}`) is correct but HTTP-level flooding remains unguarded.

The buzz cooldown already in `buzz.ts` is a *business rule* (max 3 buzzes per day), not a *security rate limit*. Both are needed.

## Decision

Install `express-rate-limit`:

```
npm install express-rate-limit
```

No additional store is needed for M3 — the default in-memory store is sufficient for a single-process Railway deployment. If the backend goes multi-process, swap to `rate-limit-redis` (not in scope for M3).

### Rate limit tiers

Apply limits at the route level, not globally, so each endpoint has a tuned limit. Define named limiters in `backend/src/middleware/rateLimits.ts`:

```ts
import rateLimit from 'express-rate-limit';

// Aggressive: OTP request — max 5 per phone number per 10 minutes
// Key by IP. Phone-based keying would require parsing the body, which is too complex here.
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

// Light: general authenticated app endpoints — max 120 per IP per minute
export const appApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit exceeded.' },
});
```

### Wiring

Apply each limiter as the first middleware on the relevant route:

```ts
// backend/src/routes/app/auth.ts
router.post('/request-otp', otpRequestLimiter, async (req, res) => { ... });
router.post('/verify-otp', otpVerifyLimiter, async (req, res) => { ... });

// backend/src/routes/app/register.ts
router.post('/', registerLimiter, async (req, res) => { ... });

// backend/src/routes/admin/auth.ts
router.post('/login', adminLoginLimiter, async (req, res) => { ... });
router.post('/totp', adminLoginLimiter, async (req, res) => { ... });
```

Apply `appApiLimiter` as router-level middleware on the entire app API router in `backend/src/routes/app/index.ts`:

```ts
import { appApiLimiter } from '../../middleware/rateLimits';
appRouter.use(appApiLimiter);
```

This catches all app endpoints not already covered by a stricter limiter. The stricter per-route limiters execute first (Express applies middleware in registration order).

### Response format

All rate limit errors return HTTP 429 with `{ error: "..." }` — consistent with the rest of the API error contract. Do not return HTML.

`standardHeaders: true` sets `RateLimit-*` headers per RFC 6585, which the mobile app can read to implement backoff if needed in a future milestone.

## Files to create or modify

| File | Change |
|---|---|
| `backend/package.json` | Add `express-rate-limit` (latest stable, currently `^7.x`) |
| `backend/src/middleware/rateLimits.ts` | Create — all named limiter exports |
| `backend/src/routes/app/auth.ts` | Apply `otpRequestLimiter` to `/request-otp`, `otpVerifyLimiter` to `/verify-otp` |
| `backend/src/routes/app/register.ts` | Apply `registerLimiter` |
| `backend/src/routes/admin/auth.ts` | Apply `adminLoginLimiter` to `/login` and `/totp` |
| `backend/src/routes/app/index.ts` | Apply `appApiLimiter` as router-level middleware |

## Alternatives considered

**Global rate limiter via `app.use()`** — simpler but would apply the same limit to OTP endpoints and general endpoints. OTP endpoints need a tighter limit (5 per 10 min) than general endpoints (120 per min). Per-route limiters give the right granularity. Rejected as too blunt.

**Redis-backed store for distributed rate limiting** — correct for multi-process deployments. For M3 on a single Railway process, in-memory is sufficient and has zero operational overhead. Add `rate-limit-redis` when horizontal scaling is needed.

**IP + phone keying for OTP limiter** — would be more precise but requires extracting the phone number from the body before the limiter runs, which needs a custom key generator. Adds complexity for marginal gain at M3. IP-based is sufficient. Rejected for now.

## Consequences

- Legitimate users behind a shared NAT (office, university) could hit IP-based rate limits if many accounts are registered from the same IP. Acceptable for M3 given the app's proximity-based use case.
- The in-memory store resets on process restart. During a Railway redeploy, rate limit counters reset. Acceptable for M3.
- `RateLimit-*` response headers are now present on all rate-limited routes. No client-side handling required, but the app can use them for exponential backoff in a future iteration.
