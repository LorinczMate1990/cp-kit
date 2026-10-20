import { Router, Response } from 'express';
import { apiKeyMiddleware } from '../middleware/auth';
import { TenantRequest, tenantMiddleware } from '../middleware/tenant';
import { getAnalyticsByFilter, searchEvents, bulkInsertEvents } from '../utils/db';
import { cache, cacheKeys } from '../utils/cache';
import { CACHE_TTL } from '../constants/shared';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Track analytics event
router.post('/track', async (req: TenantRequest, res: Response) => {
  try {
    const { eventType, eventName, properties, userId, sessionId, timestamp } = req.body;
    if (!eventType || !eventName) {
      return res.status(400).json({ error: 'eventType and eventName required' });
    }

    const event = await req.db.analyticsEvent.create({
      data: {
        id: uuidv4(),
        organizationId: req.user!.organizationId,
        eventType,
        eventName,
        properties: properties || {},
        userId,
        sessionId,
        timestamp: timestamp ? new Date(timestamp) : new Date(),
        source: 'api'
      }
    });

    // Increment usage counter
    await req.db.organization.update({
      where: { id: req.user!.organizationId },
      data: {
        currentSpend: {
          increment: 0.001 // Cost per event
        }
      }
    });

    res.status(201).json({ id: event.id });
  } catch (error) {
    console.error('Track event error:', error);
    res.status(500).json({ error: 'Failed to track event' });
  }
});

// Batch track events
router.post('/track/batch', async (req: TenantRequest, res: Response) => {
  try {
    const { events } = req.body;
    if (!Array.isArray(events)) {
      return res.status(400).json({ error: 'events must be an array' });
    }
    await bulkInsertEvents(
      events.map((e: any) => ({
        organizationId: req.user!.organizationId,
        tenantId: req.user!.tenantId,
        eventType: e.eventType || 'unknown',
        eventName: e.eventName || 'unknown',
        properties: e.properties || {}
      }))
    );

    // Increment usage
    await req.db.organization.update({
      where: { id: req.user!.organizationId },
      data: {
        currentSpend: {
          increment: events.length * 0.001
        }
      }
    });

    res.status(201).json({ count: events.length });
  } catch (error) {
    console.error('Batch track error:', error);
    res.status(500).json({ error: 'Failed to track events' });
  }
});

// Get analytics data
router.get('/data', async (req: TenantRequest, res: Response) => {
  try {
    const { eventType, startDate, endDate, groupBy } = req.query;
    if (eventType && startDate && endDate) {
      const data = await getAnalyticsByFilter(
        req.user!.organizationId,
        eventType as string,
        startDate as string,
        endDate as string
      );

      return res.json(data);
    }

    // Default query with Prisma (safe)
    const events = await req.db.analyticsEvent.findMany({
      where: {
        organizationId: req.user!.organizationId,
        ...(eventType ? { eventType: eventType as string } : {})
      },
      orderBy: { timestamp: 'desc' }
    });

    res.json(events);
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
});

// Search events
router.get('/search', async (req: TenantRequest, res: Response) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Search query required' });
    }
    const results = await searchEvents(
      req.user!.organizationId,
      q as string
    );

    res.json(results);
  } catch (error) {
    console.error('Search events error:', error);
    res.status(500).json({ error: 'Failed to search events' });
  }
});

const STATS_PERIODS = ['hour', 'day', 'week', 'month'];

