import { Router, Request, Response } from 'express';
import { authDevice } from '../../middleware/authDevice';
import { redis } from '../../redis';
import { pool } from '../../db';
import { DEFAULTS } from '../../config';

export const revealRouter = Router();

revealRouter.use(authDevice);

const REVEAL_TTL_S = parseInt(process.env.REVEAL_TTL_SECONDS ?? String(DEFAULTS.BUZZ_COOLDOWN), 10);

// Expo Push API endpoint
const EXPO_PUSH_API = 'https://exp.host/--/api/v2/push/send';

/**
 * Send a push notification via Expo Push API (best-effort, fire-and-forget).
 */
async function sendExpoPush(pushToken: string | null, title: string, body: string, data: Record<string, string>): Promise<void> {
  if (!pushToken) return;
  try {
    await fetch(EXPO_PUSH_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{
        to: pushToken,
        title,
        body,
        data,
      }]),
    });
  } catch (err) {
    console.warn('[push] expo push failed:', err);
  }
}

/**
 * Resolve the push token for a device from the proximity token chain.
 * Returns null if the device is not found or has no push token.
 */
async function resolvePushToken(deviceId: string): Promise<string | null> {
  try {
    const result = await pool.query(
      `SELECT push_token FROM app.users WHERE id = $1 AND push_token IS NOT NULL LIMIT 1`,
      [deviceId]
    );
    return result.rows.length > 0 ? result.rows[0].push_token : null;
  } catch (err) {
    console.warn('[push] resolvePushToken failed:', err);
    return null;
  }
}

// POST /api/reveal
// Submit a reveal intent for the given proximity token.
// If the reciprocal intent already exists → mutual match.
revealRouter.post('/', async (req: Request, res: Response) => {
  const myDeviceId = req.deviceId!;
  const { token }: { token: string } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'token is required' });
  }

  try {
    // 1. Resolve the target token to a deviceId via token:{uuid} in Redis
    const targetDeviceId = await redis.get(`token:${token}`);
    if (!targetDeviceId) {
      return res.json({ status: 'pending' });
    }

    // Prevent self-reveal
    if (myDeviceId === targetDeviceId) {
      return res.json({ status: 'pending' });
    }

    // Ensure consistent ordering: myDeviceId < theirDeviceId alphabetically
    const [stronger, weaker] = myDeviceId < targetDeviceId
      ? [myDeviceId, targetDeviceId]
      : [targetDeviceId, myDeviceId];

    const forwardKey = `reveal:${stronger}:${weaker}`;
    const backwardKey = `reveal:${weaker}:${stronger}`;

    // 2. Check if reciprocal intent already exists
    const reciprocalExists = await redis.exists(backwardKey);

    if (reciprocalExists) {
      // Mutual reveal! Create match record and clean up
      const result = await pool.query(
        `INSERT INTO app.matches (device_a, device_b, status)
         VALUES ($1, $2, 'mutual')
         ON CONFLICT (device_a, device_b) DO NOTHING
         RETURNING id, created_at`,
        [stronger, weaker]
      );

      // Delete both Redis keys
      await redis.del(forwardKey, backwardKey);

      if (result.rows.length > 0) {
        // ADR 0031: Send mutual reveal push notifications to both devices
        const tokenA = resolvePushToken(stronger);
        const tokenB = resolvePushToken(weaker);
        const [pushA, pushB] = await Promise.all([tokenA, tokenB]);

        const notificationPayload = {
          title: 'New match',
          body: 'You and someone nearby both revealed',
          data: { type: 'reveal', matchId: result.rows[0].id } as Record<string, string>,
        };

        // Fire-and-forget: both pushes in parallel
        sendExpoPush(pushA, notificationPayload.title, notificationPayload.body, notificationPayload.data);
        sendExpoPush(pushB, notificationPayload.title, notificationPayload.body, notificationPayload.data);

        return res.json({
          status: 'matched' as const,
          matchId: result.rows[0].id,
          createdAt: result.rows[0].created_at.getTime(),
        });
      }

      // Match already existed (idempotent)
      return res.json({
        status: 'matched' as const,
        matchId: result.rows[0]?.id ?? 'existing',
      });
    }

    // No reciprocal yet — write forward intent with TTL
    await redis.set(forwardKey, '1', 'EX', REVEAL_TTL_S);

    return res.json({ status: 'pending' });
  } catch (err) {
    console.error('[reveal] error:', err);
    return res.status(500).json({ error: 'internal error' });
  }
});