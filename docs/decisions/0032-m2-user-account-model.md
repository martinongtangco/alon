# ADR 0030: M2 — User Account Model (Device → User Identity)

Status: Accepted
Date: 2026-05-14
Milestone: M2
Depends on: [ADR 0015](0015-app-api-topology.md), [ADR 0010](0010-app-schema-data-model.md)

## Context

M1 identity is device-based: a `deviceId` (UUID generated on first launch) is registered with the backend and linked to an entry in `app.users`. There is no login, no password, no email — only a device JWT issued at registration time.

ADR 0015 explicitly noted:
> *`authDevice.ts` (M1) will be supplemented by `authUser.ts` in M2 when user profiles are introduced. Device registration will be linked to a user account at that point.*

In M2, mutual reveals surface names and profiles (ADR 0027). Matches must persist across device reinstalls. Users need a way to recover their account if they switch phones. Device identity alone cannot satisfy these requirements — a persistent user account is needed.

The decision is: **how do users authenticate in M2?**

Options considered:
1. **Phone number + OTP** — user enters a phone number; backend sends a one-time code via SMS (Twilio/Vonage). Low friction, high conversion, verifiable identity signal.
2. **Email + magic link** — user enters an email; backend sends a sign-in link. Higher friction than phone OTP for mobile; email apps add context-switching.
3. **Social OAuth (Google / Apple)** — delegates auth to an existing account. Apple Sign In is required by App Store review if any other social login is offered. Adds OAuth dependency.
4. **Passkeys** — FIDO2/WebAuthn. Excellent UX on modern devices but requires the device to support passkeys and the user to have iCloud/Google Password Manager set up. Too early for a fresh consumer app.

## Decision

**M2 uses phone number + OTP authentication via a third-party SMS provider.**

SMS provider: **Twilio Verify** (the managed OTP product, not raw SMS). Twilio Verify handles code generation, delivery, retry logic, and rate limiting out of the box. The backend calls the Twilio Verify API and never stores OTP codes itself.

### Auth flow

```
1. User enters phone number on new "Sign In" screen (shown before or during onboarding).
2. App calls POST /api/auth/request-otp  { phone: "+63XXXXXXXXXX" }
   Backend calls Twilio Verify: create verification → Twilio sends SMS.
   Response: { ok: true }

3. User enters the 6-digit code.
4. App calls POST /api/auth/verify-otp   { phone, code }
   Backend calls Twilio Verify: check verification.
   On success: backend links phone to existing app.users row (or creates new row).
   Issues a user JWT (HS256, { sub: userId, type: 'user', exp: +90d }).
   Response: { userToken: string, expiresAt: number }

5. App stores userToken in AsyncStorage (alongside deviceId and authToken).
6. Subsequent API calls use userToken as the Bearer token for user-scoped endpoints.
```

### Device → user linkage

At step 4, the backend checks whether the phone number already exists in `app.users`:

- **New user** — create a new `app.users` row. The `deviceId` is associated with this row.
- **Returning user on same device** — phone found; `deviceId` is already linked. Refresh the user JWT.
- **Returning user on new device** — phone found; update `device_id` on the existing `app.users` row. The old device effectively loses auth (its device JWT was tied to the old row, now the user JWT supersedes it). Matches and profile are restored.

### Middleware changes

`authUser.ts` is added alongside `authDevice.ts`. It verifies the user JWT (`{ sub: userId, type: 'user' }`). Endpoints that require user identity (reveals, matches, profile updates) use `authUser`. Device registration and token rotation continue to use `authDevice`.

The endpoint `/api/register` remains unauthenticated — a new device must be able to register before a user account exists.

### Schema addition (M2 migration)

```sql
ALTER TABLE app.users
  ADD COLUMN phone        TEXT UNIQUE,
  ADD COLUMN phone_verified BOOLEAN NOT NULL DEFAULT FALSE;
```

Phone is nullable initially (existing M1 device records have no phone). After OTP verification it is populated and `phone_verified` is set to true. App endpoints that require `authUser` will fail gracefully for unverified devices (return 401) with a prompt to complete phone verification.

### Onboarding placement

Phone verification is inserted between the existing "permissions" step and the app navigating to the Radar screen. The `OnboardingScreen` gains a `phone` step after `permissions`:

```
intro → name → vibes → mode → permissions → phone → [navigate to Radar]
```

Existing M1 users (already onboarded, no phone on record) are prompted to add a phone on next launch via a dismissible banner on the Radar screen. They can dismiss up to 3 times; on the fourth it becomes a hard gate. This prevents breaking the existing M1 lab test devices while still driving M2 account adoption.

## Alternatives considered

**Email + magic link** — higher friction on mobile (user must switch to email app, find the link, tap back). Phone OTP stays entirely within the Alon app. Rejected.

**Skip user accounts in M2, extend device identity** — mutual reveals require match persistence across reinstalls. Device identity cannot survive a factory reset or phone replacement. Rejected: the M2 product spec requires this.

**Apple Sign In + Google** — App Store requires Apple Sign In if *any* other social login is offered. This adds an Apple developer account requirement and an OAuth implementation for two providers before the app is on the store. Overhead is not justified for a controlled beta. Rejected for M2; can be added alongside App Store submission in M3.

**Passkeys** — requires the user to have passkey infrastructure configured (iCloud Keychain, Google Password Manager). Cannot be assumed for a beta audience on day one. Rejected for M2.

## Consequences

- New dependency: `twilio` npm package in the backend, or raw `fetch` calls to the Twilio Verify REST API. Prefer the Twilio helper library for correct error handling and retry semantics.
- Two new backend environment variables: `TWILIO_ACCOUNT_SID`, `TWILIO_VERIFY_SERVICE_SID`. These must be provisioned before M2 launch and stored in Railway's secret management.
- The `OnboardingScreen` gains a phone input step. Phone number must be validated client-side (E.164 format) before the OTP request is sent.
- M1 lab test devices are unaffected — they have no phone on record. The hard-gate prompt appears after 3 dismissals, which will not be reached during the M1 test.
- `authDevice` is not removed. It remains the path for device registration and proximity token rotation. `authUser` is additive.
- Phone numbers are PII. They must be treated with care: not logged in plaintext, not included in audit log payloads, encrypted at rest in Postgres (via Postgres `pgcrypto` or application-level encryption) before public launch.
