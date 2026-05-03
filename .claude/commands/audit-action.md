---
name: audit-action
description: Add a new AuditAction to vibr8.me and wire it through every layer it touches. Use when adding a new auditable admin operation — new moderation action, new config change type, new auth event, etc.
---

Takes the action name as an argument (e.g. `/audit-action PROMO_FEATURE`). Convention: `SUBJECT_VERB` in SCREAMING_SNAKE_CASE. If omitted, ask before proceeding.

## Process

1. Read `backend/src/audit/index.ts`. If the action already exists in `AuditAction`, stop and say so.

2. Validate the name matches `^[A-Z][A-Z_]+$`. Reject anything else.

3. Add the entry to the `AuditAction` enum, grouped by subject prefix (`USER_`, `BUSINESS_`, `PROMO_`, `FLAG_`, `EVENT_`, `CONFIG_`, `ADMIN_`), alphabetical within the group.

4. Add the value to the action type filter in `admin/src/pages/AuditLog.tsx` — same grouping, same order.

5. Print the migration SQL but do NOT apply it:

```sql
-- Include in your next migration file:
ALTER TABLE audit.entries
  DROP CONSTRAINT IF EXISTS audit_entries_action_type_check;

ALTER TABLE audit.entries
  ADD CONSTRAINT audit_entries_action_type_check
  CHECK (action_type IN (
    -- full list here, including the new value
  ));

-- If action_type is a Postgres enum type instead of a CHECK constraint:
-- ALTER TYPE audit_action_type ADD VALUE '<NEW_ACTION>';
```

6. List the two files changed and print the SQL. Tell the user: any route calling `withAudit()` with this action now has type-safe coverage.
