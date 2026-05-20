import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import * as jose from 'jose';
import { v4 as uuidv4 } from 'uuid';
import { authenticator } from 'otplib';
import { pool } from '../../db';
import { redis } from '../../redis';
import { withAudit, AuditAction } from '../../audit';
import { getPrivateKey, getPublicKey } from '../../utils/keys';
import { adminLoginLimiter } from '../../middleware/rateLimits';
import { validate } from '../../middleware/validate';
import { AdminLoginSchema, AdminTotpSchema } from '../../schemas/admin';

export const authRouter = Router();

const REFRESH_TTL_S = 8 * 60 * 60 + 5 * 60; // 8h + 5 min clock-skew buffer

const issueTokens = async (userId: string, role: string) => {
  const privateKey = await jose.importPKCS8(getPrivateKey(), 'RS256');

  const accessToken = await new jose.SignJWT({ id: userId, role, type: 'admin' })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(privateKey);

  const jti = uuidv4();
  const refreshToken = await new jose.SignJWT({ id: userId, type: 'refresh', jti })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(privateKey);

  // Store JTI in Redis for server-side revocation (ADR 0042)
  await redis.set(`admin_refresh_jti:${jti}`, userId, 'EX', REFRESH_TTL_S);

  return { accessToken, refreshToken };
};

const setAuthCookies = (res: Response, accessToken: string, refreshToken: string) => {
  res.cookie('admin_refresh', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 8 * 60 * 60 * 1000,
  });
  // admin_token cookie enables SSE connections that can't set Authorization headers (ADR 0042)
  res.cookie('admin_token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000,
  });
};

authRouter.post('/login', adminLoginLimiter, validate(AdminLoginSchema), async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query('SELECT * FROM admin.users WHERE email = $1 AND status = \'Active\'', [email]);
    const user = result.rows[0];

    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });

    if (user.totp_enabled) {
      const privateKey = await jose.importPKCS8(getPrivateKey(), 'RS256');
      const tempToken = await new jose.SignJWT({ id: user.id, role: user.role, type: 'totp_pending' })
        .setProtectedHeader({ alg: 'RS256' })
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(privateKey);

      return res.json({ totp_required: true, tempToken });
    }

    const { accessToken, refreshToken } = await issueTokens(user.id, user.role);
    setAuthCookies(res, accessToken, refreshToken);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('UPDATE admin.users SET last_login_at = NOW() WHERE id = $1', [user.id]);
      await withAudit(client, { adminId: user.id, adminRole: user.role, ipAddress: req.ip || '' }, AuditAction.ADMIN_LOGIN);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    res.json({ token: accessToken, role: user.role });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

authRouter.post('/totp', adminLoginLimiter, validate(AdminTotpSchema), async (req: Request, res: Response) => {
  const { tempToken, code } = req.body;

  try {
    const publicKey = await jose.importSPKI(getPublicKey(), 'RS256');
    const { payload } = await jose.jwtVerify(tempToken, publicKey, { algorithms: ['RS256'] });

    if (payload.type !== 'totp_pending') return res.status(403).json({ error: 'Invalid token' });

    const result = await pool.query('SELECT totp_secret, role FROM admin.users WHERE id = $1', [payload.id]);
    const user = result.rows[0];

    if (!user || !user.totp_secret) return res.status(401).json({ error: 'TOTP not configured' });

    const isValid = authenticator.verify({ token: code, secret: user.totp_secret });
    if (!isValid) return res.status(401).json({ error: 'Invalid TOTP code' });

    const { accessToken, refreshToken } = await issueTokens(payload.id as string, payload.role as string);
    setAuthCookies(res, accessToken, refreshToken);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('UPDATE admin.users SET last_login_at = NOW() WHERE id = $1', [payload.id]);
      await withAudit(client, { adminId: payload.id as string, adminRole: payload.role as string, ipAddress: req.ip || '' }, AuditAction.ADMIN_LOGIN);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    res.json({ token: accessToken, role: payload.role });
  } catch {
    res.status(401).json({ error: 'Token expired or invalid' });
  }
});

authRouter.post('/refresh', async (req: Request, res: Response) => {
  const token = req.cookies?.admin_refresh;
  if (!token) return res.status(401).json({ error: 'No refresh token provided' });

  try {
    const publicKey = await jose.importSPKI(getPublicKey(), 'RS256');
    const { payload } = await jose.jwtVerify(token, publicKey, { algorithms: ['RS256'] });

    if (payload.type !== 'refresh') return res.status(403).json({ error: 'Invalid token type' });

    // Verify JTI is still valid (not revoked) — ADR 0042
    const jti = payload.jti as string;
    const stored = jti ? await redis.get(`admin_refresh_jti:${jti}`) : null;
    if (!stored) return res.status(401).json({ error: 'Session expired or revoked' });

    const result = await pool.query('SELECT role, status FROM admin.users WHERE id = $1', [payload.id]);
    const user = result.rows[0];

    if (!user || user.status !== 'Active') return res.status(401).json({ error: 'User invalid' });

    // Rotate: delete old JTI and issue new tokens
    await redis.del(`admin_refresh_jti:${jti}`);
    const { accessToken, refreshToken } = await issueTokens(payload.id as string, user.role);
    setAuthCookies(res, accessToken, refreshToken);

    res.json({ token: accessToken, role: user.role });
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

authRouter.post('/logout', async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.admin_refresh;
  if (refreshToken) {
    try {
      const payload = jose.decodeJwt(refreshToken);
      if (payload?.jti) {
        await redis.del(`admin_refresh_jti:${payload.jti}`);
      }
    } catch { /* ignore decode errors — clear cookies regardless */ }
  }
  res.clearCookie('admin_refresh');
  res.clearCookie('admin_token');
  res.json({ ok: true });
});
