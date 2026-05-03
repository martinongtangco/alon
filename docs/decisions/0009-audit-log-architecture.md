# ADR 0009: Audit Log Architecture

Status: Accepted
Date: 2026-04-25

## Context

[docs/spec/admin-dashboard-spec.md](../spec/admin-dashboard-spec.md) §Audit Log Requirements (lines 389–399) mandates:

- **Every state-changing admin action** must be logged
- Required fields per entry: admin user ID + role, timestamp (UTC), action type, subject (user/business/promo/event ID), before → after state, admin session IP address
- Logs are **retained for a minimum of 12 months**
- Audit log is **append-only** — no admin can delete or modify entries (line 398)
- **All admin actions logged**, including PII access (spec line 144) and all Platform Config changes with before/after diff (line 362)

Spec open question resolved (see [admin-dashboard-spec.md](../spec/admin-dashboard-spec.md) §Open Questions): The audit log **is** accessible within the dashboard UI — read-only, restricted to Super Admin — in addition to being mirrored to a log aggregator for long-term archival and incident search.

[ADR 0006](0006-primary-database-selection.md) established PostgreSQL as the primary database and specified that the audit schema uses a separate DB role. This ADR defines the full architecture.

## Decision

**Append-only PostgreSQL table in a dedicated `audit` schema, with a write-only application role, monthly range partitioning for retention management, in-dashboard read-only view for Super Admin, and async mirroring to a structured log aggregator.**

### Schema

```sql
CREATE SCHEMA audit;

CREATE TABLE audit.entries (
  id             BIGSERIAL,
  ts             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  admin_id       UUID        NOT NULL,
  admin_role     TEXT        NOT NULL,  -- 'SUPER_ADMIN' | 'OPS' | 'FINANCE'
  ip_address     INET        NOT NULL,
  action_type    TEXT        NOT NULL,  -- see action type registry below
  subject_type   TEXT,                  -- 'user' | 'business' | 'promo' | 'event' | 'config' | 'admin_user'
  subject_id     TEXT,
  before_state   JSONB,
  after_state    JSONB,
  metadata       JSONB                  -- extra context (reason text, search query on PII access, etc.)
) PARTITION BY RANGE (ts);

-- Monthly partitions created by a scheduled job or at deploy time for rolling 14 months
-- e.g. audit.entries_2026_04, audit.entries_2026_05, ...
```

No `UPDATE` or `DELETE` privileges granted to the application role on `audit.entries`. Insert-only.

### Database roles

```
audit_writer  — INSERT on audit.entries (used by backend application)
audit_reader  — SELECT on audit.entries (used only by Super Admin queries via dedicated query handler)
```

The main application DB role (`app_rw`) does NOT have access to the audit schema. Only `audit_writer` and `audit_reader` exist. Credential separation makes it impossible for a bug in a non-audit code path to corrupt audit entries.

### Write path

Every admin route that mutates state wraps its DB transaction with an audit entry in the same transaction:

```
BEGIN;
  UPDATE app.users SET status = 'banned' WHERE id = $1;
  INSERT INTO audit.entries (...) VALUES (...);
COMMIT;
```

If the audit insert fails, the transaction rolls back. This is not optional — the audit write is transactionally coupled to the mutation. Implemented as a shared `withAudit(tx, entry, fn)` helper that all mutating admin handlers must use. Handlers that skip `withAudit` fail code review.

**`withAudit` TypeScript signature** (`backend/src/audit/index.ts`):

```ts
import { PoolClient } from 'pg';

export interface AuditEntry {
  adminId: string;
  adminRole: 'SUPER_ADMIN' | 'OPS' | 'FINANCE';
  ipAddress: string;
  actionType: AuditAction;          // from AuditAction enum — see registry below
  subjectType?: 'user' | 'business' | 'promo' | 'event' | 'config' | 'admin_user';
  subjectId?: string;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export async function withAudit(
  tx: PoolClient,
  entry: AuditEntry,
  fn: (tx: PoolClient) => Promise<void>
): Promise<void> {
  await fn(tx);
  await tx.query(
    `INSERT INTO audit.entries
       (admin_id, admin_role, ip_address, action_type,
        subject_type, subject_id, before_state, after_state, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [entry.adminId, entry.adminRole, entry.ipAddress, entry.actionType,
     entry.subjectType ?? null, entry.subjectId ?? null,
     entry.beforeState ? JSON.stringify(entry.beforeState) : null,
     entry.afterState  ? JSON.stringify(entry.afterState)  : null,
     entry.metadata    ? JSON.stringify(entry.metadata)    : null]
  );
}

