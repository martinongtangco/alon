# ADR 0042: Authentication Hardening

Status: Accepted
Date: 2026-05-18
Milestone: M3 (security — ship before public deployment)
Depends on: [ADR 0008](0008-admin-auth-rbac.md), [ADR 0015](0015-app-api-topology.md), [ADR 0014](0014-redis-first-token-store.md)

## Context

The security audit identified four authentication weaknesses:

**H2 — Admin JWT accepted via query string.**
`backend/src/middleware/authAdmin.ts` falls back to `req.query.token` when no `Authorization` header is present. Bearer tokens in query strings appear in server access logs, browser history, proxy logs, and referrer headers. Admin JWTs are high-privilege and must never appear in URLs.

**H4 — App user JWTs valid for 90 days with no revocation.**
`backend/src/routes/app/auth.ts` issues user JWTs with a 90-day expiry. There is no logout endpoint and no token blacklist. A stolen token remains valid for up to 90 days with no way to invalidate it short of rotating the signing secret (which logs out all users).

**H5 — Raw Twilio error body returned to clients.**
`backend/src/routes/app/auth.ts` forwards `details: body` from Twilio API responses directly into HTTP responses on OTP errors. Twilio bodies may contain internal service identifiers, account SIDs, and request IDs. Internal error details must never reach app clients.

**L5 — Admin refresh token has no server-side revocation.**
The admin refresh token is a signed JWT stored in an httpOnly cookie. The `/logout` endpoint clears the cookie client-side but does not blacklist the token server-side. A stolen cookie allows an attacker to continue minting new access tokens until the refresh JWT naturally expires (8 hours).

## Decision

### 1. Remove query-string token acceptance from admin middleware (H2)

In `backend/src/middleware/authAdmin.ts`, remove the `req.query.token` fallback:

```ts
// BEFORE
const token = req.headers.authorization?.split(' ')[1] ?? (req.query.token as string);

// AFTER
const token = req.headers.authorization?.split(' ')[1];
if (!token) {
  return res.status(401).json({ error: 'Unauthorized' });
}
```

The admin dashboard already sends tokens in the `Authorization: Bearer <token>` header. The SSE endpoint (`backend/src/routes/admin/sse.ts`) uses the same `authAdmin` middleware — for SSE, where the browser's `EventSource` API cannot set custom headers, the SSE connections must switch to cookie-based auth instead.

**SSE cookie auth patch for `sse.ts`:** SSE connections already have `credentials: true` in the CORS config. The admin access token is also stored in a cookie named `admin_token` during login. Update `authAdmin.ts` to also accept the `admin_token` cookie for SSE routes:

```ts
// In authAdmin.ts — accept cookie as fallback ONLY for SSE (not general routes)
// Pass `{ allowCookie: true }` option from the SSE router:
export function authAdmin(options?: { allowCookie?: boolean }) {
  return (req: Request, res: Response, next: NextFunction) => {
    let token = req.headers.authorization?.split(' ')[1];
    if (!token && options?.allowCookie) {
      token = req.cookies?.admin_token;
    }
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    // ... verify token ...
  };
}
```

In `sse.ts`:
```ts
sseRouter.use(authAdmin({ allowCookie: true }));
```

All other admin routes continue to use `authAdmin()` (no cookie fallback).

If `admin_token` cookie is not currently set on login, add it alongside the existing `admin_refresh` cookie in `backend/src/routes/admin/auth.ts`:

```ts
res.cookie('admin_token', accessToken, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 15 * 60 * 1000, // 15 minutes — matches access token expiry
});
```

### 2. Reduce app user JWT expiry and add a logout endpoint (H4)

**Reduce JWT expiry from 90 days to 30 days.** This is a pragmatic middle ground: short enough to limit the stolen-token window, long enough that active users aren't repeatedly re-authenticated. Full revocation infrastructure (token blacklist) is deferred to M4.

In `backend/src/routes/app/auth.ts`, change all three `jwt.sign()` calls that issue user tokens:

```ts
// BEFORE
expiresIn: '90d'

// AFTER
expiresIn: '30d'
```

**Add a logout endpoint** at `DELETE /api/auth/session` or `POST /api/auth/logout`:

```ts
// backend/src/routes/app/auth.ts
router.post('/logout', authUser, async (req, res) => {
  // M3: client-side logout only — invalidate client token storage.
  // Full server-side blacklist is deferred to M4 (requires Redis token store for user JWTs).
  // The token's 30-day TTL is the revocation mechanism for now.
  res.json({ ok: true });
});
```

The logout endpoint is intentionally minimal for M3. It signals to the client that the session is cleared, and the client should delete the stored JWT from AsyncStorage. Server-side revocation is tracked as a future improvement.

**Client-side change (`app/src/services/api/index.ts`):** Add a `logout()` method that calls `POST /api/auth/logout` and then clears AsyncStorage. Wire it to the Profile screen's sign-out action.

