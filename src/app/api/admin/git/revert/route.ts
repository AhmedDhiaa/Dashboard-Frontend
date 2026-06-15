/**
 * POST /api/admin/git/revert
 *
 *   { files: string[] }
 *
 * Restores each allowlisted path to HEAD. Paths outside the allowlist
 * are SILENTLY filtered (returned in `refused` for the UI's "we
 * dropped these" message) rather than failing the whole batch — the
 * spec calls for partial-success semantics so a stale UI doesn't block
 * the user.
 */

import { NextResponse, type NextRequest } from "next/server"
import { logger } from "@/shared/logger"
import { revertFiles } from "@/features/admin-tools/git-bridge/server/revert"
import { gateRequest } from "../_lib/gate"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

interface RevertBody {
  files?: unknown
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const gate = await gateRequest()
  if (!gate.ok) return gate.response

  let body: RevertBody
  try {
    body = (await request.json()) as RevertBody
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 })
  }
  if (!Array.isArray(body.files) || body.files.some(f => typeof f !== "string")) {
    return NextResponse.json({ error: "'files' must be a string[]" }, { status: 400 })
  }

  try {
    const result = await revertFiles(body.files as string[])
    logger.info("[git-bridge] revert", { actor: gate.actor, reverted: result.reverted, refused: result.refused })
    return NextResponse.json(result)
  } catch (err) {
    logger.error("[git-bridge] revert failed:", err)
    return NextResponse.json({ error: "git revert failed" }, { status: 500 })
  }
}
