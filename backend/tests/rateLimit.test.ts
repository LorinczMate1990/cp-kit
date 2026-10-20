import { describe, it, expect, beforeEach } from '@jest/globals';

// redis.multi().incr().expire().ttl().exec() — every step returns the chain, exec resolves the replies
const chain: any = {
  incr: jest.fn(() => chain),
  expire: jest.fn(() => chain),
  ttl: jest.fn(() => chain),
  exec: jest.fn()
};
const mockRedis: any = { multi: jest.fn(() => chain) };

jest.mock('../src/utils/redis', () => ({
  redis: mockRedis
}));

import { rateLimiter, authRateLimiter } from '../src/middleware/rateLimit';

const run = async (limiter: any) => {
  const req: any = { ip: '1.2.3.4' };
  const res: any = {
    statusCode: 200,
    body: undefined,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    }
  };
  const next = jest.fn();
  await limiter(req, res, next);
  return { res, next };
};

describe('Rate limiter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    chain.exec.mockReset();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('lets requests through within the limit', async () => {
    chain.exec.mockResolvedValue([100, 0, 30]);

    const { res, next } = await run(rateLimiter);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
    expect(chain.incr).toHaveBeenCalledWith('ratelimit:api:1.2.3.4');
    // The window's TTL is set only on the first hit, atomically with the increment
    expect(chain.expire).toHaveBeenCalledWith('ratelimit:api:1.2.3.4', 60, 'NX');
  });

  it('rejects requests over the limit with the seconds left in the window', async () => {
    chain.exec.mockResolvedValue([101, 0, 30]);

    const { res, next } = await run(rateLimiter);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(429);
    expect(res.body).toEqual({ error: 'Too many requests', retryAfter: 30 });
  });

  it('applies the stricter auth limit on its own counter', async () => {
    chain.exec.mockResolvedValue([11, 0, 30]);

    const { res, next } = await run(authRateLimiter);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(429);
    expect(chain.incr).toHaveBeenCalledWith('ratelimit:auth:1.2.3.4');
  });

  it('fails open when Redis is unavailable', async () => {
    chain.exec.mockRejectedValue(new Error('The client is closed'));

    const { res, next } = await run(rateLimiter);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
  });
});
