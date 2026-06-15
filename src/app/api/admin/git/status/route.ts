/**
 * GET /api/admin/git/status — scoped working-tree status.
 *
 * Returns only paths inside the allowlist defined in
 * `features/admin-tools/git-bridge/server/paths.ts`. The UI groups the
 * response by `category` so the admin sees translation changes / entity
 * changes / page-builder changes as separate sections.
 */

import { NextResponse } from "next/server"
import { logger } from "@/shared/logger"
import { getScopedStatus } from "@/features/admin-tools/git-bridge/server/status"
import { gateRequest } from "../_lib/gate"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(): Promise<NextResponse> {
  const gate = await gateRequest()
  if (!gate.ok) return gate.response

  try {
    const report = await getScopedStatus()
    return NextResponse.json(report)
  } catch (err) {
    logger.error("[git-bridge] status failed:", err)
    return NextResponse.json({ error: "git status failed" }, { status: 500 })
  }
}
