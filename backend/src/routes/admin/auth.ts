import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import * as jose from 'jose';
import { authenticator } from 'otplib';
import { pool } from '../../db';
import { withAudit, AuditAction } from '../../audit';
import { getPrivateKey, getPublicKey } from '../../utils/keys';
import { adminLoginLimiter } from '../../middleware/rateLimits';

export const authRouter = Router();

// Helper to generate access and refresh tokens
const issueTokens = async (userId: string, role: string) => {
  const privateKey = await jose.importPKCS8(getPrivateKey(), 'RS256');
  
  const accessToken = await new jose.SignJWT({ id: userId, role, type: 'admin' })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(privateKey);

  const refreshToken = await new jose.SignJWT({ id: userId, type: 'refresh' })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(privateKey);

  return { accessToken, refreshToken };
};

authRouter.post('/login', adminLoginLimiter, async (req: Request, res: Response) => {
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

    // Fallback if TOTP is disabled (e.g., initial seed)
    const { accessToken, refreshToken } = await issueTokens(user.id, user.role);

    res.cookie('admin_refresh', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 8 * 60 * 60 * 1000
    });

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
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

authRouter.post('/totp', adminLoginLimiter, async (req: Request, res: Response) => {
  const { tempToken, code } = req.body;

  if (!tempToken || !code) return res.status(400).json({ error: 'Missing tempToken or code' });

  try {
    const publicKey = await jose.importSPKI(getPublicKey(), 'RS256');
    const { payload } = await jose.jwtVerify(tempToken, publicKey, { algorithms: ['RS256'] });

    if (payload.type !== 'totp_pending') return res.status(403).json({ error: 'Invalid token' });

    const result = await pool.query('SELECT totp_secret FROM admin.users WHERE id = $1', [payload.id]);
    const user = result.rows[0];

    if (!user || !user.totp_secret) return res.status(401).json({ error: 'TOTP not configured' });

    const isValid = authenticator.verify({ token: code, secret: user.totp_secret });
    if (!isValid) return res.status(401).json({ error: 'Invalid TOTP code' });

    const { accessToken, refreshToken } = await issueTokens(payload.id as string, payload.role as string);

    res.cookie('admin_refresh', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 8 * 60 * 60 * 1000
    });

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
  } catch (error) {
    res.status(401).json({ error: 'Token expired or invalid' });
  }
});

// Refresh endpoint
authRouter.post('/refresh', async (req: Request, res: Response) => {
  const token = req.cookies?.admin_refresh;
  if (!token) return res.status(401).json({ error: 'No refresh token provided' });

  try {
    const publicKey = await jose.importSPKI(getPublicKey(), 'RS256');
    const { payload } = await jose.jwtVerify(token, publicKey, { algorithms: ['RS256'] });

    if (payload.type !== 'refresh') return res.status(403).json({ error: 'Invalid token type' });

    const result = await pool.query('SELECT role, status FROM admin.users WHERE id = $1', [payload.id]);
    const user = result.rows[0];

    if (!user || user.status !== 'Active') return res.status(401).json({ error: 'User invalid' });

    const { accessToken, refreshToken } = await issueTokens(payload.id as string, user.role);

    res.cookie('admin_refresh', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 8 * 60 * 60 * 1000
    });

    res.json({ token: accessToken, role: user.role });
  } catch (error) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// Logout endpoint
authRouter.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('admin_refresh');
  res.json({ success: true });
});
