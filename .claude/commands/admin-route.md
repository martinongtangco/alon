---
name: admin-route
description: Scaffold a new admin API resource for Alon with all required patterns pre-wired. Use when adding a new admin endpoint — moderation resource, reporting surface, config namespace, etc.
---

Takes the resource name as an argument (e.g. `/admin-route promos`). If omitted, ask before proceeding.

Derives: router variable (`promosRouter`), filename (`promos.ts`), URL prefix (`/promos`).
Default roles: `[AdminRole.SUPER_ADMIN, AdminRole.OPS]` — remind the user to verify against ADR 0008 §Role matrix.

## Phase 1 — Create the route file

Create `backend/src/routes/admin/<resource>.ts`:

```typescript
import { Router, Request, Response } from 'express';
import { pool } from '../../db';
import { authAdmin } from '../../middleware/authAdmin';
import { requireRole, AdminRole } from '../../middleware/rbac';
import { withAudit, AuditAction, extractAuditContext } from '../../audit';

export const <resource>Router = Router();

<resource>Router.use(authAdmin);
<resource>Router.use(requireRole([AdminRole.SUPER_ADMIN, AdminRole.OPS]));

// GET /api/v1/admin/<resource>
<resource>Router.get('/', async (req: Request, res: Response) => {
  const pageNum = Math.max(1, parseInt(req.query.page as string || '1', 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(req.query.limit as string || '50', 10)));
  const offset = (pageNum - 1) * limitNum;

  try {
    const [result, countResult] = await Promise.all([
      pool.query(
        `SELECT * FROM app.<resource> ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
        [limitNum, offset]
      ),
      pool.query(`SELECT COUNT(*) FROM app.<resource>`),
    ]);
    res.json({
      data: result.rows,
      meta: { total: parseInt(countResult.rows[0].count, 10), page: pageNum, limit: limitNum },
    });
  } catch {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
  }
});

// POST /api/v1/admin/<resource>/:id/<action>
<resource>Router.post('/:id/<action>', async (req: Request, res: Response) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const before = await client.query(`SELECT * FROM app.<resource> WHERE id = $1`, [id]);
    if (!before.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: '<Resource> not found' } });
    }

    // TODO: replace with real mutation
    const after = await client.query(
      `UPDATE app.<resource> SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      ['<new_status>', id]
    );

    await withAudit(
      client,
      extractAuditContext(req),
      AuditAction.<RESOURCE>_<ACTION>, // TODO: run /audit-action if this doesn't exist yet
      id,
      before.rows[0],
      after.rows[0]
    );

    await client.query('COMMIT');
    res.json({ data: after.rows[0] });
  } catch {
    await client.query('ROLLBACK');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
  } finally {
    client.release();
  }
});
```

## Phase 2 — Wire into the admin router

In `backend/src/routes/admin/index.ts`, add:

```typescript
import { <resource>Router } from './<resource>';
// ...
adminRouter.use('/<resource>', <resource>Router);
```

## Phase 3 — Report open TODOs

Tell the user exactly what still needs manual work:

- **DB table** — verify `app.<resource>` exists or write a migration
- **SELECT columns** — replace `SELECT *` with the columns the UI actually needs
- **Mutation SQL** — replace the placeholder UPDATE with the real state transition
- **AuditAction** — run `/audit-action <RESOURCE>_<ACTION>` if the enum value doesn't exist yet
- **Roles** — confirm `requireRole` array against ADR 0008 §Role matrix
- **Additional endpoints** — duplicate the POST block for each state transition
- **Input validation** — add Zod validation before `client.query('BEGIN')`

Do NOT fill in the TODOs.
