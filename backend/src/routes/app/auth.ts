import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { pool } from '../../db';
import { otpRequestLimiter, otpVerifyLimiter } from '../../middleware/rateLimits';
import { authUser } from '../../middleware/authUser';
import { authDevice } from '../../middleware/authDevice';
import { validate } from '../../middleware/validate';
import { RequestOtpSchema, VerifyOtpSchema, VerifyAgeSchema } from '../../schemas/app';
import { normalizePhone } from '../../utils/normalizePhone';

export const authRouter = Router();

// POST /api/auth/request-otp
// Requests a one-time password via Twilio Verify.
authRouter.post('/request-otp', otpRequestLimiter, validate(RequestOtpSchema), async (req: Request, res: Response) => {
  let { phone } = req.body;

  // Normalize to E.164 before sending to Twilio and storing
  try {
    phone = normalizePhone(phone);
  } catch {
    return res.status(400).json({ error: 'Invalid phone number format' });
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

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
      console.error('[auth] Twilio request-otp error:', body);
      return res.status(400).json({ error: 'Failed to send verification code. Try again.' });
    }

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// POST /api/auth/verify-otp
// Verifies the OTP code and issues a user JWT.
authRouter.post('/verify-otp', otpVerifyLimiter, validate(VerifyOtpSchema), async (req: Request, res: Response) => {
  let { phone, code } = req.body;

  // Normalize to E.164 before verifying with Twilio and storing
  try {
    phone = normalizePhone(phone);
  } catch {
    return res.status(400).json({ error: 'Invalid phone number format' });
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

  if (!accountSid || !verifyServiceSid) {
    return res.status(503).json({ error: 'SMS service not configured' });
  }

  // Verify the OTP code via Twilio Verify API
  try {
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
      console.error('[auth] Twilio verify-otp error:', body);
      return res.status(400).json({ error: 'Verification failed. Please try again.' });
    }

    const verifyResult = await response.json();

    if (verifyResult.status !== 'approved') {
      console.warn('[verify-otp] rejected, status:', verifyResult.status);
      return res.status(401).json({ error: 'Invalid or expired code' });
    }

    // Link phone to user account
    const secret = process.env.USER_JWT_SECRET;
    if (!secret) throw new Error('[verify-otp] USER_JWT_SECRET not configured');
    const userId = uuidv4();

    // Check if phone already exists in app.users
    const existing = await pool.query(
      'SELECT id FROM app.users WHERE phone = $1',
      [phone],
    );

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
        { expiresIn: '30d', algorithm: 'HS256' },
      );

      const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days in ms
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
          { expiresIn: '30d', algorithm: 'HS256' },
        );

        const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
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
      { expiresIn: '30d', algorithm: 'HS256' },
    );

    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days in ms
    res.json({ userToken, expiresAt });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[verify-otp] error:', msg);
    res.status(500).json({ error: 'Verification failed. Please try again.' });
  }
});

// POST /api/auth/logout
// M3: client-side logout — signals the client to clear its stored token.
// Full server-side blacklist deferred to M4.
authRouter.post('/logout', authUser, (_req: Request, res: Response) => {
  res.json({ ok: true });
});

// POST /api/auth/verify-age
// ADR 0035: Age Verification — DOB self-declaration (M2).
// Third-party ID verification feature-flagged via FEATURE_ID_VERIFICATION.
authRouter.post('/verify-age', authDevice, validate(VerifyAgeSchema), async (req: Request, res: Response) => {
  const deviceId = req.deviceId!;
  const { dateOfBirth }: { dateOfBirth: string } = req.body;

  try {
    // Server-side age check: must be at least 18 years old
    const dob = new Date(dateOfBirth);
    if (isNaN(dob.getTime())) {
      return res.status(400).json({ error: 'Invalid date of birth' });
    }

    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }

    if (age < 18) {
      return res.status(403).json({ error: 'You must be at least 18 years old to use Alon' });
    }

    const featureIdVerification = process.env.FEATURE_ID_VERIFICATION === 'true';

    if (featureIdVerification) {
      // TODO: M3 — create Stripe Identity verification session
      // For now, scaffold returns success but logs that third-party verification is pending
      console.warn(`[verify-age] FEATURE_ID_VERIFICATION active but third-party provider not configured for device ${deviceId}`);
    }

    await pool.query(
      `UPDATE app.users SET date_of_birth = $1, age_verified = $2, age_verified_at = NOW()
       WHERE id = $3`,
      [dateOfBirth, featureIdVerification ? false : true, deviceId]
    );

    res.json({ ok: true, ageVerified: !featureIdVerification });
  } catch (err) {
    console.error('[verify-age] error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
