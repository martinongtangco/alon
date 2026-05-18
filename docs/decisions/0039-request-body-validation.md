# ADR 0039: Request Body Validation with Zod

Status: Accepted
Date: 2026-05-18
Milestone: M3 (security — ship before public deployment)
Depends on: [ADR 0015](0015-app-api-topology.md), [ADR 0008](0008-admin-auth-rbac.md)

## Context

The security audit found **no input validation library on any route** (H6). Validation is ad-hoc and incomplete. Specific exploitable gaps:

- `POST /api/reveal` — `token` field is used directly as a Redis key suffix (`token:${token}`) with no format check. A non-UUID value goes straight into a Redis `GET` call.
- `POST /api/buzz` — `targetToken` is not validated before being passed to `apiService.sendBuzz()`.
- `POST /api/push-token` — Expo push token stored without format validation.
- `PUT /api/v1/admin/config/:key` — `value` accepts arbitrary JSON with no schema check against expected types.
- `POST /api/v1/admin/admins` — `email` field has no format validation.
- `POST /api/ghost` — `active` is checked with `typeof active !== 'boolean'` only; no body-level validation.

Beyond the listed gaps, every route that accepts a body is potentially vulnerable to unexpected types, missing fields, or oversized strings causing runtime errors that leak stack traces.

## Decision

Install `zod`:

```
npm install zod
```

No other validation library. Zod is already familiar across the TypeScript ecosystem, produces typed output, and generates clean error messages without extra configuration.

### Validation middleware helper

Create `backend/src/middleware/validate.ts`:

```ts
import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Invalid request body',
        details: result.error.flatten().fieldErrors,
      });
    }
    req.body = result.data; // replace with parsed+coerced data
    next();
  };
}
```

### Schemas to implement

Create `backend/src/schemas/app.ts` for all app-facing schemas:

```ts
import { z } from 'zod';

export const RequestOtpSchema = z.object({
  phone: z.string().regex(/^\+[1-9]\d{6,14}$/, 'Phone must be E.164 format'),
});

export const VerifyOtpSchema = z.object({
  phone: z.string().regex(/^\+[1-9]\d{6,14}$/),
  code: z.string().length(6).regex(/^\d{6}$/),
});

export const RegisterSchema = z.object({
  deviceId: z.string().uuid(),
});

export const UpdateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
  vibes: z.array(z.string().max(50)).max(10).optional(),
  mode: z.enum(['Networking', 'Chill', 'Dating', 'Explorer']).optional(),
});

export const NearbySchema = z.object({
  tokens: z.array(z.string().uuid()).max(50),
});

export const BuzzSchema = z.object({
  targetToken: z.string().uuid().optional(),
});

export const RevealSchema = z.object({
  token: z.string().uuid(),
});

export const GhostSchema = z.object({
  active: z.boolean(),
});

export const PushTokenSchema = z.object({
  token: z.string().regex(/^ExponentPushToken\[.+\]$|^[a-zA-Z0-9_-]{20,}$/, 'Invalid push token format'),
});
```

Create `backend/src/schemas/admin.ts` for admin-facing schemas:

```ts
import { z } from 'zod';

export const AdminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(256),
});

export const AdminTotpSchema = z.object({
  tempToken: z.string().min(1),
  code: z.string().length(6).regex(/^\d{6}$/),
});

export const CreateAdminSchema = z.object({
  email: z.string().email(),
  role: z.enum(['SUPER_ADMIN', 'OPS', 'FINANCE']),
});

export const PlatformConfigUpdateSchema = z.object({
  value: z.union([z.string(), z.number(), z.boolean(), z.record(z.unknown())]),
});

export const UserActionSchema = z.object({
  reason: z.string().max(500).optional(),
});
```

### Wiring

Apply `validate(Schema)` as middleware immediately before each route handler. Example:

```ts
// backend/src/routes/app/auth.ts
import { validate } from '../../middleware/validate';
import { RequestOtpSchema, VerifyOtpSchema } from '../../schemas/app';

router.post('/request-otp', otpRequestLimiter, validate(RequestOtpSchema), async (req, res) => { ... });
router.post('/verify-otp', otpVerifyLimiter, validate(VerifyOtpSchema), async (req, res) => { ... });
```

