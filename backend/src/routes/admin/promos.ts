import { Router, Request, Response } from 'express';
import { pool } from '../../db';
import { authAdmin } from '../../middleware/authAdmin';
import { requireRole, AdminRole } from '../../middleware/rbac';
import { withAudit, AuditAction, extractAuditContext } from '../../audit';

export const promosRouter = Router();

promosRouter.use(authAdmin);
promosRouter.use(requireRole([AdminRole.SUPER_ADMIN, AdminRole.OPS]));

// GET /api/v1/admin/promos
promosRouter.get('/', async (req: Request, res: Response) => {
  const { page = 1, limit = 50, status, search } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  try {
    let queryStr = `
      SELECT p.id, p.headline, p.broadcast_radius, p.redemption_count, p.redemption_limit, 
             p.status, p.created_at, b.name as business_name
      FROM app.promos p
      JOIN app.businesses b ON p.business_id = b.id
      WHERE 1=1
    `;
    const queryParams: any[] = [];
    let paramIdx = 1;

    if (search) {
      queryStr += ` AND (p.headline ILIKE $${paramIdx} OR b.name ILIKE $${paramIdx})`;
      queryParams.push(`%${search}%`);
      paramIdx++;
    }

    if (status && status !== 'All') {
      queryStr += ` AND p.status = $${paramIdx++}`;
      queryParams.push(status);
    }

    queryStr += ` ORDER BY p.created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
    queryParams.push(limit, offset);

    const result = await pool.query(queryStr, queryParams);
    
    let countStr = 'SELECT COUNT(*) FROM app.promos p JOIN app.businesses b ON p.business_id = b.id WHERE 1=1';
    const countParams: any[] = [];
    let countIdx = 1;
    
    if (search) { countStr += ` AND (p.headline ILIKE $${countIdx} OR b.name ILIKE $${countIdx})`; countParams.push(`%${search}%`); countIdx++; }
    if (status && status !== 'All') { countStr += ` AND p.status = $${countIdx++}`; countParams.push(status); }
    
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

// POST /api/v1/admin/promos/:id/pause
promosRouter.post('/:id/pause', async (req: Request, res: Response) => {
  const { id } = req.params;
  const auditContext = extractAuditContext(req);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(`
      UPDATE app.promos 
      SET status = 'Paused', paused_at = NOW(), paused_by = $1, updated_at = NOW()
      WHERE id = $2 AND status = 'Active' RETURNING *
    `, [auditContext.adminId, id]);

    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Promo not found or not active' });
    }

    await withAudit(client, auditContext, AuditAction.PROMO_PAUSE, id, { status: 'Active' }, { status: 'Paused' });

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// POST /api/v1/admin/promos/:id/kill
promosRouter.post('/:id/kill', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { kill_reason, confirmation } = req.body;
  const auditContext = extractAuditContext(req);

  if (confirmation !== true) return res.status(400).json({ error: 'Confirmation required for destructive action' });
  if (!kill_reason) return res.status(400).json({ error: 'Kill reason is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(`
      UPDATE app.promos 
      SET status = 'Killed', kill_reason = $1, killed_at = NOW(), killed_by = $2, updated_at = NOW()
      WHERE id = $3 RETURNING *
    `, [kill_reason, auditContext.adminId, id]);

    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Promo not found' });
    }

    await withAudit(client, auditContext, AuditAction.PROMO_KILL, id, {}, { status: 'Killed', kill_reason });

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});
