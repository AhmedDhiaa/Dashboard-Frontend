/**
 * Sentry — edge runtime initialization.
 *
 * Loaded by `instrumentation.ts` for the `edge` runtime (Next middleware,
 * route handlers with `export const runtime = "edge"`). The edge build of
 * `@sentry/nextjs` is much smaller and uses Web APIs only.
 */

import * as Sentry from "@sentry/nextjs"

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    release: process.env.SENTRY_RELEASE,
    sampleRate: 1.0,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
    enabled: process.env.NODE_ENV === "production" || process.env.SENTRY_DEBUG === "1",
    sendDefaultPii: false,
  })
}
