import { Router, Request, Response } from 'express';
import { pool } from '../../db';
import { authAdmin } from '../../middleware/authAdmin';

export const overviewRouter = Router();

overviewRouter.use(authAdmin());

// GET /api/v1/admin/overview
overviewRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT (
        SELECT COUNT(*) FROM app.users
      ) AS total_users,
      (
        SELECT COUNT(*) FROM app.businesses WHERE status = 'Active'
      ) AS active_businesses,
      (
        SELECT COUNT(*) FROM app.promos WHERE status = 'Active'
      ) AS active_promos,
      (
        SELECT COUNT(*) FROM app.flags WHERE status = 'Open'
      ) AS open_flags
    `);

    // Estimate MRR using the same logic as revenue.ts
    const mrrResult = await pool.query(`
      SELECT SUM(
        CASE
          WHEN plan = 'Pro' THEN 49.99
          WHEN plan = 'Enterprise' THEN 199.99
          ELSE 0
        END
      ) AS estimated_mrr
      FROM app.businesses
      WHERE status = 'Active'
    `);

    const overview = {
      ...result.rows[0],
      estimated_mrr: mrrResult.rows[0].estimated_mrr || 0,
    };

    res.json(overview);
  } catch (error) {
    console.error('Overview error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});