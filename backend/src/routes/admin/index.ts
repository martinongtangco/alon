import { Router } from 'express';
import { authRouter } from './auth';
import { sseRouter } from './sse';
import { usersRouter } from './users';
import { businessesRouter } from './businesses';
import { promosRouter } from './promos';
import { eventsRouter } from './events';
import { flagsRouter } from './flags';
import { revenueRouter } from './revenue';
import { configRouter } from './config';

export const adminRouter = Router();

adminRouter.use('/auth', authRouter);
adminRouter.use('/sse', sseRouter);
adminRouter.use('/users', usersRouter);
adminRouter.use('/businesses', businessesRouter);
adminRouter.use('/promos', promosRouter);
adminRouter.use('/events', eventsRouter);
adminRouter.use('/flags', flagsRouter);
adminRouter.use('/revenue', revenueRouter);
adminRouter.use('/config', configRouter);
