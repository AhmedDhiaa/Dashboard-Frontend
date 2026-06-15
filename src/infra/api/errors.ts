/**
 * HTTP-aware error utilities. The actual error *classes* (`AppError`, …)
 * now live in `@/shared/types/errors` so any layer can `instanceof`-check
 * them without crossing into infra. This file owns translation-key mapping,
 * retry, and async helpers — concerns that *do* belong in infra.
 *
 * Existing `import { AppError, getErrorMessage } from "@/infra/api"` callers
 * keep working via the re-exports below.
 */

export { getErrorMessage } from "@/shared/utils/error"
export {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  isAppError,
} from "@/shared/types/errors"

import { getErrorMessage } from "@/shared/utils/error"
import { isAppError } from "@/shared/types/errors"

/**
 * Map an error to a stable translation key. Returns `null` if no mapping
 * applies (caller should fall back to the embedded message).
 */
export function getErrorTranslationKey(error: unknown): string | null {
  if (!isAppError(error)) return null

  switch (error.code) {
    case "NETWORK_ERROR":
      return "network_error"
    case "AUTH_ERROR":
      return "unauthorized"
    case "AUTHORIZATION_ERROR":
      return "forbidden"
    case "NOT_FOUND":
      return "not_found"
    case "VALIDATION_ERROR":
      return "validation_failed"
    default:
      // HTTP_5xx (server errors) — surface as generic server error
      if (error.statusCode >= 500) return "server_error"
      return null
  }
}

/**
 * i18n-aware error message: looks up a translation by [getErrorTranslationKey],
 * then falls back to [getErrorMessage] for unmapped errors.
 *
 * `t` should be the `errors` namespace translator (`useT("errors")`).
 */
export function getLocalizedErrorMessage(error: unknown, t: (key: string) => string): string {
  const key = getErrorTranslationKey(error)
  if (key) return t(key)
  return getErrorMessage(error)
}
