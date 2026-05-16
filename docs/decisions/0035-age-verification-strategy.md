# ADR 0033: Age Verification Strategy

Status: Accepted
Date: 2026-05-14
Milestone: M2 (required before public launch)
Depends on: [ADR 0030](0030-m2-user-account-model.md), [ADR 0008](0008-admin-auth-rbac.md)

## Context

The spec flags age verification as an open question:
> *Age verification and safety moderation strategy* — listed under Open Questions.

Alon's proximity-based social discovery features create a meaningful risk if minors use the product without appropriate safeguards. "Dating" mode is explicitly available in the Vibe setup, and physical proximity to strangers is the core mechanic. Most jurisdictions' digital safety regulations (EU DSA, UK Online Safety Act, US KOSA proposals) impose obligations on social apps to prevent minors from accessing adult-oriented features.

The question is: **what verification level is proportionate for M2 launch?**

Options:
1. **Self-declaration only** — user taps "I am 18+" during onboarding. Zero friction. Zero assurance.
2. **Date of birth entry** — user enters a birth date. Easy to lie. Minor friction. No assurance.
3. **ID document verification** — third-party service (Stripe Identity, Persona, Yoti) verifies a government ID. High assurance. High friction. Cost per verification.
4. **Phone-number-based inference** — SIM registration age in some markets infers adult status. Not universally applicable.

## Decision

**M2 ships with date of birth entry + self-declaration checkbox. Third-party ID verification is architected but feature-flagged off.**

### Rationale

Alon M2 is a controlled beta, not a public App Store release. The user base is known and curated. Requiring ID verification before the app is in the stores adds significant onboarding friction for a beta with no revenue to fund per-verification costs. Self-declaration with a birth date creates a legal paper trail ("user represented they were born on X date") and satisfies minimum app store requirements.

Third-party verification is implemented as a feature-flagged module so it can be activated before public launch without an architectural rework.

### M2 onboarding addition

The `OnboardingScreen` gains a `birthdate` step, inserted between `name` and `vibes`:

```
intro → name → birthdate → vibes → mode → permissions → phone → [navigate to Radar]
```

The step shows:
- A date picker (react-native-date-picker or platform date picker)
- A checkbox: "I confirm I am 18 years of age or older"
- Both must be satisfied to advance

The `advance()` function validates that the entered birth date is at least 18 years before today. If the calculated age is under 18, the user sees: *"Alon is for users 18 and older."* and cannot proceed.

### Schema addition

```sql
ALTER TABLE app.users
  ADD COLUMN date_of_birth DATE,
  ADD COLUMN age_verified   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN age_verified_at TIMESTAMPTZ;
```

`age_verified` is `false` for self-declaration. When third-party verification is activated (future), it is set to `true` on successful ID check.

### Feature flag: third-party ID verification

Environment variable `FEATURE_ID_VERIFICATION=true` activates Stripe Identity or Persona verification in place of the self-declaration checkbox. When active:

1. After phone OTP verification, the app calls `POST /api/auth/verify-age` which creates a Stripe Identity verification session.
2. The app opens the Stripe Identity SDK (WebView or native SDK) for the document capture flow.
3. On completion, Stripe posts a webhook to `POST /api/webhooks/stripe-identity`. The handler updates `age_verified = true` and `age_verified_at = NOW()` for the user.
4. Unverified users who attempt to enter "Dating" mode are redirected to the verification flow.

The webhook endpoint and Stripe SDK integration are scaffolded in M2 (routes exist, types are defined) but inactive until the flag is set. This means the architecture is in place before the public launch deadline.

### Moderation admin tools

The admin dashboard (ADR 0008) gains a `Users` page field showing `age_verified` status. Admins can manually override age verification for test accounts. A flag of `status = 'Underage'` is added to the `user_status` enum (alongside `Active`, `Suspended`, `Banned`) for cases where moderation identifies an underage user post-registration.

### Dating mode gate (client-side, M2)

In the `ProfileScreen`, the "Dating" mode option is gated: if the user's `age_verified` is `false` (self-declaration only) and they are attempting to set mode to `dating`, a modal informs them that Dating mode requires age verification. In M2, self-declaration satisfies this gate. When `FEATURE_ID_VERIFICATION` is active, it requires `age_verified = true`.

## Alternatives considered

**Self-declaration only (no birth date)** — provides no age signal at all and would not satisfy App Store review guidelines which require apps with dating features to gate against minors. Rejected.

**Third-party ID verification from day one (M2)** — Stripe Identity costs approximately $1.50 per verification. For a controlled beta of even 100 users this is $150 in verification costs before revenue. More importantly, it adds an SDK dependency and a Stripe webhook surface to the beta build. Deferred to public launch via feature flag.

**Phone-based age inference** — not universally applicable (varies by market). Cannot be relied upon. Rejected.

**No Dating mode in M2** — would sidestep the age gate question. Rejected: Dating mode is in the M1 mode selector and removing it for M2 is a product regression, not a safety measure. The gate is the correct solution.

## Consequences

- `OnboardingScreen` gains a `birthdate` step. A native date picker is needed — `react-native-date-picker` (`@react-native-community/datetimepicker`) is the standard choice for Expo bare workflow.
- `app.users` gains three new columns (migration required for M2 launch).
- The Stripe Identity integration is scaffolded but inactive. The webhook route exists (`routes/app/webhooks/stripe-identity.ts`) and returns `200 OK` in M2 without processing the payload.
- Minimum age is 18. This is hardcoded in both the client validation and the server-side registration handler. It is not configurable via `BUZZ_COOLDOWN`-style platform config — minimum age is a legal requirement, not a product tunable.
- Users who falsify their birth date to bypass the gate bear legal responsibility for the misrepresentation (established by the self-declaration checkbox and ToS acceptance). This does not absolve Alon of due diligence but satisfies the "reasonable measures" standard in most jurisdictions for M2 controlled beta scope.
