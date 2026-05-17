import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { adminRouter } from './routes/admin';
import { appRouter } from './routes/app';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Request logger — every request and its response
app.use((req, res, next) => {
  const start = Date.now();
  const reqId = Math.random().toString(36).slice(2, 8);
  console.log(`[${reqId}] → ${req.method} ${req.url} from ${req.ip}`);
  res.on('finish', () => {
    console.log(`[${reqId}] ← ${res.statusCode} (${Date.now() - start}ms)`);
  });
  next();
});

app.use('/api', appRouter);
app.use('/api/v1/admin', adminRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Server running on port ${PORT} (bound to 0.0.0.0)`);
});
