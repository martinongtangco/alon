import { Router, Request, Response } from 'express';
import { pool } from '../../db';
import { uuidToBearingDeg } from '../../utils/bearing';

export const eventsRouter = Router();

// GET /api/events — ADR 0034: returns all active events (no location filter in M2)
eventsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT e.id, e.name, e.description, e.event_date, e.end_date,
              e.vibe_tags, e.estimated_reach, e.address_text,
              e.radius_m, e.is_community,
              b.name AS business_name
       FROM app.events e
       LEFT JOIN app.businesses b ON e.business_id = b.id
       WHERE e.status IN ('Scheduled', 'Live')
       ORDER BY e.event_date ASC`
    );

    const data = result.rows.map((row) => ({
      id:             row.id,
      label:          row.name,
      detail:         row.description ?? '',
      businessName:   row.business_name ?? null,
      addressText:    row.address_text ?? '',
      vibeTags:       row.vibe_tags ?? [],
      estimatedReach: row.estimated_reach ?? null,
      isCommunity:    row.is_community,
      radiusMeters:   row.radius_m ?? null,
      startsAt:       new Date(row.event_date).getTime(),
      endsAt:         row.end_date ? new Date(row.end_date).getTime() : null,
      bearingDeg:     uuidToBearingDeg(row.id),
      distanceMeters: 100,
    }));

    res.json({ data });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});