# ADR 0006: Primary Database Selection

Status: Accepted
Date: 2026-04-25
Closes: deferral in [ADR 0003](0003-backend-framework.md)

## Context

[ADR 0003](0003-backend-framework.md) chose Node.js + Express but explicitly deferred the database choice: *"Should use PostgreSQL or MongoDB for data storage (to be decided)."* The admin dashboard work cannot proceed without that resolved — every page in [docs/spec/admin-dashboard-spec.md](../spec/admin-dashboard-spec.md) is a relational view (users joined to flags, businesses joined to promos and transactions, etc.).

Workload characteristics across the platform:

| Use case | Source | Shape |
|---|---|---|
| User profiles + Vibes | Mobile spec | Relational, indexed by user_id |
| Vibe matching | Mobile spec | Compatibility scores, set-intersection style |
| Geo-queries for matching + geofencing | [ADR 0003](0003-backend-framework.md), mobile spec | Spatial indexing required |
| Anonymized proximity tokens (rotating) | Mobile spec, architect.md §4 | Time-bounded, append-only-ish |
| Promo CMS | Mobile + admin specs | Relational; partner → promo → redemption |
| Event ingestion | Mobile + admin specs | Relational with moderation state |
| Admin dashboard tables (Users, Flags, Businesses, Promos, Events, Revenue) | Admin spec §4–9 | Heavy filter + sort + pagination + join |
| Real-time stats (Live Activity) | Admin spec §3 | Aggregate queries on recent windows |
| Audit log | Admin spec §Audit Log Requirements | Append-only, separate from main DB ([ADR 0009](0009-audit-log-architecture.md)) |
| System logs | Admin spec §10 | Append-only, queryable by level + time |

The [admin-dashboard-recommendations.md](../../ImplementationPlanMd/admin-dashboard-recommendations.md) proposed MongoDB. That choice was made without analysis against the geo-query and relational requirements that originally drove ADR 0003 to defer.

## Decision

**PostgreSQL 16 with the PostGIS extension** as the primary application database.

Single logical database, multiple schemas:
- `app` — user profiles, Vibes, matches, proximity tokens, promos, events, transactions
- `admin` — admin user accounts, sessions, role assignments
- `audit` — append-only audit log (separate role/connection per [ADR 0009](0009-audit-log-architecture.md))

Spatial indexing via PostGIS for geofencing and proximity-token geo-bucketing. No raw GPS coordinates persisted (per CLAUDE.md core principle 5 and [docs/agents/engineer.md](../agents/engineer.md) hard rule 5) — geometry columns store coarsened geocell IDs, not user-level coordinates.

## Alternatives considered

1. **MongoDB** (proposed in implementation recommendations) — viable for unstructured documents, but the admin dashboard is heavily relational. Cross-collection joins (users + flags + businesses + transactions) become application-layer joins, defeating the database. MongoDB's geo support exists but PostGIS is more mature and integrates with the relational query planner. Rejected.
2. **PostgreSQL without PostGIS, geocell IDs only** — would work for promo geofences (we already coarsen coordinates), but loses radius-search efficiency for the matching engine. PostGIS is a single extension, not a separate system.
3. **Hybrid: Postgres for relational + Redis for hot-path proximity tokens** — Redis is not selected as primary, but reserved as a future caching layer if proximity-token verification latency becomes a problem. Not part of v1.
4. **DynamoDB / Firestore** — managed-service convenience at the cost of query expressiveness. Admin dashboard tables would require denormalization into multiple secondary indexes, multiplying storage and write costs. Rejected.
5. **Separate stores per workload** — premature. One Postgres cluster with read replicas covers all v1 needs. Splitting can come later via dedicated ADRs.

## Consequences

- Engineering team needs PostgreSQL + PostGIS familiarity. Both are mainstream; this is not exotic.
- Migrations need a tool. Recommendation: `node-pg-migrate` or Prisma. Final migration tool selection deferred to engineer's discretion within the Node ecosystem; not architectural.
- Backup/restore is well-trodden ground (managed Postgres on AWS RDS, GCP Cloud SQL, or Supabase). No bespoke ops.
- Real-time aggregate queries for Live Activity (admin spec §3) need to be efficient. We will use materialized views refreshed on a 5-second cadence for the dashboard's metric cards rather than recomputing on every request.
- Audit log lives in the same Postgres instance but a separate schema with a separate role — see [ADR 0009](0009-audit-log-architecture.md).
- No raw GPS columns. Geometry columns hold geocell-level coordinates only. This is enforced by code review; there is no schema-level guard against an engineer adding a `point` column with raw coordinates. Privacy review must catch this.

## Implementation notes

- Use `pg` (node-postgres) as the driver. Optional ORM: Prisma if the team wants type-safe queries; otherwise hand-rolled SQL with a query helper. ORM choice is engineer discretion.
- Connection pooling via PgBouncer in production. Local dev can use direct connections.
- All admin write paths run inside a transaction that includes the audit log insert. If the audit insert fails, the transaction rolls back. See [ADR 0009](0009-audit-log-architecture.md).
- Time columns are `timestamptz`, always UTC. Display-time conversion happens in the browser.
- `pgcrypto` extension enabled for password hashing helpers and UUID generation.
