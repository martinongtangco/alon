import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { authAdmin } from '../../middleware/authAdmin';
import { requireRole, AdminRole } from '../../middleware/rbac';
import { v4 as uuidv4 } from 'uuid';

export const sseRouter = Router();

interface SSEClient {
  id: string;
  res: Response;
  role: string;
  streamType: 'status' | 'activity' | 'logs';
}

const clients: SSEClient[] = [];

export const broadcastSSE = (streamType: 'status' | 'activity' | 'logs', data: any) => {
  clients
    .filter(c => c.streamType === streamType)
    .forEach(client => {
      client.res.write(`event: ${streamType}\ndata: ${JSON.stringify(data)}\n\n`);
    });
};

const setupSSEConnection = (req: Request, res: Response, streamType: 'status' | 'activity' | 'logs') => {
  const role = (req as any).user!.role;
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const clientId = uuidv4();
  const newClient: SSEClient = { id: clientId, res, role, streamType };
  
  clients.push(newClient);
  res.write('event: heartbeat\ndata: {}\n\n');

  req.on('close', () => {
    const idx = clients.findIndex(c => c.id === clientId);
    if (idx !== -1) clients.splice(idx, 1);
  });
};

// Stream endpoints
sseRouter.get('/status', authAdmin, requireRole([AdminRole.SUPER_ADMIN, AdminRole.OPS, AdminRole.FINANCE]), (req, res) => {
  setupSSEConnection(req, res, 'status');
});

sseRouter.get('/activity', authAdmin, requireRole([AdminRole.SUPER_ADMIN, AdminRole.OPS]), (req, res) => {
  setupSSEConnection(req, res, 'activity');
});

sseRouter.get('/logs', authAdmin, requireRole([AdminRole.SUPER_ADMIN, AdminRole.OPS]), (req, res) => {
  setupSSEConnection(req, res, 'logs');
});

setInterval(() => {
  clients.forEach(client => {
    client.res.write('event: heartbeat\ndata: {}\n\n');
  });
}, 15000);

// --- Mock Data Generators for Dashboard UI Testing ---
// In production, these are triggered by actual mobile app traffic or redis pubsub

// 1. Status Stream (Every 5s)
setInterval(() => {
  broadcastSSE('status', {
    api: 'healthy',
    db: 'healthy',
    ble: 'healthy',
    promo: 'healthy',
    push: 'healthy',
    timestamp: new Date().toISOString()
  });
}, 5000);

// 2. Activity Stream (Metrics & Modes - Every 5s)
setInterval(() => {
  broadcastSSE('activity', {
    metrics: {
      activeSessions: Math.floor(Math.random() * 5000) + 10000,
      bleBroadcasting: Math.floor(Math.random() * 3000) + 8000,
      buzzesPerMin: Math.floor(Math.random() * 500) + 100,
      promosTriggered: Math.floor(Math.random() * 100) + 20,
      apiReqPerSec: Math.floor(Math.random() * 800) + 200,
    },
    modes: {
      Networking: Math.floor(Math.random() * 40) + 30, // %
      Chill: Math.floor(Math.random() * 30) + 10,
      Dating: Math.floor(Math.random() * 20) + 10,
      Explorer: Math.floor(Math.random() * 10) + 5,
    }
  });
}, 5000);

// 3. Logs Stream (Random events every 2-8s)
const logTypes = ['buzz_sent', 'mutual_reveal', 'promo_triggered', 'new_session', 'rate_limit_hit'];
const streamLogs = () => {
  const type = logTypes[Math.floor(Math.random() * logTypes.length)];
  const isError = type === 'rate_limit_hit';
  
  broadcastSSE('logs', {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    level: isError ? 'WARN' : 'INFO',
    type,
    message: `Event: ${type}`,
    metadata: {
      userHash: crypto.randomBytes(4).toString('hex'),
      duration: Math.floor(Math.random() * 100) + 'ms'
    }
  });

  setTimeout(streamLogs, Math.random() * 6000 + 2000);
};
streamLogs();
