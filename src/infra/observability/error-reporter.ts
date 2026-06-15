/**
 * Centralized error reporting.
 *
 * Every place that catches an error and decides "this is exceptional, not
 * user-flow noise" should call `errorReporter.captureException(...)`. The
 * reporter routes the error to whatever observability backend is wired in.
 *
 * Two callsite patterns:
 *
 *   1. **API errors** — the axios response interceptor calls `captureException`
 *      with a correlation ID, so a server-side log line can be matched to
 *      the client-side error one-to-one.
 *
 *   2. **Render errors** — the React `ErrorBoundary` calls `captureException`
 *      with the React component stack, so prod crashes have stack traces
 *      that reference the actual source files (with source maps, when
 *      Sentry's auth token is configured for upload).
 *
 * Reporter selection happens once at module load:
 *
 *   - If a Sentry DSN is configured (`NEXT_PUBLIC_SENTRY_DSN` for the
 *     client / `SENTRY_DSN` for the server), Sentry receives every event.
 *     Local logger output continues alongside Sentry so dev consoles stay
 *     useful and so a Sentry outage doesn't blank out errors.
 *
 *   - Else if `NEXT_PUBLIC_ERROR_REPORT_ENDPOINT` is set, errors are POST'd
 *     to that URL as structured JSON. Use this with the existing log
 *     infrastructure or a webhook your team already operates.
 *
 *   - Otherwise, errors go to the console via the unified logger. In dev
 *     this gives you a stack trace; in prod (with `NEXT_PUBLIC_LOG_LEVEL=warn`)
 *     it stays out of the way.
 *
 * @module infra/observability/error-reporter
 */

import * as Sentry from "@sentry/nextjs"
import { logger } from "@/shared/logger"

export interface ErrorContext {
  /** Per-request correlation ID for cross-stack tracing. */
  correlationId?: string
  /** Free-form tags surfaced in the reporter's UI / search. */
  tags?: Record<string, string>
  /** Free-form structured payload — request URL, status, user ID, etc. */
  extra?: Record<string, unknown>
}

export interface ErrorReporter {
  /**
   * Report a thrown error. The string `message` should be a high-level
   * label (e.g. "axios 500"); the actual stack lives on the Error.
   */
  captureException(error: unknown, context?: ErrorContext): void

  /**
   * Report a notable event that isn't an error per se ("user attempted
   * password reset 3 times in 60s"). Use sparingly — most things should
   * just be `logger.warn`.
   */
  captureMessage(message: string, context?: ErrorContext): void
}

/**
 * Default reporter — logs to the unified logger and (when configured) POSTs
 * structured JSON to NEXT_PUBLIC_ERROR_REPORT_ENDPOINT.
 *
 * The HTTP transport is fire-and-forget with `keepalive: true` so reports
 * survive page unloads (the user closes the tab right after an error). It
 * never throws — a broken reporter must never crash the app it's reporting on.
 */
class DefaultErrorReporter implements ErrorReporter {
  private readonly endpoint: string | undefined

  constructor() {
    // Read once at construction. Changing the env var requires a redeploy
    // anyway, so re-reading per call is wasted work.
    this.endpoint =
      typeof process !== "undefined" && typeof process.env !== "undefined"
        ? process.env.NEXT_PUBLIC_ERROR_REPORT_ENDPOINT
        : undefined
  }

  captureException(error: unknown, context?: ErrorContext): void {
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    const name = error instanceof Error ? error.name : "UnknownError"

    logger.error(`[reporter] ${name}: ${message}`, {
      correlationId: context?.correlationId,
      tags: context?.tags,
      extra: context?.extra,
      stack,
    })

    void this.send({
      kind: "exception",
      name,
      message,
      stack,
      ...this.flatten(context),
      ts: new Date().toISOString(),
    })
  }

  captureMessage(message: string, context?: ErrorContext): void {
    logger.warn(`[reporter] ${message}`, {
      correlationId: context?.correlationId,
      tags: context?.tags,
      extra: context?.extra,
    })

    void this.send({
      kind: "message",
      message,
      ...this.flatten(context),
      ts: new Date().toISOString(),
    })
  }

  private flatten(context?: ErrorContext): Record<string, unknown> {
    if (!context) return {}
    const out: Record<string, unknown> = {}
    if (context.correlationId) out.correlationId = context.correlationId
    if (context.tags) out.tags = context.tags
    if (context.extra) out.extra = context.extra
    return out
  }

  private async send(payload: Record<string, unknown>): Promise<void> {
    if (!this.endpoint) return
    if (typeof fetch === "undefined") return

    try {
      await fetch(this.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      })
    } catch {
      // Never throw from the reporter. A broken endpoint should not break
      // the user's session.
    }
  }
}

/**
 * Sentry-backed reporter. Used when a DSN is configured. Composes with the
 * default reporter so log output continues alongside Sentry — the local
 * console / log endpoint stays useful for dev, and a Sentry outage doesn't
 * silently swallow events.
 */
class SentryErrorReporter implements ErrorReporter {
  private readonly fallback = new DefaultErrorReporter()

  captureException(error: unknown, context?: ErrorContext): void {
    this.fallback.captureException(error, context)
    Sentry.captureException(error, scope => {
      if (context?.correlationId) scope.setTag("correlationId", context.correlationId)
      if (context?.tags) {
        for (const [k, v] of Object.entries(context.tags)) scope.setTag(k, v)
      }
      if (context?.extra) {
        for (const [k, v] of Object.entries(context.extra)) scope.setExtra(k, v)
      }
      return scope
    })
  }

  captureMessage(message: string, context?: ErrorContext): void {
    this.fallback.captureMessage(message, context)
    Sentry.captureMessage(message, scope => {
      if (context?.correlationId) scope.setTag("correlationId", context.correlationId)
      if (context?.tags) {
        for (const [k, v] of Object.entries(context.tags)) scope.setTag(k, v)
      }
      if (context?.extra) {
        for (const [k, v] of Object.entries(context.extra)) scope.setExtra(k, v)
      }
      return scope
    })
  }
}

function isSentryConfigured(): boolean {
  if (typeof process === "undefined" || typeof process.env === "undefined") return false
  return !!(process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN)
}

/**
 * Module-level singleton. Sentry when configured, default reporter otherwise.
 * Both callsite patterns (`captureException`, `captureMessage`) are identical
 * regardless of which backend is active.
 */
export const errorReporter: ErrorReporter = isSentryConfigured()
  ? new SentryErrorReporter()
  : new DefaultErrorReporter()

/** Test helper — construct a fresh default reporter that does not share state. */
export function createDefaultErrorReporter(): ErrorReporter {
  return new DefaultErrorReporter()
}
