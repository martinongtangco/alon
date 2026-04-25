import { Router, Request, Response } from 'express';
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
