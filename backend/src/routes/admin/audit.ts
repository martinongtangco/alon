import { Router, Request, Response } from 'express';
import { pool } from '../../db';
import { authAdmin } from '../../middleware/authAdmin';
import { requireRole, AdminRole } from '../../middleware/rbac';
import { parsePagination } from '../../utils/pagination';

export const auditRouter = Router();

auditRouter.use(authAdmin());
auditRouter.use(requireRole([AdminRole.SUPER_ADMIN]));

// GET /api/v1/admin/audit
auditRouter.get('/', async (req: Request, res: Response) => {
  const { action_type } = req.query;
  const { limit, offset, page } = parsePagination(req.query);

  try {
    let queryStr = `
      SELECT id, admin_id, admin_role, action_type, subject_id, before_state, after_state, ip_address, created_at
      FROM audit.entries
      WHERE 1=1
    `;
    const queryParams: any[] = [];
    let paramIdx = 1;

    if (action_type && action_type !== 'All') {
      queryStr += ` AND action_type = $${paramIdx++}`;
      queryParams.push(action_type);
    }

    queryStr += ` ORDER BY created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
    queryParams.push(limit, offset);

    const result = await pool.query(queryStr, queryParams);

    let countStr = 'SELECT COUNT(*) FROM audit.entries WHERE 1=1';
    const countParams: any[] = [];
    if (action_type && action_type !== 'All') {
      countStr += ' AND action_type = $1';
      countParams.push(action_type);
    }
    const countResult = await pool.query(countStr, countParams);

    res.json({
      data: result.rows,
      meta: {
        total: parseInt(countResult.rows[0].count, 10),
        page,
        limit,
      },
    });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});
