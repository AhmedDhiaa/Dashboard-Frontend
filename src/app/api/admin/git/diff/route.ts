/**
 * GET /api/admin/git/diff?file=<path>
 *
 * Returns the unified diff for one allowlisted path, capped at 200 KB.
 * Paths outside the allowlist → 400 (not 404) so the UI knows the route
 * exists and the input is what's wrong.
 */

import { NextResponse, type NextRequest } from "next/server"
import { logger } from "@/shared/logger"
import { DiffOutOfScopeError, getFileDiff } from "@/features/admin-tools/git-bridge/server/diff"
import { badRequest, gateRequest } from "../_lib/gate"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: NextRequest): Promise<NextResponse> {
  const gate = await gateRequest()
  if (!gate.ok) return gate.response

  const filePath = request.nextUrl.searchParams.get("file")
  if (!filePath) return badRequest("Query param 'file' is required")

  try {
    const result = await getFileDiff(filePath)
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof DiffOutOfScopeError) {
      return badRequest(err.message, { received: err.received })
    }
    logger.error("[git-bridge] diff failed:", err)
    return NextResponse.json({ error: "git diff failed" }, { status: 500 })
  }
}
