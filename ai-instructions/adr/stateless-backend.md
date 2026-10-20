# ADR: Stateless backend

Status: Accepted · 2026-10-19

## Context

The backend keeps state inside the Node.js process:

- `utils/cache.ts`: an in-memory `Map` cache. Expired entries are only removed when read again, `cleanup()` is never
  scheduled, and keys include user-controlled input (e.g. the analytics `period` query string), so the number of
  keys is unbounded. This is a memory leak (the SRE complaint "memory usage grows over time").
- `middleware/rateLimit.ts`: request counters in a `Map`, never cleaned up (`cleanupRateLimits()` has no callers).
- `index.ts`: the WebSocket client registry (`wsClients`), whose empty per-organization sets are never removed.
- Job outputs on the local disk (`/tmp/reports`, `/tmp/exports`).

In-process state also makes the app **stateful**: with more than one instance, every instance has its own cache
(stale data after a change made through another instance), its own rate limit counters (the limit multiplies
with the number of instances), and its own WebSocket clients (a broadcast reaches only the clients connected to
the instance that sent it). A restart loses all of it.

Redis is already provisioned in `docker-compose.yml` (`REDIS_URL`) and `redis` is already a dependency, but unused.

## Decision

1. **The backend is stateless.** No request may depend on data that a previous request left in the memory or on
   the local disk of the same process. Any instance must be able to serve any request, and instances can be
   added, removed or restarted at any time without losing data.
2. **Shared state lives in Redis** (or PostgreSQL for durable data). This covers at least:
   - caching, with a TTL on every key and explicit invalidation;
   - rate limiting counters;
   - WebSocket fan-out: broadcasts go through Redis pub/sub so every instance delivers them to its own clients.
3. **The only allowed in-process state is:**
   - the `setInterval` timers that trigger background jobs. This is accepted **temporarily**: the timers hold no
     data, only a schedule. They must be replaced by a Redis-backed scheduler/queue (with locking, so a job runs
     once across all instances, not once per instance);
   - resources that can't be shared by nature and are rebuilt on restart: the open WebSocket connections of this
     instance, database and Redis connection pools;
   - immutable values computed at startup (configuration, constants, schema metadata such as `TENANT_MODELS`).
4. **No local disk for application data.** Generated reports and exports go to Redis (short-lived) or a shared
   store, not to the container's filesystem.

## Consequences

- The in-memory cache and rate limiter are replaced with Redis-backed implementations; `utils/cache.ts`'s `Map` goes away.
- Every cache key has a TTL, so memory is bounded by design instead of by cleanup jobs; cache keys must not be
  built from unbounded user input.
- A Redis outage affects the features that depend on it. Caching should degrade to "no cache" (fetch from the
  database) instead of failing the request.
- Until jobs move to a Redis-backed scheduler, running more than one instance still runs every job once per instance.
- Code review: new module-level mutable variables (`Map`, `Set`, arrays, counters) or local file writes are
  rejected unless they fall under decision 3.
