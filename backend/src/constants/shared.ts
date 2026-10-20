// Copy of constants from shared/constants/index.ts, because the backend can't import `shared` yet.
// Names and values must stay identical to the originals: see ai-instructions/adr/shared-constants.md.
// Only the constants the backend uses are copied.

// Rate limits
export const RATE_LIMITS = {
  GENERAL: 100, // requests per minute
  AUTH: 10, // auth attempts per minute
};

// Cache TTLs (seconds)
export const CACHE_TTL = {
  ORGANIZATION: 300, // 5 minutes
  ANALYTICS: 60, // 1 minute
};

// WebSocket close codes (4000-4999 is the range RFC 6455 leaves to applications)
export const WS_CLOSE_CODES = {
  TOKEN_EXPIRED: 4001,
};
