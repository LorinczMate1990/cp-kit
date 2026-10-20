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
