import { Router, Request, Response } from 'express';
import { pool } from '../../db';
import { authAdmin } from '../../middleware/authAdmin';
import { requireRole, AdminRole } from '../../middleware/rbac';
import { withAudit, AuditAction, extractAuditContext } from '../../audit';
import { validate } from '../../middleware/validate';
import { UserActionSchema } from '../../schemas/admin';

export const usersRouter = Router();

// GET /api/v1/admin/users
usersRouter.get('/', authAdmin, requireRole([AdminRole.SUPER_ADMIN, AdminRole.OPS]), async (req: Request, res: Response) => {
  const { page = 1, limit = 50, search, status, plan, platform } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  try {
    let queryStr = `
      SELECT id, display_name, internal_token, current_mode, vibes, plan, status, platform, last_active_at, created_at 
      FROM app.users 
      WHERE 1=1
    `;
    const queryParams: any[] = [];
    let paramIdx = 1;

    if (search) {
      queryStr += ` AND (display_name ILIKE $${paramIdx} OR internal_token ILIKE $${paramIdx})`;
      queryParams.push(`%${search}%`);
      paramIdx++;
    }
    if (status && status !== 'All') { queryStr += ` AND status = $${paramIdx++}`; queryParams.push(status); }
    if (plan && plan !== 'All') { queryStr += ` AND plan = $${paramIdx++}`; queryParams.push(plan); }
    if (platform && platform !== 'All') { queryStr += ` AND platform = $${paramIdx++}`; queryParams.push(platform); }

    queryStr += ` ORDER BY created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
    queryParams.push(limit, offset);

    const result = await pool.query(queryStr, queryParams);

    let countStr = 'SELECT COUNT(*) FROM app.users WHERE 1=1';
    const countParams: any[] = [];
    let countIdx = 1;
    if (search) { countStr += ` AND (display_name ILIKE $${countIdx} OR internal_token ILIKE $${countIdx})`; countParams.push(`%${search}%`); countIdx++; }
    if (status && status !== 'All') { countStr += ` AND status = $${countIdx++}`; countParams.push(status); }
    if (plan && plan !== 'All') { countStr += ` AND plan = $${countIdx++}`; countParams.push(plan); }
    if (platform && platform !== 'All') { countStr += ` AND platform = $${countIdx++}`; countParams.push(platform); }

    const countResult = await pool.query(countStr, countParams);

    res.json({
      data: result.rows,
      meta: {
        total: parseInt(countResult.rows[0].count, 10),
        page: Number(page),
        limit: Number(limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/admin/users/:id/suspend
usersRouter.post('/:id/suspend', authAdmin, requireRole([AdminRole.SUPER_ADMIN, AdminRole.OPS]), validate(UserActionSchema), async (req: Request, res: Response) => {
  const { id } = req.params;

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

// POST /api/v1/admin/users/:id/ban
usersRouter.post('/:id/ban', authAdmin, requireRole([AdminRole.SUPER_ADMIN]), validate(UserActionSchema), async (req: Request, res: Response) => {
  const { id } = req.params;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query('UPDATE app.users SET status = $1 WHERE id = $2 RETURNING *', ['Banned', id]);
    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }

    const auditContext = extractAuditContext(req);
    await withAudit(client, auditContext, AuditAction.USER_BAN, id as string, { status: 'Active' }, { status: 'Banned' });

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// POST /api/v1/admin/users/:id/reinstate
usersRouter.post('/:id/reinstate', authAdmin, requireRole([AdminRole.SUPER_ADMIN, AdminRole.OPS]), async (req: Request, res: Response) => {
  const { id } = req.params;
  const auditContext = extractAuditContext(req);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const current = await client.query('SELECT status FROM app.users WHERE id = $1', [id]);
    if (current.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }

    if (current.rows[0].status === 'Active') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'User is already Active' });
    }

    const result = await client.query(
      'UPDATE app.users SET status = $1, suspended_until = NULL, updated_at = NOW() WHERE id = $2 RETURNING *',
      ['Active', id]
    );

    await withAudit(client, auditContext, AuditAction.USER_REINSTATE, id as string, { status: current.rows[0].status }, { status: 'Active' });

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});
