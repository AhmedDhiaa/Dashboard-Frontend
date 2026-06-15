/**
 * POST /api/admin/git/commit
 *
 *   { message, files[], branch?, push?, dryRun? }
 *
 * `dryRun: true` is what the UI's confirmation step calls. It runs every
 * preflight check (allowlist, binary, protected-branch) and returns the
 * resolved file list + target branch — but never stages or commits.
 *
 * Refusal reasons map to HTTP codes:
 *   - out-of-scope-paths / binary-file / empty-message → 400
 *   - protected-branch / nothing-to-commit             → 409
 *   - git-error                                        → 500
 */

import { NextResponse, type NextRequest } from "next/server"
import { logger } from "@/shared/logger"
import { commit, CommitRefusedError, preview } from "@/features/admin-tools/git-bridge/server/commit"
import { appendGitAudit, type GitAuditOp, type GitAuditOutcome } from "@/features/admin-tools/git-bridge/server/audit"
import { gateRequest } from "../_lib/gate"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

interface CommitBody {
  message?: unknown
  files?: unknown
  branch?: unknown
  push?: unknown
  dryRun?: unknown
}

interface NormalizedRequest {
  message: string
  files: string[]
  branch: string | undefined
  push: boolean
  dryRun: boolean
}

function statusFor(reason: CommitRefusedError["reason"]): number {
  switch (reason) {
    case "out-of-scope-paths":
    case "binary-file":
    case "empty-message":
      return 400
    case "protected-branch":
    case "nothing-to-commit":
      return 409
    case "git-error":
    default:
      return 500
  }
}

function validateBody(body: CommitBody): NextResponse | NormalizedRequest {
  if (typeof body.message !== "string")
    return NextResponse.json({ error: "'message' must be a string" }, { status: 400 })
  if (!Array.isArray(body.files) || body.files.some(f => typeof f !== "string")) {
    return NextResponse.json({ error: "'files' must be a string[]" }, { status: 400 })
  }
  if (body.branch !== undefined && typeof body.branch !== "string") {
    return NextResponse.json({ error: "'branch' must be a string when provided" }, { status: 400 })
  }
  return {
    message: body.message,
    files: body.files as string[],
    branch: body.branch as string | undefined,
    push: Boolean(body.push),
    dryRun: Boolean(body.dryRun),
  }
}

function deriveOp(req: NormalizedRequest): GitAuditOp {
  if (req.dryRun) return "preview"
  return req.push ? "push" : "commit"
}

async function audit(
  actor: string | null,
  req: NormalizedRequest,
  outcome: GitAuditOutcome,
  details: Record<string, unknown>,
  error: string | null,
): Promise<void> {
  await appendGitAudit({ actor, op: deriveOp(req), dryRun: req.dryRun, details, outcome, error })
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const gate = await gateRequest()
  if (!gate.ok) return gate.response

  let body: CommitBody
  try {
    body = (await request.json()) as CommitBody
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 })
  }

  const validated = validateBody(body)
  if (validated instanceof NextResponse) return validated
  const req = validated

  const baseDetails = { files: req.files, branch: req.branch, push: req.push }

  try {
    const result = req.dryRun ? await preview(req) : await commit(req)
    logger.info("[git-bridge] commit", { actor: gate.actor, ...baseDetails, dryRun: req.dryRun })
    await audit(gate.actor, req, "success", { ...baseDetails, message: req.message.slice(0, 200) }, null)
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof CommitRefusedError) {
      await audit(gate.actor, req, "refused", { ...baseDetails, reason: err.reason }, err.message)
      return NextResponse.json(
        { error: err.message, reason: err.reason, details: err.details },
        { status: statusFor(err.reason) },
      )
    }
    logger.error("[git-bridge] commit failed:", err)
    await audit(gate.actor, req, "failure", baseDetails, (err as Error).message)
    return NextResponse.json({ error: "git commit failed" }, { status: 500 })
  }
}
