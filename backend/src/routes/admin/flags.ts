import { Router, Request, Response } from 'express';
import { pool } from '../../db';
import { authAdmin } from '../../middleware/authAdmin';
import { requireRole, AdminRole } from '../../middleware/rbac';
import { withAudit, AuditAction, extractAuditContext } from '../../audit';

export const flagsRouter = Router();

flagsRouter.use(authAdmin);
flagsRouter.use(requireRole([AdminRole.SUPER_ADMIN, AdminRole.OPS]));

// GET /api/v1/admin/flags
flagsRouter.get('/', async (req: Request, res: Response) => {
  const { page = 1, limit = 50, status, severity, type } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  try {
    let queryStr = `
      SELECT id, severity, type, subject_id, subject_type, report_count, 
             summary, auto_flagged, status, created_at 
      FROM app.flags
      WHERE 1=1
    `;
    const queryParams: any[] = [];
    let paramIdx = 1;

    if (status && status !== 'All') { queryStr += ` AND status = $${paramIdx++}`; queryParams.push(status); }
    if (severity && severity !== 'All') { queryStr += ` AND severity = $${paramIdx++}`; queryParams.push(severity); }
    if (type && type !== 'All') { queryStr += ` AND type = $${paramIdx++}`; queryParams.push(type); }

    queryStr += ` ORDER BY created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
    queryParams.push(limit, offset);

    const result = await pool.query(queryStr, queryParams);
    
    let countStr = 'SELECT COUNT(*) FROM app.flags WHERE 1=1';
    const countParams: any[] = [];
    let countIdx = 1;
    if (status && status !== 'All') { countStr += ` AND status = $${countIdx++}`; countParams.push(status); }
    if (severity && severity !== 'All') { countStr += ` AND severity = $${countIdx++}`; countParams.push(severity); }
    if (type && type !== 'All') { countStr += ` AND type = $${countIdx++}`; countParams.push(type); }
    
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

// POST /api/v1/admin/flags/:id/dismiss
flagsRouter.post('/:id/dismiss', async (req: Request, res: Response) => {
  const { id } = req.params;
  const auditContext = extractAuditContext(req);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(`
      UPDATE app.flags 
      SET status = 'Resolved', resolution_action = 'dismissed', resolved_at = NOW(), resolved_by = $1, updated_at = NOW()
      WHERE id = $2 AND status = 'Open' RETURNING *
    `, [auditContext.adminId, id]);

    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Flag not found or already resolved' });
    }

    await withAudit(client, auditContext, AuditAction.FLAG_DISMISS, id, { status: 'Open' }, { status: 'Resolved', resolution_action: 'dismissed' });

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// POST /api/v1/admin/flags/:id/in-review
flagsRouter.post('/:id/in-review', async (req: Request, res: Response) => {
  const { id } = req.params;
  const auditContext = extractAuditContext(req);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(`
      UPDATE app.flags 
      SET status = 'In Review', assigned_to = $1, updated_at = NOW()
      WHERE id = $2 AND status = 'Open' RETURNING *
    `, [auditContext.adminId, id]);

    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Flag not found or not Open' });
    }

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// POST /api/v1/admin/flags/:id/escalate
flagsRouter.post('/:id/escalate', async (req: Request, res: Response) => {
  const { id } = req.params;
  const auditContext = extractAuditContext(req);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(`
      UPDATE app.flags 
      SET severity = 'High', resolution_action = 'escalated', updated_at = NOW()
      WHERE id = $1 RETURNING *
    `, [id]);

    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Flag not found' });
    }

    await withAudit(client, auditContext, AuditAction.FLAG_ESCALATE, id as string, {}, { severity: 'High', resolution_action: 'escalated' });

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// For actual moderation actions on the subject (e.g. suspend user based on flag),
// the UI hits the Users/Businesses/Promos endpoint, then hits this endpoint to resolve the flag.
flagsRouter.post('/:id/resolve', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { action_taken, notes } = req.body;
  const auditContext = extractAuditContext(req);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(`
      UPDATE app.flags 
      SET status = 'Resolved', resolution_action = $1, resolution_notes = $2, resolved_at = NOW(), resolved_by = $3, updated_at = NOW()
      WHERE id = $4 RETURNING *
    `, [action_taken, notes, auditContext.adminId, id]);

    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Flag not found' });
    }

    await withAudit(client, auditContext, AuditAction.FLAG_RESOLVE, id as string, { status: 'Open' }, { status: 'Resolved', resolution_action: action_taken });

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});