Apply the same pattern to every route listed below.

### Routes requiring validation (full list)

**App routes:**

| Route | Schema |
|---|---|
| `POST /api/auth/request-otp` | `RequestOtpSchema` |
| `POST /api/auth/verify-otp` | `VerifyOtpSchema` |
| `POST /api/register` | `RegisterSchema` |
| `PUT /api/profile` | `UpdateProfileSchema` |
| `POST /api/nearby` (body) | `NearbySchema` |
| `POST /api/buzz` | `BuzzSchema` |
| `POST /api/reveal` | `RevealSchema` |
| `POST /api/ghost` | `GhostSchema` |
| `POST /api/push-token` | `PushTokenSchema` |

**Admin routes:**

| Route | Schema |
|---|---|
| `POST /api/v1/admin/auth/login` | `AdminLoginSchema` |
| `POST /api/v1/admin/auth/totp` | `AdminTotpSchema` |
| `POST /api/v1/admin/admins` | `CreateAdminSchema` |
| `PUT /api/v1/admin/config/:key` | `PlatformConfigUpdateSchema` |
| `POST /api/v1/admin/users/:id/suspend` | `UserActionSchema` |
| `POST /api/v1/admin/users/:id/ban` | `UserActionSchema` |

### Error response format

Validation errors return HTTP 400:

```json
{
  "error": "Invalid request body",
  "details": {
    "phone": ["Phone must be E.164 format"]
  }
}
```

Do not forward internal Zod error paths or types — `flatten().fieldErrors` is safe to expose.

## Files to create or modify

| File | Change |
|---|---|
| `backend/package.json` | Add `zod` (latest stable, currently `^3.x`) |
| `backend/src/middleware/validate.ts` | Create — generic validation middleware |
| `backend/src/schemas/app.ts` | Create — all app-facing Zod schemas |
| `backend/src/schemas/admin.ts` | Create — all admin-facing Zod schemas |
| `backend/src/routes/app/auth.ts` | Apply `validate()` to OTP routes |
| `backend/src/routes/app/register.ts` | Apply `validate(RegisterSchema)` |
| `backend/src/routes/app/nearby.ts` | Apply `validate(NearbySchema)` |
| `backend/src/routes/app/buzz.ts` | Apply `validate(BuzzSchema)` |
| `backend/src/routes/app/reveal.ts` | Apply `validate(RevealSchema)` |
| `backend/src/routes/app/ghost.ts` | Replace manual `typeof` check with `validate(GhostSchema)` |
| `backend/src/routes/app/push-token.ts` | Apply `validate(PushTokenSchema)` |
| `backend/src/routes/admin/auth.ts` | Apply `validate()` to login and totp |
| `backend/src/routes/admin/admins.ts` | Apply `validate(CreateAdminSchema)` to POST |
| `backend/src/routes/admin/config.ts` | Apply `validate(PlatformConfigUpdateSchema)` to PUT |
| `backend/src/routes/admin/users.ts` | Apply `validate(UserActionSchema)` to suspend/ban |

## Alternatives considered

**Joi** — similar capability but not TypeScript-native. Zod produces TypeScript types directly from schemas, which benefits the rest of the codebase. Rejected.

**express-validator** — decorator/chain style. More verbose for complex objects. Zod schemas are more readable and reusable. Rejected.

**Manual validation (current approach)** — proven insufficient. 14 routes with gaps. Rejected as the baseline.

## Consequences

- `req.body` is replaced with Zod-parsed output after validation. Any route handler that accesses `req.body` will receive coerced, type-safe values. This is a behaviour improvement, not a breaking change.
- The `NearbySchema` caps `tokens` at 50 UUIDs. This is also a DoS mitigation (see ADR 0044). If the BLE scanner ever legitimately sees more than 50 tokens at once, this cap should be revisited.
- Some existing route handlers may have redundant manual type checks after this ADR is implemented. Those can be removed as dead code.
