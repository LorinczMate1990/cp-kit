import { Request, Response, NextFunction } from 'express';
import { redis } from '../utils/redis';
import { RATE_LIMITS } from '../constants/shared';

// Fixed-window counters in Redis, shared by all instances (see ai-instructions/adr/stateless-backend.md).
// The window's TTL is set atomically with the first hit, so counters always expire.

const WINDOW_SECONDS = 60;

// Counts a request and returns the count in the current window and the seconds left, or null if Redis is unavailable
const hit = async (key: string): Promise<{ count: number; secondsLeft: number } | null> => {
  try {
    const [count, , secondsLeft] = (await redis
      .multi()
      .incr(key)
      .expire(key, WINDOW_SECONDS, 'NX')
      .ttl(key)
      .exec()) as number[];
    return { count, secondsLeft };
  } catch (error) {
    console.error('Rate limit check failed:', (error as Error).message);
    return null;
  }
};

const createRateLimiter = (name: string, maxRequests: number, message: string) =>
  async (req: Request, res: Response, next: NextFunction) => {
    const result = await hit(`ratelimit:${name}:${req.ip || 'unknown'}`);

    // Fail open: if Redis is unavailable, requests are not rate limited rather than all rejected
    if (result && result.count > maxRequests) {
      return res.status(429).json({ error: message, retryAfter: result.secondsLeft });
    }

    next();
  };

export const rateLimiter = createRateLimiter('api', RATE_LIMITS.GENERAL, 'Too many requests');

// Stricter rate limit for auth endpoints
export const authRateLimiter = createRateLimiter(
  'auth',
  RATE_LIMITS.AUTH,
  'Too many authentication attempts. Please try again later.'
);
