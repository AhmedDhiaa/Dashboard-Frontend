/**
 * JSONL audit log for `/api/admin/git/*` operations.
 *
 * Mirrors the shape of `src/features/admin-tools/entity-builder/server/audit.ts`
 * so anyone reading the audit trail across surfaces sees one consistent
 * record format: one JSON object per line, append-only, never rotated by
 * this code (operators rotate the file out-of-band).
 *
 * What lives in the line:
 *   - `timestamp`   ISO-8601 of when the request resolved.
 *   - `actor`       email or display name extracted from the session; null
 *                   if the session lacks both (shouldn't happen — the gate
 *                   guarantees a user — but null-safe so a future config
 *                   change can't crash logging).
 *   - `op`          which git verb fired (`commit`, `push`, `revert`,
 *                   `branch-create`, `branch-checkout`).
 *   - `dryRun`      true if the call was a preflight that never mutated
 *                   the working tree. Recorded so reviewers can tell
 *                   "considered" from "executed".
 *   - `details`     op-specific payload (branch name, file count, refs).
 *   - `outcome`     "success" | "refused" | "failure".
 *   - `error`       string or null. Populated on refused / failure.
 *
 * Why JSONL: append is O(1), every line is a complete record (no header /
 * dangling-comma footguns), and `tail -F | jq` works without any tooling.
 *
 * Storage path: under `messages/_overrides/` — the same volume mount used
 * by every other admin-tool audit, so the deploy story (Docker volume,
 * IIS file permissions) is solved already.
 */

import { promises as fs } from "node:fs"
import path from "node:path"
import { assertSafePath } from "@/shared/utils/safe-path"
import { logger } from "@/shared/logger"

const AUDIT_DIR = path.join(process.cwd(), "messages", "_overrides", "git-bridge")
const AUDIT_FILE = path.join(AUDIT_DIR, "_audit.jsonl")

export type GitAuditOutcome = "success" | "refused" | "failure"
export type GitAuditOp = "commit" | "push" | "revert" | "branch-create" | "branch-checkout" | "preview"

export interface GitAuditEntry {
  timestamp: string
  actor: string | null
  op: GitAuditOp
  dryRun: boolean
  details: Record<string, unknown>
  outcome: GitAuditOutcome
  error: string | null
}

/**
 * Append one audit entry. Best-effort — a logging failure must NEVER
 * propagate to the caller (we don't want the operation itself to fail
 * because logging hit ENOSPC). Errors go to the standard logger so the
 * operator still has a trace in the application log.
 */
export async function appendGitAudit(entry: Omit<GitAuditEntry, "timestamp"> & { timestamp?: string }): Promise<void> {
  const full: GitAuditEntry = {
    timestamp: entry.timestamp ?? new Date().toISOString(),
    actor: entry.actor,
    op: entry.op,
    dryRun: entry.dryRun,
    details: entry.details,
    outcome: entry.outcome,
    error: entry.error,
  }
  try {
    await fs.mkdir(assertSafePath(AUDIT_DIR), { recursive: true })
    await fs.appendFile(assertSafePath(AUDIT_FILE), JSON.stringify(full) + "\n", "utf8")
  } catch (err) {
    logger.warn("[git-bridge/audit] append failed; entry was:", full, err)
  }
}
