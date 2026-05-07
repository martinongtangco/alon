import { Router, Request, Response } from 'express';
import { DEFAULTS } from '../../config';

export const appConfigRouter = Router();

// GET /api/config
// Returns platform config values consumed by the mobile app.
// M1: returns hardcoded defaults. M2: reads from admin.platform_config via Postgres.
appConfigRouter.get('/', (_req: Request, res: Response) => {
  res.json(DEFAULTS);
});

