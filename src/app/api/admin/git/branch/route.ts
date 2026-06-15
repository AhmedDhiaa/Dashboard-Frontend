/**
 * Branch management.
 *
 *   GET                       — list local branches + current
 *   POST { name, from? }      — create + switch (errors → 400 / 500)
 *   POST { name, switch:true} — switch only
 */

import { NextResponse, type NextRequest } from "next/server"
import { logger } from "@/shared/logger"
import {
  createBranch,
  InvalidBranchNameError,
  listBranches,
  switchBranch,
} from "@/features/admin-tools/git-bridge/server/branch"
import { gateRequest } from "../_lib/gate"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(): Promise<NextResponse> {
  const gate = await gateRequest()
  if (!gate.ok) return gate.response
  try {
    const branches = await listBranches()
    return NextResponse.json({ branches })
  } catch (err) {
    logger.error("[git-bridge] list branches failed:", err)
    return NextResponse.json({ error: "list branches failed" }, { status: 500 })
  }
}

interface BranchBody {
  name?: unknown
  from?: unknown
  switch?: unknown
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const gate = await gateRequest()
  if (!gate.ok) return gate.response

  let body: BranchBody
  try {
    body = (await request.json()) as BranchBody
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 })
  }
  if (typeof body.name !== "string") return NextResponse.json({ error: "'name' must be a string" }, { status: 400 })
  if (body.from !== undefined && typeof body.from !== "string") {
    return NextResponse.json({ error: "'from' must be a string when provided" }, { status: 400 })
  }

  try {
    if (body.switch === true) {
      await switchBranch(body.name)
    } else {
      await createBranch(body.name, body.from)
    }
    return NextResponse.json({ name: body.name })
  } catch (err) {
    if (err instanceof InvalidBranchNameError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    logger.error("[git-bridge] branch op failed:", err)
    return NextResponse.json({ error: "branch operation failed" }, { status: 500 })
  }
}
