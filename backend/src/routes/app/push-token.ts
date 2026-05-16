import { Router, Request, Response } from 'express';
import { authDevice } from '../../middleware/authDevice';
import { pool } from '../../db';

export const pushTokenRouter = Router();

pushTokenRouter.use(authDevice);

// POST /api/push-token
// Register or update the Expo push token for this device.
pushTokenRouter.post('/', async (req: Request, res: Response) => {
  const deviceId = req.deviceId!;
  const { token }: { token: string } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'token is required' });
  }

  try {
    await pool.query(
      `INSERT INTO app.users (id, push_token)
       VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE
       SET push_token = EXCLUDED.push_token`,
      [deviceId, token]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('[push-token] error:', err);
    res.status(500).json({ error: 'internal error' });
  }
});