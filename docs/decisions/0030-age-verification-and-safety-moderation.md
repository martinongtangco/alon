# ADR 0030: Age Verification and Safety Moderation

Status: accepted

Alon facilitates physical proximity between strangers. Before a public launch the product needs a minimum viable safety layer: an age gate to exclude minors and a moderation pipeline for user reports. This ADR defines both.

## Decision

### Age verification

**Self-declaration gate at onboarding.** Users confirm they are 18+ by tapping "I am 18 or older" on a dedicated onboarding step before the display name step. No document upload, no third-party ID verification service.

The birth year is stored (`app.users.birth_year INT`) to enable server-side age checks in future (e.g., when revealing identity). For M2, enforcement is declaration-only. Document verification is M3+ (pre-launch gating decision).

The gate screen copy: *"Alon is for adults 18 and over."* followed by a single confirm button. No dark patterns, no pre-checked boxes.

Onboarding step order becomes: `intro → age → name → vibes → mode → permissions`.

### Safety moderation pipeline

**Flag → Review → Action**, using the existing `app.flags` table and admin Flags page (already built).

#### How users flag

A "Report" option is accessible from:
- The Radar screen (long-press a blob → "Report this person")
- The Matches screen (three-dot menu on a match → "Report")

Flags require a reason selection (tap one):
- `Harassment`
- `Inappropriate behaviour`
- `Underage concern`
- `Other`

No free-text field in M2 — keeps the pipeline simple and avoids storing PII-adjacent text.

#### Flag schema addition

```sql
ALTER TABLE app.flags ADD COLUMN reason TEXT
  CHECK (reason IN ('harassment', 'inappropriate', 'underage', 'other'));
```

#### Admin review

Flags appear in the existing admin Flags page. OPS role can dismiss or escalate. SUPER_ADMIN can ban. Response SLA target: 24 hours (operational, not enforced in code for M2).

Automated action: if a user accumulates 3 or more open flags from distinct reporters, their account is automatically suspended pending review. Implemented as a Postgres trigger or a check in the flag-creation route — the simpler route check is preferred for M2.

```ts
// In POST /api/flags route, after inserting the flag:
const { rows } = await client.query(
  `SELECT COUNT(DISTINCT reporter_id) FROM app.flags
   WHERE flagged_user_id = $1 AND status = 'open'`,
  [flaggedUserId]
);
if (parseInt(rows[0].count) >= 3) {
  await client.query(
    `UPDATE app.users SET status = 'Suspended' WHERE id = $1`,
    [flaggedUserId]
  );
}
```

#### What moderation cannot do in M2

- Cannot identify who sent a buzz (Buzz Me is anonymous by design — ADR 0012)
- Cannot retrieve GPS coordinates (never stored — ADR 0006 / privacy principle)
- Cannot read messages (no messages exist — core principle #1)

## Alternatives considered

**Third-party age verification (Persona, Stripe Identity)** — strong verification, reduces liability. Deferred to pre-launch M3+: adds friction that will hurt beta conversion, requires legal review of data handling, and is disproportionate for a closed beta.

**Free-text report field** — gives reviewers more context. Rejected for M2: stores unstructured user-generated text that may contain PII; structured reasons are sufficient for initial triage.

**Automated ML moderation** — flagged content reviewed by a classifier before reaching a human. Rejected for M2: no content to classify (no messages, no photos beyond profile). Revisit if photo moderation is needed post-M2.

## Consequences

- New onboarding step `age` added between `intro` and `name` in `app/src/screens/Onboarding/index.tsx`.
- `app.users` gains `birth_year INT` column.
- `app.flags` gains `reason TEXT` column with check constraint.
- Flag creation route gains the 3-reporter auto-suspend check.
- Radar screen long-press and Matches screen three-dot menu gain Report entry point.
- New app API endpoint: `POST /api/flags` (body: `{ flaggedToken: string, reason: string }`).