### 3. Sanitise Twilio error responses (H5)

In `backend/src/routes/app/auth.ts`, replace all instances of `details: body` with a sanitised message:

```ts
// BEFORE (lines 48-49 and 97-99)
return res.status(400).json({ error: 'Failed to send OTP', details: body });

// AFTER
console.error('[auth] Twilio error:', body); // log internally
return res.status(400).json({ error: 'Failed to send verification code. Try again.' });
```

Also fix the catch block that exposes `error?.message` (line ~201):

```ts
// BEFORE
return res.status(500).json({ error: 'Verification failed', detail: error?.message });

// AFTER
console.error('[auth] verify error:', error);
return res.status(500).json({ error: 'Verification failed. Please try again.' });
```

The rule: **log full error details server-side, return only a generic safe message to clients.**

### 4. Admin refresh token server-side revocation (L5)

Add a Redis-backed refresh token allowlist. On issue, store the refresh token JTI (JWT ID) in Redis with the same TTL as the token. On refresh and logout, check that the JTI exists; on logout, delete it.

**In `backend/src/routes/admin/auth.ts`:**

When issuing a refresh token, add a `jti` (JWT ID) claim and store it in Redis:

```ts
import { v4 as uuidv4 } from 'uuid';

const jti = uuidv4();
const refreshToken = jwt.sign(
  { sub: admin.id, role: admin.role, jti },
  process.env.ADMIN_REFRESH_SECRET!,
  { expiresIn: '8h' }
);

// Store jti in Redis — 8h TTL (slightly longer than token expiry for clock skew)
await redis.set(`admin_refresh_jti:${jti}`, admin.id, 'EX', 29100); // 8h + 5 min buffer
```

When accepting a refresh token:

```ts
const payload = jwt.verify(refreshToken, process.env.ADMIN_REFRESH_SECRET!);
const stored = await redis.get(`admin_refresh_jti:${payload.jti}`);
if (!stored) {
  return res.status(401).json({ error: 'Session expired or revoked' });
}
```

On logout, delete the JTI:

```ts
router.post('/logout', authAdmin(), async (req, res) => {
  const refreshToken = req.cookies?.admin_refresh;
  if (refreshToken) {
    try {
      const payload = jwt.decode(refreshToken) as any;
      if (payload?.jti) {
        await redis.del(`admin_refresh_jti:${payload.jti}`);
      }
    } catch { /* ignore decode errors */ }
  }
  res.clearCookie('admin_refresh');
  res.clearCookie('admin_token');
  res.json({ ok: true });
});
```

## Files to modify

| File | Change |
|---|---|
| `backend/src/middleware/authAdmin.ts` | Remove `req.query.token` fallback; add `allowCookie` option |
| `backend/src/routes/admin/auth.ts` | Add `jti` to refresh token, store in Redis, check on refresh, delete on logout; set `admin_token` cookie; clear both cookies on logout |
| `backend/src/routes/admin/sse.ts` | Use `authAdmin({ allowCookie: true })` |
| `backend/src/routes/app/auth.ts` | Reduce JWT expiry to 30d; strip Twilio error bodies; add `POST /logout` handler |
| `backend/src/services/api/index.ts` (app) | Add `logout()` method calling `POST /api/auth/logout` and clearing AsyncStorage |

## Alternatives considered

**Full app user JWT blacklist (Redis) for M3** — the correct long-term solution. Requires storing every issued JWT JTI in Redis, querying on every authenticated request. Adds ~1ms to every API call. The risk/benefit for M3 (pre-launch, small user base) doesn't justify the operational complexity. Deferred to M4. Rejected for M3.

**Shorter app JWT expiry (7 days)** — would require more frequent re-authentication, which is painful for a passive background app. 30 days is the minimum comfortable window for a proximity app that runs in the background. Rejected as too aggressive.

**Remove admin query-string fallback only for non-SSE routes** — half-measure. The correct fix is to never accept tokens in query strings, and to use cookies for SSE. Full removal is the right approach. Accepted.

## Consequences

- SSE connections now require an `admin_token` cookie. Any admin dashboard page that opens an SSE connection must ensure the cookie is present. This happens automatically after login — no dashboard code changes needed unless the login flow currently does not set the cookie (in which case, add it per the spec above).
- App users who are currently authenticated with tokens issued before this ADR will have tokens expiring at 90 days from issue. After the 30-day change ships, new tokens will expire sooner. No forced logout required — existing long-lived tokens simply run to their original expiry.
- Admin refresh tokens are now tracked in Redis under `admin_refresh_jti:{jti}`. The key count is bounded by `(number of active admins)`. Negligible Redis memory impact.
- Twilio error bodies are now logged server-side only. If debugging OTP issues, check server logs rather than HTTP responses.
