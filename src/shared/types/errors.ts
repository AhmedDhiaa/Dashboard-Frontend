/**
 * Domain-agnostic error classes.
 *
 * These are pure value types — no axios, no fetch, no transport details — so
 * they live in `shared/` and any layer can `instanceof`-check them. The
 * HTTP-aware shaping (statusCode → class, axios interceptor mapping) stays
 * in `@/infra/api`, which constructs these and attaches `correlationId`.
 */

export class AppError extends Error {
  /**
   * Per-request correlation ID, set by the axios error path when this error
   * came from a network call. Undefined for errors raised in pure code (form
   * validation, etc.). Surface this in user-facing error messages so support
   * can grep across logs by ID.
   */
  public correlationId?: string

  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: unknown,
  ) {
    super(message)
    this.name = "AppError"
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, "VALIDATION_ERROR", 400, details)
    this.name = "ValidationError"
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = "Authentication failed") {
    super(message, "AUTH_ERROR", 401)
    this.name = "AuthenticationError"
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = "Access denied") {
    super(message, "AUTHORIZATION_ERROR", 403)
    this.name = "AuthorizationError"
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, "NOT_FOUND", 404)
    this.name = "NotFoundError"
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
}
