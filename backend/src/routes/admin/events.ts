import { Router, Request, Response } from 'express';
import { pool } from '../../db';
import { authAdmin } from '../../middleware/authAdmin';
import { requireRole, AdminRole } from '../../middleware/rbac';
import { withAudit, AuditAction, extractAuditContext } from '../../audit';
import { v4 as uuidv4 } from 'uuid';

export const eventsRouter = Router();

eventsRouter.use(authAdmin);
eventsRouter.use(requireRole([AdminRole.SUPER_ADMIN, AdminRole.OPS]));

// GET /api/v1/admin/events
eventsRouter.get('/', async (req: Request, res: Response) => {
  const { page = 1, limit = 50, status } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  try {
    let queryStr = `
      SELECT e.id, e.name, e.event_date, e.status, e.is_featured, e.vibe_tags,
             e.is_community, b.name as business_name, u.display_name as submitter_name
      FROM app.events e
      LEFT JOIN app.businesses b ON e.business_id = b.id
      LEFT JOIN app.users u ON e.community_submitter_id = u.id
      WHERE 1=1
    `;
    const queryParams: any[] = [];
    let paramIdx = 1;

    if (status && status !== 'All') {
      queryStr += ` AND e.status = $${paramIdx++}`;
      queryParams.push(status);
    }

    queryStr += ` ORDER BY e.event_date DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
    queryParams.push(limit, offset);

    const result = await pool.query(queryStr, queryParams);
    
    let countStr = 'SELECT COUNT(*) FROM app.events WHERE 1=1';
    const countParams: any[] = [];
    if (status && status !== 'All') { countStr += ` AND status = $1`; countParams.push(status); }
    
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

// POST /api/v1/admin/events (create)
eventsRouter.post('/', async (req: Request, res: Response) => {
  const {
    name,
    description,
    business_id,
    event_date,
    end_date,
    vibe_tags,
    estimated_reach,
    address_text,
    location,
    radius_m,
  } = req.body;
  const auditContext = extractAuditContext(req);

  if (!name || !event_date) {
    return res.status(400).json({ error: 'name and event_date are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const eventId = uuidv4();
    const result = await client.query(
      `INSERT INTO app.events (
        id, name, description, business_id, event_date, end_date,
        vibe_tags, estimated_reach, address_text, location, radius_m, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [
        eventId,
        name,
        description || null,
        business_id || null,
        new Date(event_date),
        end_date ? new Date(end_date) : null,
        vibe_tags || '[]',
        estimated_reach || null,
        address_text || null,
        location || null,
        radius_m || null,
        'Pending Review',
      ]
    );

    await withAudit(client, auditContext, AuditAction.EVENT_APPROVE, eventId, null, { status: 'Pending Review' });

    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// PUT /api/v1/admin/events/:id (update)
eventsRouter.put('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    name,
    description,
    business_id,
    event_date,
    end_date,
    vibe_tags,
    estimated_reach,
    address_text,
    location,
    radius_m,
    status,
  } = req.body;
  const auditContext = extractAuditContext(req);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const currentRes = await client.query('SELECT * FROM app.events WHERE id = $1', [id]);
    if (currentRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Event not found' });
    }

    const before = currentRes.rows[0];
    const updates: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    if (name !== undefined) { updates.push(`name = $${paramIdx++}`); values.push(name); }
    if (description !== undefined) { updates.push(`description = $${paramIdx++}`); values.push(description); }
    if (business_id !== undefined) { updates.push(`business_id = $${paramIdx++}`); values.push(business_id); }
    if (event_date !== undefined) { updates.push(`event_date = $${paramIdx++}`); values.push(new Date(event_date)); }
    if (end_date !== undefined) { updates.push(`end_date = $${paramIdx++}`); values.push(end_date ? new Date(end_date) : null); }
    if (vibe_tags !== undefined) { updates.push(`vibe_tags = $${paramIdx++}`); values.push(vibe_tags); }
    if (estimated_reach !== undefined) { updates.push(`estimated_reach = $${paramIdx++}`); values.push(estimated_reach); }
    if (address_text !== undefined) { updates.push(`address_text = $${paramIdx++}`); values.push(address_text); }
    if (location !== undefined) { updates.push(`location = $${paramIdx++}`); values.push(location); }
    if (radius_m !== undefined) { updates.push(`radius_m = $${paramIdx++}`); values.push(radius_m); }
    if (status !== undefined) { updates.push(`status = $${paramIdx++}`); values.push(status); }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await client.query(
      `UPDATE app.events SET ${updates.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
      values
    );

    await withAudit(client, auditContext, AuditAction.EVENT_APPROVE, id, before, result.rows[0]);

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// POST /api/v1/admin/events/:id/archive (archive = soft-delete, set status to 'Archived')
eventsRouter.post('/:id/archive', async (req: Request, res: Response) => {
  const { id } = req.params;
  const auditContext = extractAuditContext(req);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const currentRes = await client.query('SELECT * FROM app.events WHERE id = $1', [id]);
    if (currentRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Event not found' });
    }

    const before = currentRes.rows[0];
    const result = await client.query(
      `UPDATE app.events SET status = 'Archived', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );

    await withAudit(client, auditContext, AuditAction.EVENT_REJECT, id, before, { status: 'Archived' });

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// POST /api/v1/admin/events/:id/approve
eventsRouter.post('/:id/approve', async (req: Request, res: Response) => {
  const { id } = req.params;
  const auditContext = extractAuditContext(req);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const currentRes = await client.query(
      'SELECT status FROM app.events WHERE id = $1',
      [id]
    );
    if (currentRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Event not found' });
    }
    const currentStatus = currentRes.rows[0].status;
    if (currentStatus !== 'Pending Review') {
      await client.query('ROLLBACK');
      return res
        .status(400)
        .json({ error: 'Can only approve events with Pending Review status' });
    }

    const result = await client.query(
      `UPDATE app.events
       SET status = 'Scheduled', approved_at = NOW(), approved_by = $1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [auditContext.adminId, id]
    );

    await withAudit(
      client,
      auditContext,
      AuditAction.EVENT_APPROVE,
      id,
      { status: 'Pending Review' },
      { status: 'Scheduled' }
    );
    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// POST /api/v1/admin/events/:id/reject
eventsRouter.post('/:id/reject', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { rejection_reason } = req.body;
  if (!rejection_reason) {
    return res.status(400).json({ error: 'Rejection reason is required' });
  }

  const auditContext = extractAuditContext(req);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const currentRes = await client.query(
      'SELECT status FROM app.events WHERE id = $1',
      [id]
    );
    if (currentRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Event not found' });
    }

    const result = await client.query(
      `UPDATE app.events
       SET status = 'Rejected', rejection_reason = $1, rejected_at = NOW(), rejected_by = $2, updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [rejection_reason, auditContext.adminId, id]
    );

    await withAudit(
      client,
      auditContext,
      AuditAction.EVENT_REJECT,
      id,
      { status: 'Pending Review' },
      { status: 'Rejected', rejection_reason }
    );

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});


