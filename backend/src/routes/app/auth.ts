import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { pool } from '../../db';
import { otpRequestLimiter, otpVerifyLimiter } from '../../middleware/rateLimits';
import { validate } from '../../middleware/validate';
import { RequestOtpSchema, VerifyOtpSchema } from '../../schemas/app';

export const authRouter = Router();

// POST /api/auth/request-otp
// Requests a one-time password via Twilio Verify.
authRouter.post('/request-otp', otpRequestLimiter, validate(RequestOtpSchema), async (req: Request, res: Response) => {
  const { phone } = req.body;

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

    // DEV: bypass Twilio entirely — any code works in verify-otp
    if (process.env.BYPASS_OTP === 'true') {
      console.warn(`[request-otp] BYPASS_OTP active — pretend SMS sent to ${phone}, accept code 000000`);
    return res.json({ ok: true });
  }

  if (!accountSid || !verifyServiceSid) {
    return res.status(503).json({ error: 'SMS service not configured' });
  }

  try {
    const response = await fetch(`https://verify.twilio.com/v2/Services/${verifyServiceSid}/Verifications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${accountSid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        To: phone,
        Channel: 'sms',
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      return res.status(response.status).json({ error: 'Failed to send OTP', details: body });
    }

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// POST /api/auth/verify-otp
// Verifies the OTP code and issues a user JWT.
authRouter.post('/verify-otp', otpVerifyLimiter, validate(VerifyOtpSchema), async (req: Request, res: Response) => {
  const { phone, code } = req.body;

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

  // DEV: bypass — accept code "000000" without hitting Twilio
  const bypass = process.env.BYPASS_OTP === 'true';

  if (!bypass && (!accountSid || !verifyServiceSid)) {
    return res.status(503).json({ error: 'SMS service not configured' });
  }

  // Verify the OTP code via Twilio Verify API
  try {
      if (bypass) {
        console.warn(`[verify-otp] BYPASS_OTP active — accepting any code for ${phone}`);
      if (code !== '000000') {
        return res.status(401).json({ error: 'Invalid code (dev bypass: use 000000)' });
      }
      // Skip directly to user linkage with a synthetic "approved" result
    } else {
    const response = await fetch(`https://verify.twilio.com/v2/Services/${verifyServiceSid}/VerificationCheck`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${accountSid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        To: phone,
        Code: code,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      return res.status(response.status).json({ error: 'Verification check failed', details: body });
    }

    const verifyResult = await response.json();
    console.log('[verify-otp] twilio result:', JSON.stringify(verifyResult));

    if (verifyResult.status !== 'approved') {
      console.log('[verify-otp] not approved, status:', verifyResult.status);
      return res.status(401).json({ error: 'Invalid or expired code' });
    }
    } // end else (non-bypass Twilio check)

    // Link phone to user account
    const secret = process.env.USER_JWT_SECRET ?? 'dev-user-secret';
    const userId = uuidv4();

    // Check if phone already exists in app.users
    const existing = await pool.query(
      'SELECT id FROM app.users WHERE phone = $1',
      [phone],
    );
    console.log('[verify-otp] existing phone rows:', existing.rows.length);

    if (existing.rows.length > 0) {
      // Returning user — update phone_verified
      const existingUserId = existing.rows[0].id;

      await pool.query(
        `UPDATE app.users SET phone = $1, phone_verified = TRUE
         WHERE id = $2`,
        [phone, existingUserId],
      );

      // Issue user JWT for existing user
      const userToken = jwt.sign(
        { sub: existingUserId, type: 'user' },
        secret,
        { expiresIn: '90d' },
      );

      const expiresAt = Date.now() + 90 * 24 * 60 * 60 * 1000; // 90 days in ms
      res.json({ userToken, expiresAt });
      return;
    }

    // New user — create new row with device_id
    // The device_id is passed in the request body from the register flow
    const { deviceId } = req.body as { deviceId?: string };

    if (deviceId) {
      // Check if this device already has a user row (id = deviceId)
      const deviceUser = await pool.query(
        'SELECT id FROM app.users WHERE id = $1',
        [deviceId],
      );

      if (deviceUser.rows.length > 0) {
        // Device already has a user row — update it
        const existingUserId = deviceUser.rows[0].id;

        await pool.query(
          `UPDATE app.users SET phone = $1, phone_verified = TRUE
           WHERE id = $2`,
          [phone, existingUserId],
        );

        const userToken = jwt.sign(
          { sub: existingUserId, type: 'user' },
          secret,
          { expiresIn: '90d' },
        );

        const expiresAt = Date.now() + 90 * 24 * 60 * 60 * 1000;
        res.json({ userToken, expiresAt });
        return;
      }

      // New device, new user — create row (id = deviceId)
      await pool.query(
        `INSERT INTO app.users (id, phone, phone_verified)
         VALUES ($1, $2, TRUE)`,
        [deviceId, phone],
      );
    } else {
      // No deviceId — create user without device linkage
      await pool.query(
        `INSERT INTO app.users (id, phone, phone_verified)
         VALUES ($1, $2, TRUE)`,
        [userId, phone],
      );
    }

    // Issue user JWT
    const userToken = jwt.sign(
      { sub: userId, type: 'user' },
      secret,
      { expiresIn: '90d' },
    );

    const expiresAt = Date.now() + 90 * 24 * 60 * 60 * 1000; // 90 days in ms
    res.json({ userToken, expiresAt });
  } catch (error: any) {
    console.error('[verify-otp] error:', error?.message ?? error);
    res.status(500).json({ error: 'Verification failed', detail: error?.message });
  }
});