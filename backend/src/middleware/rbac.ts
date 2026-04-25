import { Request, Response, NextFunction } from 'express';

export enum AdminRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  OPS = 'OPS',
  FINANCE = 'FINANCE'
}

export const requireRole = (allowedRoles: AdminRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ error: 'Unauthorized: No user context' });
    }

    const userRole = req.user.role as AdminRole;

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
    }

    next();
  };
};
