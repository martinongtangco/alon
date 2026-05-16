import { Router, Request, Response } from 'express';
import { authDevice } from '../../middleware/authDevice';
import { redis } from '../../redis';
import { pool } from '../../db';
import { DEFAULTS } from '../../config';

export const buzzRouter = Router();

buzzRouter.use(authDevice);

const BUZZ_COOLDOWN_S = DEFAULTS.BUZZ_COOLDOWN;

// Expo Push API endpoint
const EXPO_PUSH_API = 'https://exp.host/--/api/v2/push/send';

/**
 * Send a push notification via Expo Push API (best-effort, fire-and-forget).
 */
async function sendExpoPush(pushToken: string, title: string, body: string, data: Record<string, string>): Promise<void> {
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
    console.warn('[push] expo push failed for token', pushToken, err);
    // Best-effort: log and silently drop
  }
}

/**
 * Resolve the push token for a target device from the proximity token chain.
 * Returns null if the device is not found or has no push token.
 */
async function resolvePushToken(proximityToken: string): Promise<string | null> {
  try {
    // Look up the target device ID from the proximity token in Redis
    const targetDeviceId = await redis.get(`token:${proximityToken}`);
    if (!targetDeviceId) return null;

    // Look up the push token for the target device from Postgres
    const result = await pool.query(
      `SELECT push_token FROM app.users WHERE id = $1 AND push_token IS NOT NULL LIMIT 1`,
      [targetDeviceId]
    );

    return result.rows.length > 0 ? result.rows[0].push_token : null;
  } catch (err) {
    console.warn('[push] resolvePushToken failed:', err);
    return null;
  }
}

// POST /api/buzz
// Blind Buzz: records a buzz from this device and enforces the cooldown window.
// Body: { targetToken?: string }  — BLE proximity token of the target device.
// If present, a push notification is sent to the target device (ADR 0031).
buzzRouter.post('/', async (req: Request, res: Response) => {
  const deviceId = req.deviceId!;
  const cooldownKey = `cooldown:${deviceId}`;

  const existing = await redis.exists(cooldownKey);
  if (existing) return res.json('rate-limited');

  await redis.set(cooldownKey, '1', 'EX', BUZZ_COOLDOWN_S);

  // ADR 0031: notify the target device if a proximity token was supplied
  const { targetToken } = req.body as { targetToken?: string };
  if (targetToken) {
    resolvePushToken(targetToken).then((pushToken) => {
      if (pushToken) {
        sendExpoPush(pushToken, 'someone buzzed you', 'open Alon to see who\'s nearby', { type: 'buzz' });
      }
    });
  }

  res.json('sent');
});

