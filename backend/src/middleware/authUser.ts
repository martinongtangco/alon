import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const secret = () => process.env.USER_JWT_SECRET ?? 'dev-user-secret';

export const authUser = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Missing token' });

  try {
    const payload = jwt.verify(token, secret()) as { sub: string; type: string };
    if (payload.type !== 'user') return res.status(403).json({ error: 'Invalid token type' });
    req.userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ error: 'Token expired or invalid' });
  }
};