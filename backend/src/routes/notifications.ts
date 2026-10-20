import { Router, Response } from 'express';
import { TenantRequest } from '../middleware/tenant';
import { isNotFoundError } from '../utils/prismaErrors';
import { broadcastToOrg } from '../index';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Get user's notifications
router.get('/', async (req: TenantRequest, res: Response) => {
  try {
    const { unreadOnly, limit } = req.query;
    const notifications = await req.db.notification.findMany({
      where: {
        userId: req.user!.id,
        ...(unreadOnly === 'true' ? { isRead: false } : {})
      },
      orderBy: { createdAt: 'desc' },
      take: limit ? parseInt(limit as string) : 50
    });

    res.json(notifications);
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to get notifications' });
  }
});

// Get unread count
router.get('/unread-count', async (req: TenantRequest, res: Response) => {
  try {
    const count = await req.db.notification.count({
      where: {
        userId: req.user!.id,
        isRead: false
      }
    });

    res.json({ count });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

// Mark notification as read
router.put('/:notificationId/read', async (req: TenantRequest, res: Response) => {
  try {
    const { notificationId } = req.params;
    const notification = await req.db.notification.update({
      where: { id: notificationId, userId: req.user!.id },
      data: { isRead: true }
    });

    res.json(notification);
  } catch (error) {
    if (isNotFoundError(error)) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Mark all as read
router.put('/mark-all-read', async (req: TenantRequest, res: Response) => {
  try {
    await req.db.notification.updateMany({
      where: {
        userId: req.user!.id,
        isRead: false
      },
      data: { isRead: true }
    });

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

// Delete notification
router.delete('/:notificationId', async (req: TenantRequest, res: Response) => {
  try {
    const { notificationId } = req.params;
    await req.db.notification.delete({
      where: { id: notificationId, userId: req.user!.id }
    });

    res.json({ message: 'Notification deleted' });
  } catch (error) {
    if (isNotFoundError(error)) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    console.error('Delete notification error:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// Delete all notifications
router.delete('/', async (req: TenantRequest, res: Response) => {
  try {
    await req.db.notification.deleteMany({
      where: { userId: req.user!.id }
    });

    res.json({ message: 'All notifications deleted' });
  } catch (error) {
    console.error('Delete all notifications error:', error);
    res.status(500).json({ error: 'Failed to delete notifications' });
  }
});

// Create notification (internal use)
router.post('/', async (req: TenantRequest, res: Response) => {
  try {
    const { userId, type, title, message, link } = req.body;
    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message required' });
    }

    // Verify user is in same org
    const targetUser = await req.db.user.findFirst({
      where: {
        id: userId || req.user!.id,
        organizationId: req.user!.organizationId
      }
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found in organization' });
    }

    const notification = await req.db.notification.create({
      data: {
        id: uuidv4(),
        userId: targetUser.id,
        organizationId: req.user!.organizationId,
        type: type || 'info',
        title,
        message,
        link
      }
    });

    // Broadcast via WebSocket
    broadcastToOrg(req.user!.organizationId, {
      type: 'new_notification',
      userId: targetUser.id,
      data: notification
    });

    res.status(201).json(notification);
  } catch (error) {
    console.error('Create notification error:', error);
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

// Broadcast notification to all org members
router.post('/broadcast', async (req: TenantRequest, res: Response) => {
  try {
    const { type, title, message, link } = req.body;
    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message required' });
    }

    // Get all users in org
    const users = await req.db.user.findMany({
      where: {
        organizationId: req.user!.organizationId,
        isActive: true
      },
      select: { id: true }
    });
    const notifications = [];
    for (const user of users) {
      const notification = await req.db.notification.create({
        data: {
          id: uuidv4(),
          userId: user.id,
          organizationId: req.user!.organizationId,
          type: type || 'info',
          title,
          message,
          link
        }
      });
      notifications.push(notification);
    }

    // Broadcast via WebSocket
    broadcastToOrg(req.user!.organizationId, {
      type: 'broadcast_notification',
      data: { type, title, message, link }
    });

    res.status(201).json({ count: notifications.length });
  } catch (error) {
    console.error('Broadcast notification error:', error);
    res.status(500).json({ error: 'Failed to broadcast notification' });
  }
});

// Get notification preferences
router.get('/preferences', async (req: TenantRequest, res: Response) => {
  try {
    res.json({
      email: {
        enabled: true,
        digest: 'daily', // immediate, daily, weekly, never
        types: ['system', 'billing', 'team']
      },
      inApp: {
        enabled: true,
        types: ['all']
      },
      push: {
        enabled: false
      }
    });
  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({ error: 'Failed to get preferences' });
  }
});

// Update notification preferences
router.put('/preferences', async (req: TenantRequest, res: Response) => {
  try {
    const preferences = req.body;

    // Would save to database here
    console.log('Notification preferences update (not saved):', preferences);

    res.json(preferences);
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// Test notification (for debugging)
router.post('/test', async (req: TenantRequest, res: Response) => {
  try {
    const notification = await req.db.notification.create({
      data: {
        id: uuidv4(),
        userId: req.user!.id,
        organizationId: req.user!.organizationId,
        type: 'info',
        title: 'Test Notification',
        message: `This is a test notification created at ${new Date().toISOString()}`
      }
    });

    // Broadcast
    broadcastToOrg(req.user!.organizationId, {
      type: 'new_notification',
      userId: req.user!.id,
      data: notification
    });

    res.status(201).json(notification);
  } catch (error) {
    console.error('Test notification error:', error);
    res.status(500).json({ error: 'Failed to create test notification' });
  }
});

export default router;
