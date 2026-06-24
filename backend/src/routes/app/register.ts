import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { redis } from '../../redis';
import { registerLimiter } from '../../middleware/rateLimits';
import { validate } from '../../middleware/validate';
import { RegisterSchema } from '../../schemas/app';

export const registerRouter = Router();

// POST /api/register
// Issues a proximity token and a device auth JWT for a new or returning device.
registerRouter.post('/', registerLimiter, validate(RegisterSchema), async (req: Request, res: Response) => {
  const { deviceId } = req.body;

  const proximityToken = uuidv4();
  const expiresAt = Date.now() + 900 * 1000; // 15 min

  // ADR 0011: token TTL = 15 min (900s) + 30s grace = 930s
  await redis.set(`token:${proximityToken}`, deviceId, 'EX', 930);

  // ADR 0036: store reverse index for ghost mode token revocation
  await redis.set(`device_token:${deviceId}`, proximityToken, 'EX', 930);

  const secret = process.env.DEVICE_JWT_SECRET;
  if (!secret) throw new Error('[register] DEVICE_JWT_SECRET not configured');
  const authToken = jwt.sign({ sub: deviceId, type: 'device' }, secret, { expiresIn: '90d', algorithm: 'HS256' });

  res.json({ token: proximityToken, expiresAt, authToken });
});
