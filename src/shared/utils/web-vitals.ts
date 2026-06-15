/**
 * Web Vitals Performance Monitoring
 *
 * Tracks Core Web Vitals (LCP, CLS, INP, FCP, TTFB, FID) and forwards
 * them to:
 *   - Sentry as a measurement on the active transaction (per-route P75
 *     visible in the Sentry "Web Vitals" dashboard).
 *   - Google Analytics, if `window.gtag` is present (legacy hook for
 *     teams that already have a GA pipeline).
 *   - A custom analytics endpoint, if `NEXT_PUBLIC_ANALYTICS_ENDPOINT`
 *     is set.
 *
 * Sentry is the load-bearing consumer for the production observability
 * dashboards (see `docs/runbooks/incident-response.md`). The other two
 * sinks are best-effort.
 */

import { logger } from "@/shared/logger"
import * as Sentry from "@sentry/nextjs"

export interface WebVitalsMetric {
  id: string
  name: "CLS" | "FCP" | "FID" | "INP" | "LCP" | "TTFB"
  value: number
  rating: "good" | "needs-improvement" | "poor"
  delta: number
  navigationType: string
}

/**
 * Report Web Vitals to analytics service
 * Override this function to send to your analytics provider (GA, Sentry, etc.)
 */
export function reportWebVitals(metric: WebVitalsMetric): void {
  // Log in development
  if (process.env.NODE_ENV === "development") {
    logger.debug("[Web Vitals]", {
      name: metric.name,
      value: Math.round(metric.value),
      rating: metric.rating,
      delta: Math.round(metric.delta),
    })
  }

  // Send to analytics in production
  if (typeof window !== "undefined" && process.env.NODE_ENV === "production") {
    // Sentry — primary sink for the production observability dashboard.
    // Web vitals come in as `measurements` on the active page-load
    // transaction so Sentry's built-in "Web Vitals" view rolls them up
    // per route (P75 of LCP/CLS/INP, etc.). Units follow the spec:
    // CLS is unitless; everything else is milliseconds.
    sendWebVitalToSentry(metric)

    // Google Analytics (if available)
    if (window.gtag) {
      window.gtag("event", metric.name, {
        value: Math.round(metric.value),
        metric_id: metric.id,
        metric_value: metric.value,
        metric_delta: metric.delta,
        metric_rating: metric.rating,
      })
    }

    // Custom analytics endpoint (if needed)
    if (process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT) {
      fetch(process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "web-vitals",
          metric: metric.name,
          value: metric.value,
          rating: metric.rating,
          timestamp: Date.now(),
        }),
      }).catch(err => {
        logger.error("[Web Vitals] Failed to send metric:", err)
      })
    }
  }
}

// CLS is unitless ("layout shift score"); the rest are durations in ms.
// The Sentry "Web Vitals" view keys off these unit strings.
const VITAL_UNIT: Record<WebVitalsMetric["name"], "" | "millisecond"> = {
  CLS: "",
  FCP: "millisecond",
  FID: "millisecond",
  INP: "millisecond",
  LCP: "millisecond",
  TTFB: "millisecond",
}

/**
 * Forward a Web Vital to Sentry. Two effects:
 *   1. Attach the value as a measurement (`measurements.cls`,
 *      `measurements.lcp`, …) on the active page-load transaction.
 *      Sentry's per-route Web Vitals dashboard reads these.
 *   2. Drop a breadcrumb tagged with the rating ("good" /
 *      "needs-improvement" / "poor") so a user-visible jank event that
 *      coincides with an error issue carries the vitals context.
 *
 * Failure-safe: if the Sentry SDK is a no-op (no DSN configured) or if
 * the transaction has already finished, both calls quietly return.
 */
function sendWebVitalToSentry(metric: WebVitalsMetric): void {
  try {
    const span = Sentry.getActiveSpan()
    if (span) {
      // Lowercased metric name matches Sentry's measurement convention
      // (e.g. `measurements.lcp`, not `measurements.LCP`).
      span.setAttribute(`measurements.${metric.name.toLowerCase()}`, metric.value)
    }
    Sentry.addBreadcrumb({
      category: "web-vital",
      level: metric.rating === "poor" ? "warning" : "info",
      message: `${metric.name} ${Math.round(metric.value)}${VITAL_UNIT[metric.name] ? "ms" : ""} (${metric.rating})`,
      data: {
        name: metric.name,
        value: metric.value,
        rating: metric.rating,
        navigationType: metric.navigationType,
      },
    })
  } catch (err) {
    // Sentry SDK errors must NEVER break the page. Log and move on.
    logger.warn("[Web Vitals] Sentry forward failed", err)
  }
}

// Type augmentation for window.gtag
declare global {
  interface Window {
    gtag?: (command: string, eventName: string, params: Record<string, string | number>) => void
  }
}
