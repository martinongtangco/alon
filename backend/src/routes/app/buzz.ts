import { Router, Request, Response } from 'express';
import { authDevice } from '../../middleware/authDevice';
import { redis } from '../../redis';
import { pool } from '../../db';
import { DEFAULTS } from '../../config';
import { validate } from '../../middleware/validate';
import { BuzzSchema } from '../../schemas/app';

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

// ADR 0036: check if a device is in Ghost Mode
async function isGhost(deviceId: string): Promise<boolean> {
  const result = await redis.get(`ghost:${deviceId}`);
  return result === '1';
}

// POST /api/buzz
// Blind Buzz: records a buzz from this device and enforces the cooldown window.
// Body: { targetToken?: string }  — BLE proximity token of the target device.
// If present, a push notification is sent to the target device (ADR 0031).
// ADR 0036: if the target device is ghosted, return "too-far" instead of "sent".
buzzRouter.post('/', validate(BuzzSchema), async (req: Request, res: Response) => {
  const deviceId = req.deviceId!;
  const cooldownKey = `cooldown:${deviceId}`;

  const existing = await redis.exists(cooldownKey);
  if (existing) return res.json('rate-limited');

  await redis.set(cooldownKey, '1', 'EX', BUZZ_COOLDOWN_S);

  // ADR 0031: notify the target device if a proximity token was supplied
  const { targetToken } = req.body as { targetToken?: string };
  if (targetToken) {
    // ADR 0036: check if target is ghosted before sending
    const targetDeviceId = await redis.get(`token:${targetToken}`);
    if (targetDeviceId && (await isGhost(targetDeviceId))) {
      return res.json('too-far' as const);
    }

    resolvePushToken(targetToken).then((pushToken) => {
      if (pushToken) {
        sendExpoPush(pushToken, 'someone buzzed you', 'open Alon to see who\'s nearby', { type: 'buzz' });
      }
    });
  }

  res.json('sent');
});

