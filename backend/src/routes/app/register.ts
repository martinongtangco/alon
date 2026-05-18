import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { redis } from '../../redis';
import { registerLimiter } from '../../middleware/rateLimits';

export const registerRouter = Router();

// POST /api/register
// Issues a proximity token and a device auth JWT for a new or returning device.
registerRouter.post('/', registerLimiter, async (req: Request, res: Response) => {
  const { deviceId } = req.body;
  if (!deviceId || typeof deviceId !== 'string') {
    return res.status(400).json({ error: 'deviceId required' });
  }

  const proximityToken = uuidv4();
  const expiresAt = Date.now() + 900 * 1000; // 15 min

  // ADR 0011: token TTL = 15 min (900s) + 30s grace = 930s
  await redis.set(`token:${proximityToken}`, deviceId, 'EX', 930);

  // ADR 0036: store reverse index for ghost mode token revocation
  await redis.set(`device_token:${deviceId}`, proximityToken, 'EX', 930);

  const secret = process.env.DEVICE_JWT_SECRET ?? 'dev-device-secret';
  const authToken = jwt.sign({ sub: deviceId, type: 'device' }, secret, { expiresIn: '90d' });

  res.json({ token: proximityToken, expiresAt, authToken });
});
