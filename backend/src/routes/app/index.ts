import { Router, Request, Response } from 'express';
import { registerRouter } from './register';
import { tokenRouter } from './token';
import { appConfigRouter } from './config';
import { buzzRouter } from './buzz';
import { matchesRouter } from './matches';
import { vibesRouter } from './vibes';
import { revealsRouter } from './reveals';

export const appRouter = Router();

appRouter.get('/ping', (_req: Request, res: Response) => {
  res.json({ ok: true, mode: 'app' });
});

appRouter.use('/register', registerRouter);
appRouter.use('/token', tokenRouter);
appRouter.use('/config', appConfigRouter);
appRouter.use('/buzz', buzzRouter);
appRouter.use('/matches', matchesRouter);
appRouter.use('/users/:token/vibes', vibesRouter);
appRouter.use('/reveals', revealsRouter);
