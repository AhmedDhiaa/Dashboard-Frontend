/**
 * Append-only Page Builder audit log.
 *
 * Mirrors `src/features/admin-tools/entity-builder/server/audit.ts`:
 * one JSONL line per CRUD operation under
 * `messages/_overrides/pages/_audit.jsonl`. Records the actor, wall-clock
 * time, target pageId, schema hash, and outcome.
 *
 * Audit is best-effort — a failure to append the audit line is logged but
 * does not block the underlying page CRUD. The line shape is stable
 * across operations to keep grep / jq queries simple.
 */

import { createHash } from "node:crypto"
import { promises as fs } from "node:fs"
import path from "node:path"
import { logger } from "@/shared/logger"
import { assertSafePath } from "@/shared/utils/safe-path"
import type { PageSchema } from "../schema/page-schema"
import { PAGES_DIR } from "./storage"

const AUDIT_FILE = path.join(PAGES_DIR, "_audit.jsonl")

export type AuditOperation = "create" | "update" | "delete" | "materialize"
export type AuditOutcome = "success" | "failure" | "refused"

export interface AuditEntry {
  timestamp: string
  actor: string | null
  operation: AuditOperation
  pageId: string
  outcome: AuditOutcome
  schemaHash: string | null
  blockCount: number | null
  error: string | null
}

export function hashSchema(schema: PageSchema): string {
  return createHash("sha256").update(JSON.stringify(schema)).digest("hex").slice(0, 16)
}

export async function appendAudit(entry: AuditEntry): Promise<void> {
  try {
    await fs.mkdir(assertSafePath(PAGES_DIR), { recursive: true })
    await fs.appendFile(assertSafePath(AUDIT_FILE), JSON.stringify(entry) + "\n")
  } catch (err) {
    logger.warn("[page-builder] audit append failed:", err)
  }
}
