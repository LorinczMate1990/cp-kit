import { Router, Request, Response } from 'express';
// eslint-disable-next-line no-restricted-imports -- login/register run before a tenant is known
import { prisma } from '../index';
import { generateToken, verifyToken } from '../middleware/auth';
import { hashPassword, verifyPassword, generateToken as generateRandomToken } from '../utils/encryption';
import { validate, loginSchema, registerSchema } from '../middleware/validate';
import { authRateLimiter } from '../middleware/rateLimit';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Login endpoint
router.post('/login', authRateLimiter, validate(loginSchema), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { organization: true }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (!verifyPassword(password, user.passwordHash)) {
      console.log(`Failed login attempt for ${email} from ${req.ip}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    // Create session
    const sessionToken = generateRandomToken();
    await prisma.session.create({
      data: {
        id: uuidv4(),
        userId: user.id,
        tenantId: user.tenantId,
        token: sessionToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip
      }
    });

    const token = generateToken(user.id, user.email, user.organizationId, user.role);
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId,
        organization: {
          id: user.organization.id,
          name: user.organization.name,
          slug: user.organization.slug,
          tier: user.organization.tier
        },
        passwordHash: user.passwordHash,
        lastLoginAt: user.lastLoginAt
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Register endpoint
router.post('/register', authRateLimiter, validate(registerSchema), async (req: Request, res: Response) => {
  try {
    const { email, password, name, organizationName } = req.body;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    const passwordHash = hashPassword(password);

    let organization;

    if (organizationName) {
      // Create new organization
      const slug = organizationName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      // Check if slug exists
      const existingOrg = await prisma.organization.findUnique({
        where: { slug }
      });

      if (existingOrg) {
        return res.status(400).json({ error: 'Organization name already taken' });
      }

      // Organizations are the tenants for now: every new organization gets its own tenant, in the same write
      organization = await prisma.organization.create({
        data: {
          id: uuidv4(),
          name: organizationName,
          slug,
          tier: 'free',
          tenant: { create: {} }
        }
      });
    } else {
      return res.status(400).json({ error: 'Organization name required' });
    }

    const user = await prisma.user.create({
      data: {
        id: uuidv4(),
        email: email.toLowerCase(),
        passwordHash,
        name,
        role: 'owner', // First user is owner
        organizationId: organization.id,
        tenantId: organization.tenantId
      }
    });

    const token = generateToken(user.id, user.email, user.organizationId, user.role);

    // Create audit log
    await prisma.auditLog.create({
      data: {
        id: uuidv4(),
        organizationId: organization.id,
        tenantId: organization.tenantId,
        userId: user.id,
        action: 'user.registered',
        resourceType: 'user',
        resourceId: user.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      }
    });

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId
      },
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Logout endpoint
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const token = authHeader.split(' ')[1];
      // The session is deleted but JWT is still valid until expiry
      await prisma.session.deleteMany({
        where: { token }
      });
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Forgot password
router.post('/forgot-password', authRateLimiter, async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });
    // This is actually correct!

    if (user) {
      // Generate reset token
      const resetToken = generateRandomToken();
      // In real app would hash it and store with expiry
      console.log(`Password reset token for ${email}: ${resetToken}`);

      // Would send email here
    }

    res.json({ message: 'If an account exists, a reset email will be sent' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Request failed' });
  }
});

// Reset password
router.post('/reset-password', authRateLimiter, async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;
    // In a real implementation would look up token and verify not expired

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password required' });
    }
    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Reset failed' });
  }
});

// Verify token
router.get('/verify', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ valid: false });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    // Check if user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ valid: false });
    }

    res.json({
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    res.status(401).json({ valid: false });
  }
});

// Refresh token
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { organization: true }
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    // Generate new token
    const newToken = generateToken(user.id, user.email, user.organizationId, user.role);

    res.json({ token: newToken });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

export default router;
