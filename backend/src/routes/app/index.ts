import { Router, Request, Response } from 'express';
import { registerRouter } from './register';
import { tokenRouter } from './token';
import { appConfigRouter } from './config';
import { buzzRouter } from './buzz';
import { matchesRouter } from './matches';
import { nearbyRouter } from './nearby';
import { revealRouter } from './reveal';
import { pushTokenRouter } from './push-token';
import { authRouter } from './auth';
import { ghostRouter } from './ghost';
import { appApiLimiter } from '../../middleware/rateLimits';

export const appRouter = Router();

// Apply general rate limiter to all app endpoints not already covered by stricter limiters
appRouter.use(appApiLimiter);

appRouter.get('/ping', (_req: Request, res: Response) => {
  res.json({ ok: true, mode: 'app' });
});

appRouter.use('/register', registerRouter);
appRouter.use('/token', tokenRouter);
appRouter.use('/config', appConfigRouter);
appRouter.use('/buzz', buzzRouter);
appRouter.use('/matches', matchesRouter);
appRouter.use('/nearby', nearbyRouter);
appRouter.use('/reveal', revealRouter);
appRouter.use('/push-token', pushTokenRouter);
appRouter.use('/auth', authRouter);
appRouter.use('/ghost', ghostRouter);
