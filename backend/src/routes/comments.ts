import { Router, Response } from 'express';
import { TenantRequest } from '../middleware/tenant';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Get comments for a resource
router.get('/:resourceType/:resourceId', async (req: TenantRequest, res: Response) => {
  try {
    const { resourceType, resourceId } = req.params;

    const comments = await req.db.comment.findMany({
      where: {
        resourceType,
        resourceId,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json(comments);
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ error: 'Failed to get comments' });
  }
});

// Create comment
router.post('/', async (req: TenantRequest, res: Response) => {
  try {
    const { content, resourceType, resourceId, parentId } = req.body;
    if (!content || !resourceType || !resourceId) {
      return res.status(400).json({ error: 'Content, resourceType, and resourceId required' });
    }

    const comment = await req.db.comment.create({
      data: {
        id: uuidv4(),
        content,
        userId: req.user!.id,
        resourceType,
        resourceId,
        parentId,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    res.status(201).json(comment);
  } catch (error) {
    console.error('Create comment error:', error);
    res.status(500).json({ error: 'Failed to create comment' });
  }
});

// Update comment
router.put('/:commentId', async (req: TenantRequest, res: Response) => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Content required' });
    }
    const comment = await req.db.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (comment.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Not authorized to edit this comment' });
    }

    const updated = await req.db.comment.update({
      where: { id: commentId },
      data: { content },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Update comment error:', error);
    res.status(500).json({ error: 'Failed to update comment' });
  }
});

// Delete comment
router.delete('/:commentId', async (req: TenantRequest, res: Response) => {
  try {
    const { commentId } = req.params;

    const comment = await req.db.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (comment.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Not authorized to delete this comment' });
    }
    await req.db.comment.delete({
      where: { id: commentId },
    });

    res.json({ message: 'Comment deleted' });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

export default router;
