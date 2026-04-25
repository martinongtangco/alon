import { Request, Response, NextFunction } from 'express';
import * as jose from 'jose';
import { getPublicKey } from '../utils/keys';

export const authAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const publicKey = await jose.importSPKI(getPublicKey(), 'RS256');
    const { payload } = await jose.jwtVerify(token, publicKey, {
      algorithms: ['RS256']
    });
    
    if (payload.type !== 'admin') {
      return res.status(403).json({ error: 'Invalid token type' });
    }

    req.user = {
      id: payload.id as string,
      role: payload.role as string,
    };
    
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token expired or invalid' });
  }
};
