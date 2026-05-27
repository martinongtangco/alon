import { Router, Request, Response } from 'express';
import { pool } from '../../db';
import { authAdmin } from '../../middleware/authAdmin';
import { requireRole, AdminRole } from '../../middleware/rbac';
import { withAudit, AuditAction, extractAuditContext } from '../../audit';
import { validate } from '../../middleware/validate';
import { PlatformConfigUpdateSchema } from '../../schemas/admin';

export const configRouter = Router();

configRouter.use(authAdmin());
configRouter.use(requireRole([AdminRole.SUPER_ADMIN]));

// GET /api/v1/admin/config
configRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT key, value, tier, updated_at FROM admin.platform_config ORDER BY key ASC'
    );
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/v1/admin/config/:key
configRouter.put('/:key', validate(PlatformConfigUpdateSchema), async (req: Request, res: Response) => {
  const { key } = req.params;
  const { value } = req.body;
  const auditContext = extractAuditContext(req);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const current = await client.query(
      'SELECT value FROM admin.platform_config WHERE key = $1',
      [key]
    );
    if (current.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Config key not found' });
    }

    const result = await client.query(
      `UPDATE admin.platform_config
       SET value = $1, updated_at = NOW(), updated_by = $2
       WHERE key = $3
       RETURNING *`,
      [JSON.stringify(value), auditContext.adminId, key]
    );

    await withAudit(client, auditContext, AuditAction.CONFIG_UPDATE, key,
      { value: current.rows[0].value },
      { value }
    );

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});
