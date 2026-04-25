# ADR 0010: App Schema Data Model
Status: Accepted
Date: 2026-04-25

## Context

The admin dashboard backend (Gemini, engineer role) was blocked on implementing REST endpoints for Users, Businesses, Promos, Events, and Flags because the `app` schema contained only stub tables with minimal columns. The engineer correctly escalated: the stub tables lacked the constraints, columns, and relationships needed to safely implement admin moderation actions. Inventing the data model inline would create cross-cutting decisions affecting the mobile app and Business Portal development later.

This ADR defines the authoritative `app` schema. The `admin` and `audit` schemas are defined in ADRs 0008 and 0009 respectively; this ADR extends and finalises them.

Spec source: `docs/spec/app-spec.md` and `docs/spec/admin-dashboard-spec.md §4–8`.

---

## Decision

### Schema structure

Three PostgreSQL schemas as established in ADR 0006:
- `app` — all mobile-app and partner-facing domain tables
- `admin` — admin user accounts and platform configuration
- `audit` — append-only audit entries (see ADR 0009)

### Primary key convention

All tables use `UUID PRIMARY KEY DEFAULT gen_random_uuid()`. No auto-increment integers. Rationale: UUIDs are safe to expose in API responses and URLs without leaking record count or creation order. PostgreSQL 16 includes `gen_random_uuid()` natively — no extension required.

### Timestamp convention

Every `TIMESTAMP` column uses `TIMESTAMP WITH TIME ZONE` (stored in UTC). No naive timestamps. Columns are always named `*_at`.

### CHECK constraints, not PostgreSQL ENUM types

Status fields, plan tiers, platform values, and similar categoricals use `VARCHAR + CHECK` rather than `CREATE TYPE ... AS ENUM`. Reason: `ALTER TYPE` to add a value requires a table lock in older PostgreSQL versions and is irreversible without a migration. CHECK constraints can be altered with `ALTER TABLE ... DROP CONSTRAINT / ADD CONSTRAINT` — no lock on the enum type itself. The trade-off is that CHECK violations are runtime errors rather than type errors — acceptable for v1.

### PostGIS for locations

`app.businesses.location` and `app.events.location` are `GEOMETRY(Point, 4326)` — WGS84 coordinates using PostGIS. This enables `ST_DWithin` geofence queries for promo radius enforcement and proximity feed construction. Text coordinates (e.g. `lat DECIMAL, lon DECIMAL`) were rejected because they cannot use spatial indexes and don't compose with PostGIS query operators.

Privacy guardrail: `app.users` has **no location column**. User positions are never stored in the app schema. Proximity matching uses ephemeral BLE tokens on the mobile side.

### JSONB for vibes tags

`app.users.vibes` and `app.events.vibe_tags` are stored as `JSONB NOT NULL DEFAULT '[]'`. A normalised junction table (`user_vibes`, `event_vibe_tags`) was rejected for v1: vibes are used for compatibility scoring, not for relational queries by the admin dashboard, and the tag vocabulary is not yet stable enough to warrant a lookup table.

### Ghost Mode as a separate boolean

`app.users.ghost_mode` is a `BOOLEAN`, separate from `app.users.status`. `status` captures moderation state: `Active | Flagged | Suspended | Banned`. Ghost Mode is a user preference (visible-to-others toggle) — it is orthogonal to moderation state. A user can be Active + ghost_mode=true simultaneously.

The admin dashboard UI computes the display label — showing "Ghost" when `status = 'Active' AND ghost_mode = true`. This is not stored as a distinct status value.

### Polymorphic flags via discriminator

`app.flags` uses a `(subject_type, subject_id)` discriminator pair rather than separate flag tables per subject type or PostgreSQL foreign-key polymorphism patterns. Reason: for v1, the four subject types (user / business / promo / event) are handled uniformly by the moderation queue — the same review flow, same actions, same audit trail. The trade-off is that `subject_id` cannot be a typed FK — the application must validate referential integrity at the service layer.

### Event organizer via dual nullable FKs

`app.events` has two nullable organizer columns — `business_id` and `community_submitter_id` — rather than a single polymorphic FK or a separate `organizer` join table. A `CHECK` constraint enforces exactly one is non-null. This is clean, query-friendly, and avoids the complexity of polymorphic FKs in PostgreSQL. The `is_community` boolean is a denormalized shortcut for admin list queries that filter by community vs partner events.

### No computed/derived columns

The stub schema stored `active_promo_count` and `mrr_contribution` as columns on `app.businesses`. These are derived values that go stale on every promo status change. They are removed from the schema — the admin API computes them via aggregation queries at read time. For v1 query volumes, this is not a performance concern.

### Buzz rate limiting via event log

`app.buzz_events` is a lightweight log table rather than a daily counter column on `app.users`. Rate-limit enforcement (`max 3 buzzes per person per day` — spec §4) is implemented by querying `COUNT(*) WHERE sender_id = $1 AND sent_at > NOW() - INTERVAL '24 hours'`. A daily counter column was rejected: it requires a scheduled reset job and loses historical data needed for fraud detection.

### Internal token on users

`app.users.internal_token` is a distinct random identifier used by the BLE broadcast layer. Mobile devices advertise this token rather than the user's UUID or any PII. It is a `VARCHAR(255) UNIQUE NOT NULL DEFAULT gen_random_uuid()::text` — seeded from the UUID generator at row creation; can be rotated by the mobile app layer without changing the user's primary key.

### Platform config seeded with defaults

`admin.platform_config` is populated with default values from `admin-dashboard-spec.md §11` on first run using `INSERT ... ON CONFLICT (key) DO NOTHING`. This makes the migration idempotent and ensures the platform starts with known-good defaults without requiring a separate seed step.

A `tier` column (`hot / warm / cold`) is added to document how quickly each config value takes effect — aligns with the resolved open question in `admin-dashboard-spec.md §Open Questions #5`.

---

## Alternatives considered

**PostgreSQL ENUM types for status fields** — Rejected. `ALTER TYPE ... ADD VALUE` requires PostgreSQL to lock the type and is non-transactional on some versions. CHECK constraints are more easily altered during rapid dev iteration.

**Separate `user_vibes` junction table** — Rejected for v1. The vibe vocabulary is still being defined. JSONB is sufficient for the matching and admin display queries needed at launch. If faceted search on vibes becomes a requirement, migrate to a normalised table.

**`lat DECIMAL + lon DECIMAL` for business/event locations** — Rejected. PostGIS GEOMETRY enables spatial indexing (GIST) and composable distance queries; separate decimal columns do not. Since PostGIS is already installed (ADR 0006), the extension cost is zero.

**Storing `active_promo_count` / `mrr_contribution` as columns** — Rejected. Derived columns require application-level cache invalidation on every write path. SQL aggregation is simpler and correct by construction.

---

## Consequences

- The admin endpoints for Users, Businesses, Promos, Events, and Flags can now be implemented against a stable schema.
- Mobile app auth (user `password_hash`, session management) is in scope of the `app.users` table — the mobile auth API must be built respecting this schema.
- `app.users` has no location column — proximity matching must operate exclusively via BLE tokens and ephemeral server-side state. Any proposal to persist user coordinates must revisit this ADR.
- `internal_token` rotation strategy (how/when the mobile app rotates BLE tokens) is a remaining open decision — tracked in `docs/decisions/README.md`.
- The stub `db-setup.sql` tables are replaced in full. Gemini must drop and recreate the `app` schema tables when applying this migration in dev.
