import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const secret = () => {
  const s = process.env.DEVICE_JWT_SECRET;
  if (!s) throw new Error('[authDevice] DEVICE_JWT_SECRET not configured — refusing to authenticate');
  return s;
};

export const authDevice = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Missing token' });

  try {
    const payload = jwt.verify(token, secret(), { algorithms: ['HS256'] }) as { sub: string; type: string };
    if (payload.type !== 'device') return res.status(403).json({ error: 'Invalid token type' });
    req.deviceId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ error: 'Token expired or invalid' });
  }
};
