/**
 * Client-side instrumentation entry point.
 *
 * Next 15+ runs this file once on the client before any other code. Sentry's
 * v10 docs name it as the canonical client init location — the older
 * `sentry.client.config.ts` is deprecated and stops working under Turbopack.
 * Per the Next docs (https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation-client)
 * the file may live at the project root or under `src/` — root keeps it
 * adjacent to the matching server `instrumentation.ts`.
 *
 * Configuration is identical to the prior sentry.client.config.ts: DSN from
 * NEXT_PUBLIC_SENTRY_DSN, traces sample rate from env, gated by NODE_ENV so
 * `npm run dev` doesn't burn telemetry quota.
 */

import * as Sentry from "@sentry/nextjs"

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
    // Error sample rate: the env var is the knob. Default 0.3 in production
    // (30 % of error events) is enough to catch every recurring error type
    // — a real bug hits dozens of sessions in the first hour, so 30 %
    // surfaces it on the first wave without burning quota during a 4xx
    // flood. The reporter wrapper already filters expected 4xx upstream;
    // this rate guards against unexpected error storms (network outage,
    // 3rd-party SDK regression) that could otherwise consume a day of
    // quota in minutes. Raise to 1.0 via env for short investigations.
    sampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_SAMPLE_RATE ?? "0.3"),
    // Performance traces: 10 % in prod is plenty to see hot routes; raise
    // for short investigations via the env var.
    tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
    // Don't ship breadcrumbs / events in dev unless DEBUG is on — we don't
    // want every `npm run dev` console.error to count against the quota.
    enabled: process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_SENTRY_DEBUG === "1",
    sendDefaultPii: false,
  })
}

// Forward router transitions to Sentry for navigation timing instrumentation.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
