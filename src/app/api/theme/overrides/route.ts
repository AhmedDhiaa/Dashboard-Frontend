/**
 *   GET    /api/theme/overrides              – returns the live token map.
 *                                              Admin-only `?stage=draft` returns
 *                                              the unpublished draft instead.
 *   PATCH  /api/theme/overrides              – body { tokens }, writes to draft.
 *
 * Publish/revert live under sibling routes so each verb is one route file.
 */

import { NextResponse, type NextRequest } from "next/server"
import { logger } from "@/shared/logger"
import { readStore, saveDraft } from "../_lib/storage"
import { requireThemeAdmin } from "../_lib/auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

interface PatchBody {
  tokens?: unknown
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const stage = request.nextUrl.searchParams.get("stage")
    const store = await readStore()

    if (stage === "draft") {
      const guard = await requireThemeAdmin()
      if (!guard.ok) return guard.response
      return NextResponse.json({
        stage: "draft",
        tokens: store.draft.tokens,
        version: store.version,
        updatedAt: store.draft.updatedAt,
        updatedBy: store.draft.updatedBy,
      })
    }

    return NextResponse.json({
      stage: "live",
      tokens: store.live.tokens,
      version: store.version,
      updatedAt: store.live.updatedAt,
      updatedBy: store.live.updatedBy,
    })
  } catch (err) {
    logger.error("[theme-overrides] GET failed:", err)
    return NextResponse.json({ error: "Failed to read theme overrides" }, { status: 500 })
  }
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  for (const v of Object.values(value as Record<string, unknown>)) {
    if (typeof v !== "string") return false
  }
  return true
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const guard = await requireThemeAdmin()
  if (!guard.ok) return guard.response

  let body: PatchBody
  try {
    body = (await request.json()) as PatchBody
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 })
  }

  if (!isStringRecord(body.tokens)) {
    return NextResponse.json({ error: "'tokens' must be a Record<string, string>" }, { status: 400 })
  }

  try {
    const updatedBy = guard.session.user?.email ?? guard.session.user?.name ?? null
    const store = await saveDraft(body.tokens, updatedBy)
    return NextResponse.json({
      stage: "draft",
      tokens: store.draft.tokens,
      version: store.version,
      updatedAt: store.draft.updatedAt,
      updatedBy: store.draft.updatedBy,
    })
  } catch (err) {
    logger.error("[theme-overrides] PATCH failed:", err)
    return NextResponse.json({ error: "Failed to save draft" }, { status: 500 })
  }
}
