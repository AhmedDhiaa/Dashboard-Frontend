/**
 * Centralized Error Handling
 *
 * Single source of truth for API error mapping, logging, redirect handling,
 * and the application-wide error handler service / hook.
 */

import { AxiosError } from "axios"
import { logger } from "@/shared/logger"
import { getSafePath } from "@/shared/utils/url"
import { isPublicPath } from "@/infra/auth/auth-constants"
import { AppError, AuthenticationError, AuthorizationError, NotFoundError, ValidationError, isAppError } from "./errors"

// ─── Status → Error class mapping ────────────────────────────────────────────

const ERROR_MAP: Record<number, typeof AppError> = {
  400: ValidationError,
  401: AuthenticationError,
  403: AuthorizationError,
  404: NotFoundError,
}

/**
 * Convert API error response to AppError
 */
export function createAppError(status: number, message: string, code?: string, details?: unknown): AppError {
  const ErrorClass = ERROR_MAP[status] || AppError

  if (ErrorClass === ValidationError) {
    return new ValidationError(message, details)
  }
  if (ErrorClass === AuthenticationError) {
    return new AuthenticationError(message)
  }
  if (ErrorClass === AuthorizationError) {
    return new AuthorizationError(message)
  }
  if (ErrorClass === NotFoundError) {
    const resource = extractResourceFromMessage(message)
    return new NotFoundError(resource)
  }

  return new AppError(message, code || `HTTP_${status}`, status, details)
}

function extractResourceFromMessage(message: string): string {
  const patterns = [/(?:cannot find|not found|doesn't exist)\s+(\w+)/i, /(\w+)\s+(?:not found|doesn't exist)/i]

  for (const pattern of patterns) {
    const match = message.match(pattern)
    if (match && match[1]) {
      return match[1]
    }
  }

  return "Resource"
}

// ─── Axios error → AppError pipeline ─────────────────────────────────────────

interface ApiErrorContext {
  correlationId?: string
  method?: string
  url?: string
  status?: number
  duration?: number
  errorMessage?: string
  errorDetails?: unknown
  timestamp: string
}

export function calculateErrorDuration(error: AxiosError): number | undefined {
  const startTime = error.config?.metadata?.startTime
  return startTime ? Date.now() - startTime : undefined
}

/**
 * Extract error context for logging
 */
