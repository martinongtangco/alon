import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { validateEnv } from './config/validateEnv';
import { adminRouter } from './routes/admin';
import { appRouter } from './routes/app';
import { promosRouter as publicPromosRouter } from './routes/public/promos';
import { eventsRouter as publicEventsRouter } from './routes/public/events';

dotenv.config();
validateEnv();

const app = express();
const PORT = process.env.PORT || 3000;

// Security headers via helmet
app.use(helmet({
  // Content-Security-Policy: allow assets only from self; no inline scripts
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],  // Tailwind requires inline styles
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
    },
  },
  // HSTS: 1 year, include subdomains
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
  },
}));

// CORS: explicit allowlist instead of open origin
const ALLOWED_ORIGINS = [
  'http://localhost:5173',   // Admin dashboard dev server
  'http://localhost:4173',   // Admin dashboard preview
  process.env.ADMIN_ORIGIN,  // Production admin URL (e.g. https://admin.yourdomain.com)
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no Origin header (React Native app, curl, Postman)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body size limit (64kb)
app.use(express.json({ limit: '64kb' }));
app.use(express.urlencoded({ extended: true, limit: '64kb' }));

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
app.use('/api/promos', publicPromosRouter);
app.use('/api/events', publicEventsRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Server running on port ${PORT} (bound to 0.0.0.0)`);
});
