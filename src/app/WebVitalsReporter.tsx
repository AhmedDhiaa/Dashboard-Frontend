"use client"

/**
 * Sends Core Web Vitals (LCP, CLS, INP, FCP, TTFB, FID) to the project's
 * [reportWebVitals] sink. Mounted once at the root layout. Renders nothing.
 */

import { useReportWebVitals } from "next/web-vitals"
import { reportWebVitals, type WebVitalsMetric } from "@/shared/utils/web-vitals"

export function WebVitalsReporter() {
  useReportWebVitals(metric => {
    // The shape is compatible with our WebVitalsMetric interface; cast narrowly.
    reportWebVitals(metric as unknown as WebVitalsMetric)
  })

  return null
}
