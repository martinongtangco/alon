import { Router, Request, Response } from 'express';
import { authDevice } from '../../middleware/authDevice';
import { pool } from '../../db';
import { redis } from '../../redis';

export const matchesRouter = Router();

matchesRouter.use(authDevice);

interface MatchRow {
  id: string;
  device_a: string;
  device_b: string;
  status: string;
  created_at: Date;
}

// GET /api/matches
// M2: returns real matches from Postgres with reveal status from Redis.
matchesRouter.get('/', async (req: Request, res: Response) => {
  const deviceId = req.deviceId!;

  try {
    // Fetch all matches where this device is involved
    const result = await pool.query<MatchRow>(
      `SELECT m.id, m.device_a, m.device_b, m.status, m.created_at
       FROM app.matches m
       WHERE m.device_a = $1 OR m.device_b = $1
       ORDER BY m.created_at DESC`,
      [deviceId]
    );

    const matches: Array<{
      id: string;
      displayName: string;
      vibes: string[];
      mode: string;
      status: 'pending' | 'mutual';
      createdAt: number;
    }> = [];

    for (const row of result.rows) {
      // Determine the other party's ID
      const otherId = row.device_a === deviceId ? row.device_b : row.device_a;

      // Get the other user's profile
      const userResult = await pool.query(
        `SELECT display_name, vibes, current_mode FROM app.users WHERE id = $1`,
        [otherId]
      );

      if (userResult.rows.length === 0) continue;

      const user = userResult.rows[0];

      // Check if there's still a pending reveal intent for this pair
      const [a, b] = deviceId < otherId ? [deviceId, otherId] : [otherId, deviceId];
      const pendingKey = `reveal:${a}:${b}`;
      const pendingExists = await redis.exists(pendingKey);
      const reciprocalKey = `reveal:${b}:${a}`;
      const reciprocalExists = await redis.exists(reciprocalKey);

      const status: 'pending' | 'mutual' = pendingExists || reciprocalExists
        ? 'pending'
        : row.status === 'mutual'
          ? 'mutual'
          : 'pending';

      matches.push({
        id: row.id,
        displayName: user.display_name,
        vibes: (user.vibes as string[]) || [],
        mode: user.current_mode,
        status,
        createdAt: row.created_at.getTime(),
      });
    }

    res.json(matches);
  } catch (err) {
    console.error('[matches] db error:', err);
    res.status(503).json({ error: 'Service temporarily unavailable' });
  }
});
