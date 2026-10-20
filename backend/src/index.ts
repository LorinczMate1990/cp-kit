import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { PrismaClient } from '@prisma/client';

import authRoutes from './routes/auth';
import organizationsRoutes from './routes/organizations';
import usersRoutes from './routes/users';
import dashboardRoutes from './routes/dashboard';
import analyticsRoutes from './routes/analytics';
import billingRoutes from './routes/billing';
import notificationsRoutes from './routes/notifications';
import auditRoutes from './routes/audit';
import webhooksRoutes from './routes/webhooks';

import { authMiddleware } from './middleware/auth';
import { tenantMiddleware } from './middleware/tenant';
import { rateLimiter } from './middleware/rateLimit';
import { redis, connectRedis } from './utils/redis';
import { startNotificationJob } from './jobs/notifications';
import { startReportJob } from './jobs/reports';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

export const prisma = new PrismaClient();
app.use(cors({
  origin: '*',
  credentials: true
}));

app.use(express.json());
app.use(rateLimiter);

// Health check - this is fine, no auth needed
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Public routes
app.use('/api/auth', authRoutes);

// Protected routes (tenantMiddleware must come after authMiddleware: it reads req.user)
app.use('/api/organizations', authMiddleware, tenantMiddleware, organizationsRoutes);
app.use('/api/users', authMiddleware, tenantMiddleware, usersRoutes);
app.use('/api/dashboards', authMiddleware, tenantMiddleware, dashboardRoutes);
app.use('/api/analytics', authMiddleware, tenantMiddleware, analyticsRoutes);
app.use('/api/billing', authMiddleware, tenantMiddleware, billingRoutes);
app.use('/api/notifications', authMiddleware, tenantMiddleware, notificationsRoutes);
app.use('/api/audit', authMiddleware, tenantMiddleware, auditRoutes);
app.use('/api/webhooks', authMiddleware, tenantMiddleware, webhooksRoutes);

// WebSocket handling
// Connections can't be shared, so each instance keeps its own. Broadcasts go through Redis pub/sub,
// so every instance delivers them to its own clients (see ai-instructions/adr/stateless-backend.md).
const wsClients = new Map<string, Set<any>>();
const BROADCAST_CHANNEL = 'ws:broadcast';

wss.on('connection', (ws, req) => {
  const orgId = req.url?.split('?org=')[1];

  if (orgId) {
    if (!wsClients.has(orgId)) {
      wsClients.set(orgId, new Set());
    }
    wsClients.get(orgId)!.add(ws);

    ws.on('close', () => {
      const clients = wsClients.get(orgId);
      clients?.delete(ws);
      if (clients?.size === 0) {
        wsClients.delete(orgId);
      }
    });
  }

  ws.on('message', (data) => {
    // Broadcast to all clients in same org
    const message = JSON.parse(data.toString());
    if (message.orgId && wsClients.has(message.orgId)) {
      wsClients.get(message.orgId)?.forEach(client => {
        if (client !== ws && client.readyState === 1) {
          client.send(JSON.stringify(message));
        }
      });
    }
  });
});

// Delivers a message to the clients of an organization connected to this instance
function deliverToOrg(orgId: string, message: object) {
  wsClients.get(orgId)?.forEach(client => {
    if (client.readyState === 1) {
      client.send(JSON.stringify(message));
    }
  });
}

// Broadcast helper for routes to use: reaches the organization's clients on every instance.
// If Redis is unavailable, it falls back to this instance's clients only.
export function broadcastToOrg(orgId: string, message: object) {
  redis.publish(BROADCAST_CHANNEL, JSON.stringify({ orgId, message })).catch((error) => {
    console.error('Broadcast publish failed:', error.message);
    deliverToOrg(orgId, message);
  });
}

// A subscribed Redis connection can't run other commands, so the subscriber is a separate connection
const subscriber = redis.duplicate();
subscriber.on('error', (error) => console.error('Redis subscriber error:', error.message));

connectRedis();
subscriber
  .connect()
  .then(() =>
    subscriber.subscribe(BROADCAST_CHANNEL, (payload) => {
      try {
        const { orgId, message } = JSON.parse(payload);
        deliverToOrg(orgId, message);
      } catch (error) {
        console.error('Invalid broadcast payload:', (error as Error).message);
      }
    })
  )
  .catch((error) => console.error('Redis subscriber connection failed:', error.message));

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
    stack: err.stack
  });
});

// Start background jobs
startNotificationJob();
startReportJob();

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
