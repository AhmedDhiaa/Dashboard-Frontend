// ─── Constants ───────────────────────────────────────────────────────────────
export {
  PUBLIC_PATHS,
  MIDDLEWARE_BYPASS_PATHS,
  isPublicPath,
  isMiddlewareBypassPath,
  TOKEN_REFRESH_BUFFER_SECONDS,
  DEFAULT_TOKEN_LIFETIME_SECONDS,
  SESSION_STRATEGY,
  SESSION_REFETCH_INTERVAL_SECONDS,
  SESSION_REFETCH_ON_WINDOW_FOCUS,
  SESSION_MAX_AGE_SECONDS,
  JWT_UPDATE_AGE_SECONDS,
  OAUTH2_REQUEST_TIMEOUT_MS,
  OAUTH2_RETRY_ATTEMPTS,
  OAUTH2_RETRY_DELAY_MS,
} from "./auth-constants"

// ─── Utils ───────────────────────────────────────────────────────────────────
export {
  getSession,
  getAccessToken,
  getUserDisplayName,
  getUserInitials,
  isTokenExpired as isTokenExpiredTime,
  getTokenExpirationTime,
  formatAuthHeader,
  extractTokenFromHeader,
} from "./utils"

// ─── Hooks ───────────────────────────────────────────────────────────────────
export * from "./hooks/useAuth"
export * from "./hooks/useAppConfig"

// ─── OAuth2 (server-only refresh helper) ─────────────────────────────────────
export * from "./oauth2.service"

// ─── Application Config ──────────────────────────────────────────────────────
export * from "./application-config.service"
