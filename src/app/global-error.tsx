/**
 * Root global-error boundary — captures React render errors that escape
 * every other error.tsx and reports them to Sentry.
 *
 * Next renders this only when the root layout itself throws, so it must
 * supply its own <html><body> wrapper. The body is intentionally minimal:
 * we delegate the visible UI to next/error so the boundary doesn't depend
 * on any code that might have just crashed (theme tokens, i18n provider,
 * design-system primitives all live above this file in the tree).
 *
 * Verbatim template from Sentry's "React Render Errors in App Router"
 * section of the manual-setup guide:
 * https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/#react-render-errors-in-app-router
 */
"use client"

import * as Sentry from "@sentry/nextjs"
import NextError from "next/error"
import { useEffect } from "react"

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html>
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  )
}
