import { Router, Request, Response } from 'express';
import { pool } from '../../db';
import { authAdmin } from '../../middleware/authAdmin';
import { requireRole, AdminRole } from '../../middleware/rbac';
import { withAudit, AuditAction, extractAuditContext } from '../../audit';

export const usersRouter = Router();

// GET /api/v1/admin/users
usersRouter.get('/', authAdmin, requireRole([AdminRole.SUPER_ADMIN, AdminRole.OPS]), async (req: Request, res: Response) => {
  const { page = 1, limit = 50 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  try {
    const result = await pool.query(
      `SELECT id, display_name, internal_token, current_mode, active_vibes, plan, status, platform, last_active_at, created_at 
       FROM app.users 
       ORDER BY created_at DESC 
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await pool.query('SELECT COUNT(*) FROM app.users');
    const totalCount = parseInt(countResult.rows[0].count, 10);

    res.json({
      data: result.rows,
      meta: {
        total: totalCount,
        page: Number(page),
        limit: Number(limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/admin/users/:id/suspend
usersRouter.post('/:id/suspend', authAdmin, requireRole([AdminRole.SUPER_ADMIN, AdminRole.OPS]), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { confirmation } = req.body; // Hard rule: Destructive actions require confirmation

  if (confirmation !== true) {
    return res.status(400).json({ error: 'Confirmation required for destructive action' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query('UPDATE app.users SET status = $1 WHERE id = $2 RETURNING *', ['Suspended', id]);
    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }

    const auditContext = extractAuditContext(req);
    await withAudit(client, auditContext, AuditAction.USER_SUSPEND, id as string, { status: 'Active' }, { status: 'Suspended' });

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});
