# ADR 0037: Secret Hygiene and Environment Variable Hardening

Status: Accepted
Date: 2026-05-18
Milestone: M3 (security — ship before any staging or production deployment)
Depends on: [ADR 0015](0015-app-api-topology.md), [ADR 0008](0008-admin-auth-rbac.md)

## Context

A security audit identified three critical/high issues related to secrets and environment configuration:

**C1 — Live Twilio credentials in `.env`.**
`backend/.env` contains `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_VERIFY_SERVICE_SID`. While `.env` is gitignored, the file exists on disk in the worktree. These credentials are treated as compromised and must be rotated in the Twilio console before this ADR is merged.

**C2 — `BYPASS_OTP=true` committed in `.env`.**
`backend/src/routes/app/auth.ts` accepts code `000000` for any phone number when `BYPASS_OTP=true`. This `.env` setting must never reach any deployed environment. There is currently no runtime guard preventing it.

**H3 — Weak and missing JWT secrets.**
`backend/src/middleware/authDevice.ts` and `authUser.ts` both fall back to hardcoded strings (`'dev-device-secret'`, `'dev-user-secret'`) when the env var is unset. `USER_JWT_SECRET` is not set in `.env` at all — the middleware silently uses the fallback. These are visible in source code and easily guessable.

## Decision

### 1. Rotate Twilio credentials (out-of-band, human action)

This is not a code change. Before merging any work under this ADR, the product owner must:
1. Log into the Twilio console and rotate `TWILIO_AUTH_TOKEN`.
2. Update the local `backend/.env` with the new token.
3. Update all deployment environments (Railway) with the new values.

The implementing model does not need to do this — it is a prerequisite confirmed by the product owner.

### 2. Add a startup secret validation guard

Create `backend/src/config/validateEnv.ts`:

```ts
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

const WEAK_VALUES = ['dev-device-secret', 'dev-user-secret', 'dev-admin-secret', 'super_secret_dev_key_123'];

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
```

Call `validateEnv()` at the very top of `backend/src/index.ts`, before any other setup:

```ts
import { validateEnv } from './config/validateEnv';
validateEnv();
```

### 3. Add `USER_JWT_SECRET` to `backend/.env`

Add to `backend/.env` (alongside existing `DEVICE_JWT_SECRET`):

```
USER_JWT_SECRET=dev-user-secret-change-in-prod
```

This eliminates the silent fallback. The fallback strings in `authDevice.ts` and `authUser.ts` **must remain** for local dev ergonomics, but `validateEnv()` will catch them in production.

### 4. Upgrade the `BYPASS_OTP` guard in `auth.ts`

Change the bypass log from `console.log` to `console.warn` so it is visible in log monitoring:

```ts
// backend/src/routes/app/auth.ts — lines 25-28 and 78-83
if (process.env.BYPASS_OTP === 'true') {
  console.warn('[auth] BYPASS_OTP active — accepting code 000000 for all numbers');
  ...
}
```

### 5. Add a `.env.example` file

Create `backend/.env.example` documenting every required variable with placeholder values. This is committed to the repo (it contains no secrets). Remove any comments from `.env` that might appear to be documentation — `.env` is for values, `.env.example` is for documentation.

```
# backend/.env.example
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/alon
REDIS_URL=redis://localhost:6379
DEVICE_JWT_SECRET=CHANGE_ME_32_CHARS_MINIMUM
USER_JWT_SECRET=CHANGE_ME_32_CHARS_MINIMUM
ADMIN_JWT_SECRET=CHANGE_ME_32_CHARS_MINIMUM
ADMIN_REFRESH_SECRET=CHANGE_ME_32_CHARS_MINIMUM
TWILIO_ACCOUNT_SID=ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
TWILIO_AUTH_TOKEN=CHANGE_ME
TWILIO_VERIFY_SERVICE_SID=VAXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
BYPASS_OTP=false
```

## Files to create or modify

| File | Change |
|---|---|
| `backend/src/config/validateEnv.ts` | Create — startup guard |
| `backend/src/index.ts` | Import and call `validateEnv()` before anything else |
| `backend/src/routes/app/auth.ts` | Change `console.log` → `console.warn` on BYPASS_OTP branches |
| `backend/.env` | Add `USER_JWT_SECRET=dev-user-secret-change-in-prod` |
| `backend/.env.example` | Create |

## Alternatives considered

**Fail-fast on any weak secret regardless of NODE_ENV** — rejected. Dev machines use predictable secrets for simplicity. Failing on dev would block contributors. The guard is scoped to `NODE_ENV=production`.

**Use a secrets manager (Vault, AWS Secrets Manager)** — correct long-term approach but out of scope for this milestone. Railway env vars are the accepted deployment secret store per ADR 0017. Add secrets manager as a future ADR when multi-environment deployments exist.

**Rename or delete the BYPASS_OTP code path entirely** — rejected for now. It has legitimate use in CI pipelines that can't receive SMS. The guard in `validateEnv` and the promotion to `console.warn` are sufficient for M3.

## Consequences

- The app will crash on startup if any required env var is missing. This is intentional — a misconfigured deployment fails loudly at boot rather than silently misbehaving in production.
- `USER_JWT_SECRET` is now an explicit required variable. Any existing deployment without it will fail the startup check until the variable is added.
- No runtime behaviour changes — this ADR is purely defensive infrastructure.
