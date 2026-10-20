import { redis } from './redis';

// Redis-backed cache, shared by all instances (see ai-instructions/adr/stateless-backend.md).
// Every key has a TTL, so memory is bounded by design. If Redis is unavailable the cache is skipped:
// reads miss and writes are dropped, so requests fall back to the database instead of failing.

const PREFIX = 'cache:';

export const cache = {
  async get<T>(key: string): Promise<T | undefined> {
    try {
      const value = await redis.get(PREFIX + key);
      return value === null ? undefined : (JSON.parse(value) as T);
    } catch (error) {
      console.error(`Cache read failed for ${key}:`, (error as Error).message);
      return undefined;
    }
  },

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      await redis.set(PREFIX + key, JSON.stringify(value), { EX: ttlSeconds });
    } catch (error) {
      console.error(`Cache write failed for ${key}:`, (error as Error).message);
    }
  },

  async delete(key: string): Promise<void> {
    try {
      await redis.del(PREFIX + key);
    } catch (error) {
      console.error(`Cache delete failed for ${key}:`, (error as Error).message);
    }
  },

  // Deletes every key that starts with the given prefix
  async deleteByPrefix(prefix: string): Promise<void> {
    try {
      for await (const key of redis.scanIterator({ MATCH: `${PREFIX}${prefix}*`, COUNT: 100 })) {
        await redis.del(key);
      }
    } catch (error) {
      console.error(`Cache delete failed for ${prefix}*:`, (error as Error).message);
    }
  }
};

// Cache key generators. Keys must not contain unbounded user input, or the number of keys is unbounded too.
export const cacheKeys = {
  organization: (orgId: string) => `org:${orgId}`,
  orgAnalytics: (orgId: string, period: string) => `org:${orgId}:analytics:${period}`
};
