import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authDevice } from '../../middleware/authDevice';
import { redis } from '../../redis';

export const tokenRouter = Router();

tokenRouter.use(authDevice);

// POST /api/token/rotate
// Issues a new proximity token. The previous token remains valid until its TTL
// expires, providing the 30-second grace window for in-flight proximity events.
tokenRouter.post('/rotate', async (req: Request, res: Response) => {
  const deviceId = req.deviceId!;
  const proximityToken = uuidv4();
  const expiresAt = Date.now() + 900 * 1000;

  await redis.set(`token:${proximityToken}`, deviceId, 'EX', 930);

  // ADR 0036: maintain reverse index for ghost mode token revocation
  await redis.set(`device_token:${deviceId}`, proximityToken, 'EX', 930);

  res.json({ token: proximityToken, expiresAt });
});
