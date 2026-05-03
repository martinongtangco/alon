import { Router, Request, Response } from 'express';

export const appConfigRouter = Router();

const DEFAULTS = {
  BUZZ_COOLDOWN: 120,   // seconds; ADR 0012
};

// GET /api/config
// Returns platform config values consumed by the mobile app.
// M1: returns hardcoded defaults. M2: reads from admin.platform_config via Postgres.
appConfigRouter.get('/', (_req: Request, res: Response) => {
  res.json(DEFAULTS);
});
