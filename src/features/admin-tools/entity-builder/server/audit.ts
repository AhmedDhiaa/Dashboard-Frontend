/**
 * Append-only generation audit log.
 *
 * Writes one JSONL line per attempted generation to
 * `messages/_overrides/entity-builder/_audit.jsonl`. Records the actor
 * (email/name from session), wall-clock time, schema hash, the planned
 * file count, and the outcome (success / failure / refused). Audit is
 * best-effort — a failure to write the audit line is logged but does
 * not block the generation itself.
 */

import { createHash } from "node:crypto"
import { promises as fs } from "node:fs"
import path from "node:path"
import { logger } from "@/shared/logger"
import { assertSafePath } from "@/shared/utils/safe-path"
import type { EntityBuilderSchema } from "../types/builder-schema"

const AUDIT_DIR = path.join(process.cwd(), "messages", "_overrides", "entity-builder")
const AUDIT_FILE = path.join(AUDIT_DIR, "_audit.jsonl")

export type AuditOutcome = "success" | "failure" | "refused"

export interface AuditEntry {
  timestamp: string
  actor: string | null
  entityName: string
  schemaHash: string
  outcome: AuditOutcome
  filesWritten: number
  warnings: number
  error: string | null
  /** Snapshot id captured before the write (for rollback). */
  backupId?: string | null
}

export function hashSchema(schema: EntityBuilderSchema): string {
  return createHash("sha256").update(JSON.stringify(schema)).digest("hex").slice(0, 16)
}

export async function appendAudit(entry: AuditEntry): Promise<void> {
  try {
    await fs.mkdir(assertSafePath(AUDIT_DIR), { recursive: true })
    await fs.appendFile(assertSafePath(AUDIT_FILE), JSON.stringify(entry) + "\n")
  } catch (err) {
    logger.warn("[entity-builder] audit append failed:", err)
  }
}
