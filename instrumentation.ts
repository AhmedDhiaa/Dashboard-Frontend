/**
 * Next instrumentation — runtime-conditional Sentry init + startup safeguards.
 *
 * Next calls `register()` exactly once per process startup, before any
 * route handler or middleware runs. We branch on `NEXT_RUNTIME` to load the
 * matching Sentry config: the Node SDK for the server, the Edge SDK for
 * middleware / edge route handlers.
 *
 * Startup safeguards live in `./src/shared/safeguards/run-startup-safeguards`,
 * dynamic-imported only on the Node side. Keeping `process.exit` out of this
 * file is necessary — Sentry's value-injection loader transforms
 * `instrumentation.ts` for the Edge bundle too, where Node APIs aren't
 * supported.
 *
 * `onRequestError` is the Next 15+ hook for capturing route-handler errors
 * that don't propagate to the framework's default boundary — without it,
 * errors in Server Components and route handlers are logged by Next but
 * never reach Sentry.
 */

import * as Sentry from "@sentry/nextjs"

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { runStartupSafeguards } = await import("./src/shared/safeguards/run-startup-safeguards")
    runStartupSafeguards()
    await import("./sentry.server.config")
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config")
  }
}

export const onRequestError = Sentry.captureRequestError