// For read-only PII access (no transaction):
export async function logPiiAccess(
  auditWriter: PoolClient,
  entry: AuditEntry
): Promise<void> {
  await auditWriter.query(/* same INSERT */);
}
```

Read-only PII access (e.g. admin views a user profile, admin searches by email) is logged outside a transaction — a best-effort `INSERT` via `audit_writer`. These are not transactional because there is no accompanying mutation to roll back, but they are still mandatory and must not be swallowed on error.

### Retention

Monthly range partitions. A scheduled job drops partitions older than 13 months (retaining 12 full calendar months plus the current in-progress month as a buffer). Partition drop requires a privileged maintenance role — not available to the application role or audit_writer.

### In-dashboard access

A read-only Audit Log page, restricted to Super Admin role ([ADR 0008](0008-admin-auth-rbac.md)). Not listed in the spec's navigation but required by spec lines 397–398 (audit entries must be accessible; they cannot be deleted). The page exposes:

- Filter by action type, admin ID, subject type/ID, date range
- Full before/after JSON diff for config changes
- Paginated results, newest-first
- CSV export of filtered results

This page is read-only. No admin can delete, edit, or hide entries from here.

### Async mirroring

Audit entries are forwarded asynchronously to a structured log aggregator (Datadog, Logtail, or equivalent — final choice is ops). A background worker tails new inserts via a Postgres `LISTEN/NOTIFY` trigger and ships them. Mirroring failure does not block the write path. The Postgres table is the authoritative source of truth; the aggregator is a secondary search surface for incident response.

### Action type registry

A defined set of string constants (TypeScript enum) so action_type values are consistent across the codebase:

```
AUTH_LOGIN_SUCCESS, AUTH_LOGIN_FAILURE, AUTH_TOTP_SUCCESS, AUTH_TOTP_FAILURE,
AUTH_LOGOUT, AUTH_REFRESH, ADMIN_ACCOUNT_CREATED, ADMIN_ACCOUNT_DEACTIVATED,
USER_VIEWED_PII, USER_SUSPENDED, USER_BANNED, USER_RATE_LIMITED, USER_FLAGS_CLEARED,
BUSINESS_APPROVED, BUSINESS_REJECTED, BUSINESS_SUSPENDED, BUSINESS_REINSTATED,
PROMO_PAUSED, PROMO_KILLED, PROMO_FLAGGED,
EVENT_APPROVED, EVENT_REJECTED, EVENT_FEATURED, EVENT_REMOVED,
FLAG_DISMISSED, FLAG_ESCALATED, FLAG_RESOLVED,
CONFIG_CHANGED,
PLATFORM_CONFIG_CHANGED  (with full before/after diff in before_state/after_state)
```

Additions to the registry require a code change and review — you cannot emit an undeclared action type.

## Alternatives considered

1. **Separate append-only database for audit** — adds an operational dependency for a low-traffic table. Rejected for v1. The partition + role-separation approach gives the same guarantees within one cluster.
2. **Log aggregator only (no DB table)** — log aggregators have configurable retention and can be misconfigured or have ingestion failures. The spec requires guaranteed, immutable, 12-month retention. A DB table with insert-only privileges is more controllable.
3. **Soft-delete (is_deleted flag)** — rejected. The spec says append-only, entries cannot be deleted or modified (line 398). A flag that can be set to `true` is a modification, even if the row isn't removed.
4. **Separate audit service** — over-engineered for v1. The pattern of in-transaction audit inserts doesn't require a separate service.
5. **Event sourcing / outbox pattern** — event sourcing would make the audit log a first-class citizen of all writes, but it requires a fundamentally different application architecture. Transactional coupling via `withAudit()` gives us 95% of the correctness guarantee with none of the architectural rewrite.

## Consequences

- Every mutating admin handler must use `withAudit()`. This is a convention, not a language-level constraint. Code review is the enforcement mechanism.
- Monthly partitions require a scheduled job to create future partitions and drop expired ones. This job needs to be part of the ops runbook and automated (cron or cloud scheduler).
- The before/after state for `CONFIG_CHANGED` entries can be large (full platform config JSON). `JSONB` handles this, but the audit log table will be larger than usual for config-heavy periods. Not a concern at v1 scale.
- Mirroring lag means the aggregator may be minutes behind the DB. For incident response, query the DB; the aggregator is for analytics and cross-system correlation.
- Audit log access via dashboard UI is Super Admin only. Ops staff cannot query audit entries directly — they see the effects of audit (suspensions, bans) in the subject records, not the raw log.
