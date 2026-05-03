import { Router, Request, Response } from 'express';
import { authDevice } from '../../middleware/authDevice';
import { redis } from '../../redis';

export const buzzRouter = Router();

buzzRouter.use(authDevice);

const BUZZ_COOLDOWN_S = 120; // seconds; matches DEFAULTS in config.ts

// POST /api/buzz
// Blind Buzz: records a buzz from this device and enforces the cooldown window.
// The server does not know proximity — 'too-far' is a client-side check only.
buzzRouter.post('/', async (req: Request, res: Response) => {
  const deviceId = req.deviceId!;
  const cooldownKey = `cooldown:${deviceId}`;

  const existing = await redis.exists(cooldownKey);
  if (existing) return res.json('rate-limited');

  await redis.set(cooldownKey, '1', 'EX', BUZZ_COOLDOWN_S);

  res.json('sent');
});
