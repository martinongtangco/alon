import { Router, Request, Response } from 'express';
import { authDevice } from '../../middleware/authDevice';

export const matchesRouter = Router();

matchesRouter.use(authDevice);

// GET /api/matches
// M1: returns empty — server-side matching requires mutual reveal (M2).
// The Matches screen is populated via client-side buzz state in M1.
matchesRouter.get('/', (_req: Request, res: Response) => {
  res.json([]);
});
