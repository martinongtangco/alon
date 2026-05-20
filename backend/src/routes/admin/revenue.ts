import { Router, Request, Response } from 'express';
import { pool } from '../../db';
import { authAdmin } from '../../middleware/authAdmin';
import { requireRole, AdminRole } from '../../middleware/rbac';

export const revenueRouter = Router();

revenueRouter.use(authAdmin());
revenueRouter.use(requireRole([AdminRole.SUPER_ADMIN, AdminRole.FINANCE]));

// GET /api/v1/admin/revenue
revenueRouter.get('/', async (req: Request, res: Response) => {
  try {
    // In a real app, this would query a transactions table.
    // For now, we estimate based on business plans to fulfill the dashboard requirement.
    const result = await pool.query(`
      SELECT 
        plan, 
        COUNT(*) as count,
        CASE 
          WHEN plan = 'Pro' THEN COUNT(*) * 49.99
          WHEN plan = 'Enterprise' THEN COUNT(*) * 199.99
          ELSE 0 
        END as estimated_mrr
      FROM app.businesses 
      WHERE status = 'Active'
      GROUP BY plan
    `);

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});
