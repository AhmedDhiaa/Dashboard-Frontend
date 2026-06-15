/**
 * /api/_test/sentry — Sentry end-to-end verification probe.
 *
 * Visit `/api/_test/sentry?token=<SENTRY_TEST_TOKEN>` (token mandatory) to
 * intentionally throw inside a server route. The expected outcome is a
 * Sentry "Test error from /api/_test/sentry" issue showing up within
 * seconds, carrying:
 *
 *   - the `x-correlation-id` request header echoed as a Sentry tag
 *   - the runtime tag (`nodejs` here, since route handlers run on Node)
 *   - the release/environment that the deploy set on `SENTRY_RELEASE` /
 *     `SENTRY_ENVIRONMENT`
 *   - readable file/line frames from the source map (Sentry CLI uploads
 *     server source maps as part of the deploy script)
 *
 * Why a token (not just dev-only):
 *   We need this in *every* environment to verify that the Sentry DSN,
 *   release, env, and source-map upload all wired up correctly during a
 *   real deploy. Gating dev-only would force a separate sentinel for
 *   prod, which drifts. A shared secret in `SENTRY_TEST_TOKEN` is enough
 *   to prevent random visitors / scrapers from filling the issue
 *   tracker with garbage.
 *
 * What it does NOT do:
 *   It does not catch the error or log it through `errorHandler` — the
 *   intent is to let the error reach Sentry's `onRequestError` hook
 *   exactly as a real prod incident would. A separate Sentry test for
 *   the *captured* path lives at /api/_test/sentry?mode=captured.
 */

import { NextResponse, type NextRequest } from "next/server"
import * as Sentry from "@sentry/nextjs"

export const dynamic = "force-dynamic"

class SentryProbeError extends Error {
  constructor(
    message: string,
    public readonly correlationId: string | null,
  ) {
    super(message)
    this.name = "SentryProbeError"
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Read at request time (not module load) so a deploy can rotate the
  // token without a restart, and so tests can flip the env var per-case.
  const TEST_TOKEN = process.env.SENTRY_TEST_TOKEN
  if (!TEST_TOKEN) {
    return NextResponse.json({ error: "SENTRY_TEST_TOKEN is not configured on this environment." }, { status: 503 })
  }
  const supplied = request.nextUrl.searchParams.get("token")
  if (supplied !== TEST_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const correlationId = request.headers.get("x-correlation-id")
  const mode = request.nextUrl.searchParams.get("mode") ?? "uncaught"

  // Attach diagnostic context that should appear on the Sentry issue.
  Sentry.setTag("probe", "sentry-e2e")
  if (correlationId) Sentry.setTag("correlation_id", correlationId)

  if (mode === "captured") {
    // Captured path: the error is reported via the SDK, not thrown — useful
    // for verifying the *manual* capture path works (the wrapper used by
    // `errorHandler.handle`).
    const err = new SentryProbeError("Test error from /api/_test/sentry (captured mode)", correlationId)
    Sentry.captureException(err)
    return NextResponse.json({
      probe: "ok",
      mode,
      correlationId,
      message: "Captured exception sent to Sentry. Check the issue tracker.",
    })
  }

  // Uncaught path: throw and let `onRequestError` (instrumentation.ts) ship
  // it. This is the closest mirror of a real prod incident.
  throw new SentryProbeError("Test error from /api/_test/sentry (uncaught mode)", correlationId)
}
