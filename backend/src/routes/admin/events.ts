import { Router, Request, Response } from 'express';
import { pool } from '../../db';
import { authAdmin } from '../../middleware/authAdmin';
import { requireRole, AdminRole } from '../../middleware/rbac';
import { withAudit, AuditAction, extractAuditContext } from '../../audit';

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

// POST /api/v1/admin/events/:id/feature
eventsRouter.post('/:id/feature', async (req: Request, res: Response) => {
  const { id } = req.params;
  const auditContext = extractAuditContext(req);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(`
      UPDATE app.events 
      SET is_featured = true, updated_at = NOW()
      WHERE id = $1 AND status IN ('Scheduled', 'Live') RETURNING *
    `, [id]);

    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Event not found or cannot be featured' });
    }

    // No specific AuditAction mapped for feature, but we log it as a config change or generic
    await withAudit(client, auditContext, AuditAction.CONFIG_UPDATE, id, { is_featured: false }, { is_featured: true });

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});
