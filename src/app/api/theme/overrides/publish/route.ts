/**
 * POST /api/theme/overrides/publish — promote draft → live, bump version.
 * Admin-gated (Api.Theme.Manage). Idempotent in body (no payload required).
 */

import { NextResponse } from "next/server"
import { logger } from "@/shared/logger"
import { publishDraft } from "../../_lib/storage"
import { requireThemeAdmin } from "../../_lib/auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(): Promise<NextResponse> {
  const guard = await requireThemeAdmin()
  if (!guard.ok) return guard.response

  try {
    const updatedBy = guard.session.user?.email ?? guard.session.user?.name ?? null
    const store = await publishDraft(updatedBy)
    return NextResponse.json({
      stage: "live",
      tokens: store.live.tokens,
      version: store.version,
      updatedAt: store.live.updatedAt,
      updatedBy: store.live.updatedBy,
    })
  } catch (err) {
    logger.error("[theme-overrides] PUBLISH failed:", err)
    return NextResponse.json({ error: "Failed to publish theme" }, { status: 500 })
  }
}
