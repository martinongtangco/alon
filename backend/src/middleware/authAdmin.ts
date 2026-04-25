import { Request, Response, NextFunction } from 'express';
import * as jose from 'jose';
import { getPublicKey } from '../utils/keys';

export const authAdmin = async (req: Request, res: Response, next: NextFunction) => {
  let token = req.headers.authorization?.split(' ')[1];
  
  if (!token && req.query.token) {
    token = req.query.token as string;
  }

  if (!token) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

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
