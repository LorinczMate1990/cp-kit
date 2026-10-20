import { createClient } from 'redis';

// Shared state lives in Redis, not in the process: see ai-instructions/adr/stateless-backend.md
// No offline queue: while disconnected, commands fail immediately instead of hanging,
// so callers can fall back (e.g. skip the cache) rather than block the request.
export const redis = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  disableOfflineQueue: true
});

redis.on('error', (error) => console.error('Redis error:', error.message));

export const connectRedis = () =>
  redis.connect().catch((error) => console.error('Redis connection failed:', error.message));
