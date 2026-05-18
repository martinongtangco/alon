import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authDevice } from '../../middleware/authDevice';
import { redis } from '../../redis';

export const ghostRouter = Router();

ghostRouter.use(authDevice);

// POST /api/ghost
// Toggle Ghost Mode: server-enforced token deactivation (ADR 0036).
// Body: { active: boolean }
ghostRouter.post('/', async (req: Request, res: Response) => {
  const deviceId = req.deviceId!;
  const { active }: { active: boolean } = req.body;

  if (typeof active !== 'boolean') {
    return res.status(400).json({ error: 'active must be a boolean' });
  }

  try {
    if (active) {
      // --- Ghost Mode activation: revoke current token ---

      // Find the current proximity token for this device by scanning Redis keys.
      // The token key format is `token:{proximityToken}` -> deviceId.
      // We use the device's stored token from the auth device JWT chain.
      // Since we don't have a direct reverse index, we look up via the
      // bootstrap token store pattern from ADR 0014.
      const currentToken = await redis.get(`device_token:${deviceId}`);

      if (currentToken) {
        // Delete the token so it no longer resolves
        await redis.del(`token:${currentToken}`);
      }

      // Set ghost flag with no TTL (persists until explicitly cleared)
      await redis.set(`ghost:${deviceId}`, '1');

      // Also remove the device_token reference so rotation doesn't reuse it
      await redis.del(`device_token:${deviceId}`);
    } else {
      // --- Ghost Mode deactivation: issue new token ---

      // Clear ghost flag
      await redis.del(`ghost:${deviceId}`);

      // Issue a fresh proximity token (same flow as /api/token/rotate)
      const proximityToken = uuidv4();
      const expiresAt = Date.now() + 900 * 1000;

      await redis.set(`token:${proximityToken}`, deviceId, 'EX', 930);

      // Store the token reference for this device (ADR 0014)
      await redis.set(`device_token:${deviceId}`, proximityToken, 'EX', 930);

      return res.json({ token: proximityToken, expiresAt });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('[ghost] error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});