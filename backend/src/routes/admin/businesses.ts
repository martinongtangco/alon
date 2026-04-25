import { Router, Request, Response } from 'express';
import { pool } from '../../db';
import { authAdmin } from '../../middleware/authAdmin';
import { requireRole, AdminRole } from '../../middleware/rbac';
import { withAudit, AuditAction, extractAuditContext } from '../../audit';

export const businessesRouter = Router();

// Apply auth and RBAC to all business routes
businessesRouter.use(authAdmin);
businessesRouter.use(requireRole([AdminRole.SUPER_ADMIN, AdminRole.OPS]));

// GET /api/v1/admin/businesses
businessesRouter.get('/', async (req: Request, res: Response) => {
  const { page = 1, limit = 50, status, plan, search } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  try {
    let queryStr = `
      SELECT id, name, category, plan, status, contact_name, contact_email, 
             address_city, created_at, approved_at, suspended_at
      FROM app.businesses
      WHERE 1=1
    `;
    const queryParams: any[] = [];
    let paramIdx = 1;

    if (search) {
      queryStr += ` AND (name ILIKE $${paramIdx} OR address_city ILIKE $${paramIdx} OR contact_email ILIKE $${paramIdx})`;
      queryParams.push(`%${search}%`);
      paramIdx++;
    }
    
    if (status && status !== 'All') {
      queryStr += ` AND status = $${paramIdx++}`;
      queryParams.push(status);
    }
    
    if (plan && plan !== 'All') {
      queryStr += ` AND plan = $${paramIdx++}`;
      queryParams.push(plan);
    }

    queryStr += ` ORDER BY created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
    queryParams.push(limit, offset);

    const result = await pool.query(queryStr, queryParams);
    
    let countStr = 'SELECT COUNT(*) FROM app.businesses WHERE 1=1';
    const countParams: any[] = [];
    let countIdx = 1;
    
    if (search) { countStr += ` AND (name ILIKE $${countIdx} OR address_city ILIKE $${countIdx} OR contact_email ILIKE $${countIdx})`; countParams.push(`%${search}%`); countIdx++; }
    if (status && status !== 'All') { countStr += ` AND status = $${countIdx++}`; countParams.push(status); }
    if (plan && plan !== 'All') { countStr += ` AND plan = $${countIdx++}`; countParams.push(plan); }
    
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

// POST /api/v1/admin/businesses/:id/approve
businessesRouter.post('/:id/approve', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { plan_override, admin_notes } = req.body;
  const auditContext = extractAuditContext(req);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get current state
    const current = await client.query('SELECT status, plan FROM app.businesses WHERE id = $1', [id]);
    if (current.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Business not found' });
    }
    
    if (current.rows[0].status !== 'Pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Can only approve Pending businesses' });
    }

    const newPlan = plan_override || current.rows[0].plan;

    const result = await client.query(`
      UPDATE app.businesses 
      SET status = 'Active', plan = $1, admin_notes = $2, approved_at = NOW(), approved_by = $3, updated_at = NOW()
      WHERE id = $4 RETURNING *
    `, [newPlan, admin_notes || null, auditContext.adminId, id]);

    await withAudit(client, auditContext, AuditAction.BUSINESS_APPROVE, id, 
      { status: 'Pending', plan: current.rows[0].plan }, 
      { status: 'Active', plan: newPlan, admin_notes }
    );

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// POST /api/v1/admin/businesses/:id/reject
businessesRouter.post('/:id/reject', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { rejection_reason } = req.body;
  const auditContext = extractAuditContext(req);

  if (!rejection_reason) {
    return res.status(400).json({ error: 'Rejection reason is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(`
      UPDATE app.businesses 
      SET status = 'Cancelled', rejection_reason = $1, rejected_at = NOW(), updated_at = NOW()
      WHERE id = $2 RETURNING *
    `, [rejection_reason, id]);

    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Business not found' });
    }

    await withAudit(client, auditContext, AuditAction.BUSINESS_REJECT, id, { status: 'Pending' }, { status: 'Cancelled', rejection_reason });

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// POST /api/v1/admin/businesses/:id/suspend
businessesRouter.post('/:id/suspend', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { suspension_reason, confirmation } = req.body;
  const auditContext = extractAuditContext(req);

  if (confirmation !== true) return res.status(400).json({ error: 'Confirmation required for destructive action' });
  if (!suspension_reason) return res.status(400).json({ error: 'Suspension reason is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(`
      UPDATE app.businesses 
      SET status = 'Suspended', suspension_reason = $1, suspended_at = NOW(), updated_at = NOW()
      WHERE id = $2 AND status = 'Active' RETURNING *
    `, [suspension_reason, id]);

    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Business not found or not active' });
    }

    // Spec: "immediately deactivates all promos and events"
    await client.query('UPDATE app.promos SET status = \'Paused\' WHERE business_id = $1 AND status = \'Active\'', [id]);
    await client.query('UPDATE app.events SET status = \'Rejected\' WHERE business_id = $1 AND status IN (\'Live\', \'Scheduled\')', [id]);

    await withAudit(client, auditContext, AuditAction.BUSINESS_SUSPEND, id, { status: 'Active' }, { status: 'Suspended', suspension_reason });

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// POST /api/v1/admin/businesses/:id/reinstate
businessesRouter.post('/:id/reinstate', async (req: Request, res: Response) => {
  const { id } = req.params;
  const auditContext = extractAuditContext(req);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const current = await client.query('SELECT status FROM app.businesses WHERE id = $1', [id]);
    if (current.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Business not found' });
    }

    if (current.rows[0].status === 'Active') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Business is already Active' });
    }

    const result = await client.query(`
      UPDATE app.businesses 
      SET status = 'Active', suspended_at = NULL, suspension_reason = NULL, updated_at = NOW()
      WHERE id = $1 RETURNING *
    `, [id]);

    await withAudit(client, auditContext, AuditAction.BUSINESS_REINSTATE, id, { status: current.rows[0].status }, { status: 'Active' });

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});