export function extractErrorContext(error: AxiosError<{ message?: string; errors?: unknown }>): ApiErrorContext {
  const duration = calculateErrorDuration(error)

  return {
    correlationId: error.config?.metadata?.correlationId,
    method: error.config?.method?.toUpperCase(),
    url: error.config?.url,
    status: error.response?.status,
    duration,
    errorMessage: error.response?.data?.message || error.message,
    errorDetails: error.response?.data?.errors,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Log API error with context
 */
export function logApiError(error: AxiosError<{ message?: string; errors?: unknown }>): void {
  const context = extractErrorContext(error)
  const statusText = error.response?.status || "NETWORK"
  const methodText = context.method || "UNKNOWN"
  const url = context.url || "unknown"

  logger.error(`✖ ${statusText} ${methodText} ${url}`, context)
}

/**
 * Create AppError from Axios error response
 */
export function createErrorFromResponse(
  error: AxiosError<{ message?: string; errors?: unknown; error?: unknown }>,
): AppError {
  if (!error.response) {
    return new AppError("Network error - please check your connection", "NETWORK_ERROR", 0)
  }

  const status = error.response.status
  const responseData = error.response.data

  // Backend might send error in different formats:
  // 1. {error: {message: "...", validationErrors: [...]}}
  // 2. {message: "...", errors: [...]}
  // 3. {message: "..."}
  let message = error.message || "An error occurred"
  let details = undefined

  if (responseData) {
    if (typeof responseData === "object" && "error" in responseData) {
      const nestedError = responseData.error as Record<string, unknown>
      message = (nestedError.message as string) || message
      details = nestedError
    } else {
      message = responseData.message || message
      details = responseData.errors || responseData
    }
  }

  if (status === 401) {
    return new AuthenticationError(message)
  } else if (status === 403) {
    return new AuthorizationError(message)
  }

  return new AppError(message, `HTTP_${status}`, status, details)
}

// ─── Redirect handling for auth/authz errors ─────────────────────────────────

/**
 * Handle authentication error - redirect to login. NextAuth's signOut isn't
 * called here because the redirect itself drops the user out of the protected
 * area; the server will reject the stale cookie on the next protected hit.
 */
export async function handleAuthenticationError(): Promise<void> {
  if (typeof window === "undefined") return

  const currentPath = getSafePath(window.location.pathname)
  window.location.href = `/auth/login?redirectTo=${encodeURIComponent(currentPath)}&error=SessionError`
}

/**
 * Handle authorization error - redirect to 403 page or login if session expired
 */
export async function handleAuthorizationError(): Promise<void> {
  if (typeof window === "undefined") return

  const currentPath = window.location.pathname
  if (isPublicPath(currentPath)) {
    logger.info(`Authorization error on public path ${currentPath}, ignoring redirect`)
    return
  }

  // Distinguish "expired session" from "real 403". `getSession()` re-runs the
  // jwt callback; if the session lacks an access token or carries an error, we
  // treat this as auth-not-authz and redirect to login.
  const { getSession } = await import("next-auth/react")
  const session = (await getSession()) as { accessToken?: string; error?: string } | null
  const sessionValid = !!session?.accessToken && !session.error

  if (!sessionValid) {
    logger.warn(`Authorization error but session is invalid, redirecting to login from ${currentPath}`)
    await handleAuthenticationError()
  } else {
    logger.warn(`Access denied on ${currentPath}, redirecting to 403`)
    window.location.href = "/403"
  }
}

/**
 * Handle error redirects based on error type
 */
export async function handleErrorRedirects(appError: AppError): Promise<void> {
  if (appError instanceof AuthenticationError) {
    await handleAuthenticationError()
  } else if (appError instanceof AuthorizationError) {
    await handleAuthorizationError()
  }
}

// ─── Generic error handling helpers ──────────────────────────────────────────

/**
 * Handle error and return user-friendly message
 */
export function handleError(error: unknown): {
  message: string
  code: string
  shouldRedirect: boolean
  redirectTo?: string
} {
  if (error instanceof AppError) {
    logger.error(`AppError [${error.code}]:`, error)

    const redirectTo =
      error instanceof AuthenticationError ? "/auth/login" : error instanceof AuthorizationError ? "/403" : undefined

    const result: {
      message: string
      code: string
      shouldRedirect: boolean
      redirectTo?: string
    } = {
      message: error.message,
      code: error.code,
      shouldRedirect: error instanceof AuthenticationError || error instanceof AuthorizationError,
    }

    if (redirectTo !== undefined) {
      result.redirectTo = redirectTo
    }

    return result
  }

  if (error instanceof Error && error.message.includes("Network")) {
    logger.error("Network error:", error)
    return {
      message: "Network error - please check your connection",
      code: "NETWORK_ERROR",
      shouldRedirect: false,
    }
  }

  if (error instanceof Error) {
    logger.error("Unhandled error:", error)
    return {
      message: error.message || "An unexpected error occurred",
      code: "UNKNOWN_ERROR",
      shouldRedirect: false,
    }
  }

  // String error — pass through verbatim so the original signal isn't lost
  if (typeof error === "string") {
    logger.error("String error:", error)
    return {
      message: error,
      code: "UNKNOWN_ERROR",
      shouldRedirect: false,
    }
  }

  logger.error("Unknown error type:", error)
  return {
    message: "An unexpected error occurred",
    code: "UNKNOWN_ERROR",
    shouldRedirect: false,
  }
}

/**
 * Global error handler for uncaught errors
 */
export function setupGlobalErrorHandlers(): void {
  if (typeof window === "undefined") return

  window.addEventListener("unhandledrejection", event => {
    logger.error("Unhandled promise rejection:", event.reason)
    event.preventDefault()
  })

  window.addEventListener("error", event => {
    logger.error("Global error:", event.error)
  })
}

/**
 * Error boundary helper - extract error info for display
 */
export function getErrorInfo(error: Error): {
  title: string
  message: string
  stack?: string
  canRetry: boolean
} {
  if (error instanceof AppError) {
    const result: { title: string; message: string; stack?: string; canRetry: boolean } = {
      title: error.code.replace(/_/g, " "),
      message: error.message,
      canRetry: !(error instanceof AuthenticationError || error instanceof AuthorizationError),
    }

    if (process.env.NODE_ENV === "development" && error.stack !== undefined) {
      result.stack = error.stack
    }

    return result
  }

  const result: { title: string; message: string; stack?: string; canRetry: boolean } = {
    title: "Application Error",
    message: error.message || "An unexpected error occurred",
    canRetry: true,
  }

  if (process.env.NODE_ENV === "development" && error.stack !== undefined) {
    result.stack = error.stack
  }

  return result
}

// ─── Application-wide ErrorHandler service + hook ────────────────────────────

export interface ErrorContext {
  component?: string
  action?: string
  userId?: string
  metadata?: Record<string, unknown>
}

class ErrorHandlerService {
  handle(error: unknown, context?: ErrorContext): void {
    const errorMessage = this.extractMessage(error)
    const errorCode = this.extractCode(error)
    logger.error(`Error in ${context?.component ?? "Unknown"}`, {
      message: errorMessage,
      code: errorCode,
      action: context?.action,
      userId: context?.userId,
      metadata: context?.metadata,
      error,
    })
  }

  async handleAsync<T>(operation: () => Promise<T>, context?: ErrorContext): Promise<T | null> {
    try {
      return await operation()
    } catch (error) {
      this.handle(error, context)
      return null
    }
  }

  wrap<T extends (...args: never[]) => unknown>(
    fn: T,
    context?: ErrorContext,
  ): (...args: Parameters<T>) => ReturnType<T> | undefined {
    return (...args: Parameters<T>): ReturnType<T> | undefined => {
      try {
        return fn(...args) as ReturnType<T>
      } catch (error) {
        this.handle(error, context)
        return undefined
      }
    }
  }

  private extractMessage(error: unknown): string {
    if (isAppError(error)) return error.message
    if (error instanceof Error) return error.message
    if (typeof error === "string") return error
    return "An unknown error occurred"
  }

  private extractCode(error: unknown): string {
    if (isAppError(error)) return error.code
    if (error instanceof Error) return error.name
    return "UNKNOWN_ERROR"
  }
}

/**
 * Application-wide error handler service. Public API: external code MAY
 * import this singleton directly to log errors with structured context.
 * @public
 */
export const errorHandler = new ErrorHandlerService()
