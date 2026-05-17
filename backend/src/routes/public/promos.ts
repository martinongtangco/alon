import { Router, Request, Response } from 'express';
import { pool } from '../../db';
import { uuidToBearingDeg } from '../../utils/bearing';

export const promosRouter = Router();

// GET /api/promos — ADR 0034: returns all active promos (no location filter in M2)
promosRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT p.id, p.headline, p.description, p.offer_text,
              p.broadcast_radius AS radius_m,
              p.starts_at, p.expires_at,
              b.name AS business_name
       FROM app.promos p
       JOIN app.businesses b ON p.business_id = b.id
       WHERE p.status = 'Active'
       ORDER BY p.starts_at DESC`
    );

    const data = result.rows.map((row) => ({
      id:             row.id,
      businessName:   row.business_name,
      label:          row.headline,
      detail:         row.description ?? '',
      offer_text:     row.offer_text ?? '',
      radiusMeters:   row.radius_m,
      startsAt:       row.starts_at,
      expiresAt:      row.expires_at,
      bearingDeg:     uuidToBearingDeg(row.id),
      distanceMeters: 100,
    }));

    res.json({ data });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});