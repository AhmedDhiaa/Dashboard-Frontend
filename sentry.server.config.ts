/**
 * Sentry — server-side (Node runtime) initialization.
 *
 * Loaded by `instrumentation.ts` for the `nodejs` runtime. Captures errors
 * thrown from API routes, server components, and server actions. The DSN
 * here is `SENTRY_DSN` (server-only — no NEXT_PUBLIC_ prefix) so the value
 * never enters the client bundle.
 */

import * as Sentry from "@sentry/nextjs"

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    release: process.env.SENTRY_RELEASE,
    // Mirrors the client-side default — 30 % error sampling caps damage
    // from a server-side error storm (DB outage, upstream 5xx) while
    // still surfacing every recurring bug within the first wave of
    // requests. Server errors are typically lower-volume than client
    // errors, but a routing-layer regression can still emit thousands
    // per second.
    sampleRate: Number(process.env.SENTRY_SAMPLE_RATE ?? "0.3"),
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
    enabled: process.env.NODE_ENV === "production" || process.env.SENTRY_DEBUG === "1",
    sendDefaultPii: false,
  })
}
