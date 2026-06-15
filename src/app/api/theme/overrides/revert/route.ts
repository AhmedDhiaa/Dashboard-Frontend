/**
 * POST /api/theme/overrides/revert — discard the draft and reset it to the
 * currently-live tokens. No version bump — nothing changed for end users.
 */

import { NextResponse } from "next/server"
import { logger } from "@/shared/logger"
import { revertDraft } from "../../_lib/storage"
import { requireThemeAdmin } from "../../_lib/auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(): Promise<NextResponse> {
  const guard = await requireThemeAdmin()
  if (!guard.ok) return guard.response

  try {
    const store = await revertDraft()
    return NextResponse.json({
      stage: "draft",
      tokens: store.draft.tokens,
      version: store.version,
      updatedAt: store.draft.updatedAt,
      updatedBy: store.draft.updatedBy,
    })
  } catch (err) {
    logger.error("[theme-overrides] REVERT failed:", err)
    return NextResponse.json({ error: "Failed to revert draft" }, { status: 500 })
  }
}
