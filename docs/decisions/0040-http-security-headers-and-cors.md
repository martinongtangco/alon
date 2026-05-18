# ADR 0040: HTTP Security Headers and CORS Policy

Status: Accepted
Date: 2026-05-18
Milestone: M3 (security — ship before public deployment)
Depends on: [ADR 0003](0003-backend-framework.md), [ADR 0005](0005-admin-dashboard-backend-topology.md)

## Context

The security audit found two medium-severity issues:

**M1 — No HTTP security headers.**
`backend/src/index.ts` uses no helmet or equivalent. Missing headers include `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, `Content-Security-Policy`, and `Referrer-Policy`. The admin dashboard HTML is served from the same Express process, making this more consequential — XSS in the admin UI is a direct path to platform compromise.

**M2 — CORS configured as fully open with credentials.**
`backend/src/index.ts` uses `cors({ origin: true, credentials: true })`. `origin: true` reflects any `Origin` header back as allowed. Combined with `credentials: true`, any website can make credentialed cross-origin requests to all endpoints, including admin routes. A malicious site can read admin API responses if the victim has a valid `admin_refresh` cookie in their browser.

The backend serves two consumer classes:
1. **The React Native mobile app** — not a browser, does not send `Origin` headers, not affected by CORS.
2. **The admin dashboard** — a Vite SPA that runs in the browser, currently on `localhost:5173` in development and will be on a fixed subdomain in production.

## Decision

### 1. Install helmet

```
npm install helmet
```

Apply helmet in `backend/src/index.ts` before any route middleware:

```ts
import helmet from 'helmet';

app.use(helmet({
  // Content-Security-Policy: allow assets only from self; no inline scripts
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],  // Tailwind requires inline styles
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
    },
  },
  // HSTS: 1 year, include subdomains
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
  },
  // All other helmet defaults (X-Content-Type-Options, X-Frame-Options, etc.) are enabled by default
}));
```

The `'unsafe-inline'` exception for styles is required because the admin dashboard uses Tailwind CSS utility classes, which are injected as style attributes in some configurations. If the admin dashboard moves to a separate build step (M3+), this can be tightened.

### 2. Lock down CORS

Replace `cors({ origin: true, credentials: true })` with an explicit allowlist:

```ts
import cors from 'cors';

const ALLOWED_ORIGINS = [
  'http://localhost:5173',   // Admin dashboard dev server
  'http://localhost:4173',   // Admin dashboard preview
  process.env.ADMIN_ORIGIN,  // Production admin URL (e.g. https://admin.yourdomain.com)
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no Origin header (React Native app, curl, Postman)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
```

Add `ADMIN_ORIGIN` to `backend/.env.example`:

```
ADMIN_ORIGIN=https://admin.yourdomain.com
```

Add `ADMIN_ORIGIN` to the `validateEnv()` optional list (not required for dev, required for production — update `validateEnv.ts` to warn if unset in production but not crash):

```ts
if (process.env.NODE_ENV === 'production' && !process.env.ADMIN_ORIGIN) {
  console.warn('[startup] ADMIN_ORIGIN is not set — CORS will reject all admin dashboard requests in production');
}
```

### 3. Add body size limit

While not a CORS or headers issue, the audit also identified **L8 — no request body size limit**. Address it here since it's a one-line change to the same setup block:

```ts
app.use(express.json({ limit: '64kb' }));
app.use(express.urlencoded({ extended: true, limit: '64kb' }));
```

64kb is well above any legitimate request body in this API (the largest expected body is a profile update with a bio field at 500 chars). Payloads above this limit receive HTTP 413.

## Files to create or modify

| File | Change |
|---|---|
| `backend/package.json` | Add `helmet` (latest stable, currently `^8.x`) |
| `backend/src/index.ts` | Add `helmet()`, replace `cors()` config, add body `limit` |
| `backend/.env` | Add `ADMIN_ORIGIN=http://localhost:5173` for local dev |
| `backend/.env.example` | Add `ADMIN_ORIGIN=https://admin.yourdomain.com` |
| `backend/src/config/validateEnv.ts` | Add warning when `ADMIN_ORIGIN` unset in production (ADR 0037) |

## Alternatives considered

**Custom header middleware instead of helmet** — helmet is a well-maintained, audited library that covers 15+ header hardening scenarios. Writing equivalent middleware manually is error-prone and provides no benefit. Rejected.

**Per-route CORS instead of global** — the app API routes don't need CORS at all (React Native doesn't send Origin headers). Applying CORS only to admin routes would be more precise. However, keeping CORS global with an allowlist is simpler and safe — the allowlist is the control, not the route scope. Rejected as over-engineering.

**`origin: false` for app routes, allowlist for admin routes** — correct but requires splitting middleware by route prefix, which adds complexity. The allowlist approach handles both correctly. Rejected for now.

## Consequences

- The `ADMIN_ORIGIN` environment variable must be set in production Railway deployment for the admin dashboard to function. Missing it will cause all admin dashboard API requests to fail with CORS errors.
- Requests from `localhost:5173` (dev) will work without any change.
- The React Native app is unaffected — it does not send `Origin` headers.
- The CSP `'unsafe-inline'` for styles may need tightening if the admin dashboard introduces user-generated content rendering. Document this as a future hardening item.
- Body size limit of 64kb will reject malformed or oversized payloads with HTTP 413. No legitimate client should hit this limit.
