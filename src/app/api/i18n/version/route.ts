/**
 * GET /api/i18n/version — cheap polling endpoint.
 *
 * Returns the current monotonically-increasing version number. Clients hit
 * this on a short interval to detect when their cached translation overrides
 * are stale and need refetching from /api/i18n/overrides.
 */

import { NextResponse } from "next/server"
import { logger } from "@/shared/logger"
import { readVersion } from "../_lib/storage"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(): Promise<NextResponse> {
  try {
    const version = await readVersion()
    return NextResponse.json({ version }, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } })
  } catch (err) {
    logger.error("[i18n-version] Read failed:", err)
    return NextResponse.json({ error: "Failed to read version" }, { status: 500 })
  }
}
