// Application constants

export const APP_NAME = 'InsightHub';
export const APP_VERSION = '1.0.0';

// Subscription tiers
export const SUBSCRIPTION_TIERS = {
  FREE: 'free',
  STARTER: 'starter',
  PRO: 'pro',
  ENTERPRISE: 'enterprise',
} as const;

// User roles
export const USER_ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member',
  VIEWER: 'viewer',
} as const;

// Rate limits
export const RATE_LIMITS = {
  GENERAL: 100, // requests per minute
  AUTH: 10, // auth attempts per minute
  API: 1000, // API calls per minute for SDK
};

// Pagination
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
};

// Cache TTLs (seconds)
export const CACHE_TTL = {
  USER: 300, // 5 minutes
  ORGANIZATION: 300, // 5 minutes
  DASHBOARD: 60, // 1 minute
  ANALYTICS: 60, // 1 minute
};

// Widget refresh intervals (seconds)
export const WIDGET_REFRESH = {
  MIN: 10,
  DEFAULT: 300,
  MAX: 86400, // 24 hours
};

// Event types
export const EVENT_TYPES = {
  PAGE_VIEW: 'page_view',
  CLICK: 'click',
  FORM_SUBMIT: 'form_submit',
  PURCHASE: 'purchase',
  SIGNUP: 'signup',
  LOGIN: 'login',
  CUSTOM: 'custom',
};

// Notification types
export const NOTIFICATION_TYPES = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  SUCCESS: 'success',
};

// Dashboard layouts
export const DASHBOARD_LAYOUTS = {
  GRID: 'grid',
  LIST: 'list',
  FREEFORM: 'freeform',
};

// Widget types
export const WIDGET_TYPES = {
  CHART: 'chart',
  METRIC: 'metric',
  TABLE: 'table',
  TEXT: 'text',
};

// Chart types
export const CHART_TYPES = {
  BAR: 'bar',
  LINE: 'line',
  PIE: 'pie',
  DOUGHNUT: 'doughnut',
  AREA: 'area',
};

// Invoice statuses
export const INVOICE_STATUS = {
  DRAFT: 'draft',
  PENDING: 'pending',
  PAID: 'paid',
  FAILED: 'failed',
};

// Audit log actions
export const AUDIT_ACTIONS = {
  USER_REGISTERED: 'user.registered',
  USER_LOGGED_IN: 'user.logged_in',
  USER_LOGGED_OUT: 'user.logged_out',
  USER_UPDATED: 'user.updated',
  USER_INVITED: 'user.invited',
  USER_DELETED: 'user.deleted',
  USER_PASSWORD_CHANGED: 'user.password_changed',
  ORGANIZATION_UPDATED: 'organization.updated',
  ORGANIZATION_OWNERSHIP_TRANSFERRED: 'organization.ownership_transferred',
  DASHBOARD_CREATED: 'dashboard.created',
  DASHBOARD_UPDATED: 'dashboard.updated',
  DASHBOARD_DELETED: 'dashboard.deleted',
  WIDGET_CREATED: 'widget.created',
  WIDGET_UPDATED: 'widget.updated',
  WIDGET_DELETED: 'widget.deleted',
  APIKEY_CREATED: 'apikey.created',
  APIKEY_REVOKED: 'apikey.revoked',
  WEBHOOK_CREATED: 'webhook.created',
  WEBHOOK_UPDATED: 'webhook.updated',
  WEBHOOK_DELETED: 'webhook.deleted',
  BILLING_TIER_CHANGED: 'billing.tier_changed',
  ANALYTICS_EVENTS_DELETED: 'analytics.events_deleted',
  AUDIT_LOGS_DELETED: 'audit.logs_deleted',
};

// Error codes
export const ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
};

// WebSocket event types
export const WS_EVENTS = {
  SUBSCRIBE: 'subscribe',
  UNSUBSCRIBE: 'unsubscribe',
  DASHBOARD_UPDATE: 'dashboard_update',
  WIDGET_UPDATE: 'widget_update',
  NEW_NOTIFICATION: 'new_notification',
  BROADCAST_NOTIFICATION: 'broadcast_notification',
  DASHBOARD_CREATED: 'dashboard_created',
  USER_JOINED: 'user_joined',
  USER_LEFT: 'user_left',
};

// WebSocket close codes (4000-4999 is the range RFC 6455 leaves to applications)
export const WS_CLOSE_CODES = {
  TOKEN_EXPIRED: 4001,
};

// Date formats
export const DATE_FORMATS = {
  SHORT: 'MM/dd/yyyy',
  LONG: 'MMMM d, yyyy',
  WITH_TIME: 'MM/dd/yyyy HH:mm',
  ISO: "yyyy-MM-dd'T'HH:mm:ss.SSSxxx",
};