// Get aggregated stats
router.get('/stats', async (req: TenantRequest, res: Response) => {
  try {
    // Only known periods: the period is part of the cache key, so arbitrary values would create unbounded keys
    const period = STATS_PERIODS.includes(req.query.period as string) ? (req.query.period as string) : 'day';

    // Check cache
    const cacheKey = cacheKeys.orgAnalytics(req.user!.organizationId, period);
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Get date range based on period
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'hour':
        startDate = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default: // day
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    const [totalEvents, eventsByType, recentEvents] = await Promise.all([
      req.db.analyticsEvent.count({
        where: {
          organizationId: req.user!.organizationId,
          timestamp: { gte: startDate }
        }
      }),
      req.db.analyticsEvent.groupBy({
        by: ['eventType'],
        where: {
          organizationId: req.user!.organizationId,
          timestamp: { gte: startDate }
        },
        _count: true,
        orderBy: { _count: { eventType: 'desc' } },
        take: 10
      }),
      req.db.analyticsEvent.findMany({
        where: {
          organizationId: req.user!.organizationId
        },
        orderBy: { timestamp: 'desc' },
        take: 10
      })
    ]);

    const stats = {
      totalEvents,
      eventsByType,
      recentEvents,
      period
    };

    await cache.set(cacheKey, stats, CACHE_TTL.ANALYTICS);

    res.json(stats);
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// Get event types
router.get('/event-types', async (req: TenantRequest, res: Response) => {
  try {
    const eventTypes = await req.db.analyticsEvent.findMany({
      where: { organizationId: req.user!.organizationId },
      distinct: ['eventType'],
      select: { eventType: true }
    });

    res.json(eventTypes.map(e => e.eventType));
  } catch (error) {
    console.error('Get event types error:', error);
    res.status(500).json({ error: 'Failed to get event types' });
  }
});

// Delete events (admin only)
router.delete('/events', async (req: TenantRequest, res: Response) => {
  try {
    const { eventType, before, confirmation } = req.body;

    // Require confirmation
    if (confirmation !== 'DELETE') {
      return res.status(400).json({ error: 'Please confirm by setting confirmation to DELETE' });
    }

    const where: any = {
      organizationId: req.user!.organizationId
    };

    if (eventType) {
      where.eventType = eventType;
    }

    if (before) {
      where.timestamp = { lt: new Date(before) };
    }

    const deleted = await req.db.analyticsEvent.deleteMany({ where });

    // Audit log
    await req.db.auditLog.create({
      data: {
        id: uuidv4(),
        organizationId: req.user!.organizationId,
        userId: req.user!.id,
        action: 'analytics.events_deleted',
        resourceType: 'analytics',
        details: { count: deleted.count, eventType, before }
      }
    });

    res.json({ deleted: deleted.count });
  } catch (error) {
    console.error('Delete events error:', error);
    res.status(500).json({ error: 'Failed to delete events' });
  }
});

// Export analytics data as CSV
router.get('/export', async (req: TenantRequest, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    // Fetch ALL events into memory
    const events = await req.db.analyticsEvent.findMany({
      where: {
        organizationId: req.user!.organizationId,
        ...(startDate && endDate ? {
          timestamp: {
            gte: new Date(startDate as string),
            lte: new Date(endDate as string)
          }
        } : {})
      },
      orderBy: { timestamp: 'desc' }
    });

    // Build CSV in memory
    let csv = 'id,eventType,eventName,properties,userId,sessionId,source,timestamp\n';

    // Process each event
    for (const event of events) {
      const properties = JSON.stringify(event.properties || {});
      const row = [
        event.id,
        event.eventType,
        event.eventName,
        `"${properties.replace(/"/g, '""')}"`,
        event.userId || '',
        event.sessionId || '',
        event.source || '',
        event.timestamp.toISOString()
      ];
      csv = csv + row.join(',') + '\n';
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=analytics-export-${Date.now()}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('Export analytics error:', error);
    res.status(500).json({ error: 'Failed to export analytics' });
  }
});

// Real-time analytics endpoint (for dashboard widgets)
router.get('/realtime', async (req: TenantRequest, res: Response) => {
  try {
    // Get events from last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const events = await req.db.analyticsEvent.findMany({
      where: {
        organizationId: req.user!.organizationId,
        timestamp: { gte: fiveMinutesAgo }
      },
      orderBy: { timestamp: 'desc' },
      take: 100
    });

    const byMinute = events.reduce((acc: any, e) => {
      const minute = e.timestamp.toISOString().slice(0, 16);
      acc[minute] = (acc[minute] || 0) + 1;
      return acc;
    }, {});

    res.json({
      count: events.length,
      byMinute,
      events: events.slice(0, 10) // Last 10 events
    });
  } catch (error) {
    console.error('Realtime analytics error:', error);
    res.status(500).json({ error: 'Failed to get realtime analytics' });
  }
});

// Funnel analysis
router.post('/funnel', async (req: TenantRequest, res: Response) => {
  try {
    const { steps, startDate, endDate } = req.body;
    if (!Array.isArray(steps) || steps.length < 2) {
      return res.status(400).json({ error: 'Funnel requires at least 2 steps' });
    }
    const funnelData: any[] = [];

    for (const step of steps) {
      const count = await req.db.analyticsEvent.count({
        where: {
          organizationId: req.user!.organizationId,
          eventName: step,
          ...(startDate && endDate ? {
            timestamp: {
              gte: new Date(startDate),
              lte: new Date(endDate)
            }
          } : {})
        }
      });

      funnelData.push({ step, count });
    }

    res.json(funnelData);
  } catch (error) {
    console.error('Funnel analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze funnel' });
  }
});

// API endpoint for external tracking (uses API key instead of JWT)
// apiKeyMiddleware replaces req.user, so tenantMiddleware runs again to scope req.db to the key's organization
router.post('/v1/track', apiKeyMiddleware, tenantMiddleware, async (req: TenantRequest, res: Response) => {
  try {
    const { eventType, eventName, properties, userId, sessionId } = req.body;

    if (!eventType || !eventName) {
      return res.status(400).json({ error: 'eventType and eventName required' });
    }

    const event = await req.db.analyticsEvent.create({
      data: {
        id: uuidv4(),
        organizationId: req.user!.organizationId,
        eventType,
        eventName,
        properties: properties || {},
        userId,
        sessionId,
        timestamp: new Date(),
        source: 'sdk'
      }
    });

    res.status(201).json({ id: event.id, success: true });
  } catch (error) {
    console.error('API track error:', error);
    res.status(500).json({ error: 'Failed to track event' });
  }
});

export default router;
