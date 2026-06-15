/**
 * GET /api/theme/version — cheap polling endpoint for the theme watcher.
 * Returns the current monotonically-increasing publish counter.
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
    logger.error("[theme-version] Read failed:", err)
    return NextResponse.json({ error: "Failed to read version" }, { status: 500 })
  }
}
