import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../index';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-in-production';

const GENERIC_TOKEN_ERROR_MESSAGE = "User not found"; // Don't leak the exact reason

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    organizationId: string;
    tenantId: string;
    role: string;
  };
}

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header' });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId }
      });

      if (!user) {
        return res.status(401).json({ error: GENERIC_TOKEN_ERROR_MESSAGE});
      }

      if (!user.isActive) {
        return res.status(401).json({ error: GENERIC_TOKEN_ERROR_MESSAGE});
      }

      req.user = {
        id: user.id,
        email: user.email,
        organizationId: user.organizationId,
        tenantId: user.tenantId,
        role: user.role
      };

      next();
    } catch (jwtError) {
      console.log('JWT verification failed:', jwtError);
      return res.status(401).json({ error: GENERIC_TOKEN_ERROR_MESSAGE});
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Authentication error' });
  }
};

export const requireRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

export const requireOwnerOrAdmin = requireRole(['owner', 'admin']);
export const requireOwner = requireRole(['owner']);

export const generateToken = (userId: string, email: string, organizationId: string, role: string) => {
  return jwt.sign(
    { userId, email, organizationId, role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// Throws if the signature is invalid or the token is expired
export const verifyToken = (token: string) => {
  return jwt.verify(token, JWT_SECRET) as any;
};

export const apiKeyMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }

  try {
    const keyRecord = await prisma.apiKey.findFirst({
      where: {
        key: apiKey,
        isActive: true
      },
      include: {
        organization: true,
        createdBy: true
      }
    });

    if (!keyRecord) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    if (keyRecord.expiresAt && keyRecord.expiresAt < new Date()) {
      return res.status(401).json({ error: 'API key expired' });
    }

    prisma.apiKey.update({
      where: { id: keyRecord.id },
      data: { lastUsedAt: new Date() }
    });

    req.user = {
      id: keyRecord.createdBy.id,
      email: keyRecord.createdBy.email,
      organizationId: keyRecord.organizationId,
      tenantId: keyRecord.tenantId,
      role: 'api'
    };

    console.log(`API key used: ${apiKey} for org ${keyRecord.organizationId}`);

    next();
  } catch (error) {
    console.error('API key verification error:', error);
    return res.status(500).json({ error: 'Authentication error' });
  }
};
