/**
 * Page Builder file writer — wraps the existing entity-builder 7-gate
 * pipeline so materialize benefits from every gate without forking code.
 *
 * Pipeline (per spec §12, gates listed in inventory.json codegenPipeline):
 *
 *   1. Production env kill-switch (`APP_ALLOW_RUNTIME_CODEGEN`) —
 *      enforced at the route layer.
 *   2. CI scan — `scripts/check-codegen-flag.mjs`, repo-level.
 *   3. Permission gate — `requirePermission(ADMIN_PAGE_BUILDER)`, route layer.
 *   4. Rate limit — page-builder-materialize 5/min/IP (Phase 6 config).
 *   5. Path safety — `assertSafePath` on every emitted target (`persistGeneration`
 *      already asserts; this writer also runs the typecheck under
 *      `.entity-builder-cache/`, which is in `ALLOWED_ROOTS`).
 *   6. Sandbox typecheck — `typecheckPlannedFiles(...)` from entity-builder.
 *   7. Backup + audit — `snapshotFiles` + page-builder `appendAudit`.
 *
 * On any failure the whole batch rolls back via persistGeneration's
 * tracked-write contract — the source tree is never left half-written.
 */

import path from "node:path"
import { logger } from "@/shared/logger"
import { snapshotFiles } from "@/features/admin-tools/entity-builder/server/backup"
import { typecheckPlannedFiles } from "@/features/admin-tools/entity-builder/server/typecheck"
import { persistGeneration, WriteAborted } from "@/features/admin-tools/entity-builder/server/file-writer"
import { appendAudit, hashSchema } from "./audit"
import { findUnknownCustomBlocks, planPageGeneration, type PageCodeGenPlan } from "./code-generator"
import type { PageSchema } from "../schema/page-schema"

export interface MaterializeResult {
  filesWritten: string[]
  warnings: string[]
  backupId: string | null
  navigationSuggestion: PageCodeGenPlan["navigationSuggestion"]
}

export class MaterializeRefused extends Error {
  constructor(
    message: string,
    public readonly reason: "unknown-custom-block" | "typecheck-failed" | "write-failed",
    public readonly details?: unknown,
  ) {
    super(message)
  }
}

interface MaterializeOptions {
  actor: string | null
  /** When true, overwrite existing materialized files (re-materialize). */
  force?: boolean
}

export async function materializePage(schema: PageSchema, options: MaterializeOptions): Promise<MaterializeResult> {
  const { actor, force = true } = options
  const pageId = schema.id

  // ─── Gate: customBlock allowlist ──────────────────────────────────────
  const offenders = findUnknownCustomBlocks(schema)
  if (offenders.length > 0) {
    const names = offenders.map(o => `${o.id}:"${o.componentName}"`).join(", ")
    await appendAudit({
      timestamp: new Date().toISOString(),
      actor,
      operation: "materialize",
      pageId,
      outcome: "refused",
      schemaHash: hashSchema(schema),
      blockCount: schema.blocks.length,
      error: `Unknown custom-block components: ${names}`,
    })
    throw new MaterializeRefused(
      `Schema contains custom-block(s) whose componentName is not registered: ${names}`,
      "unknown-custom-block",
      { offenders },
    )
  }

  const plan = planPageGeneration(schema)

  // ─── Gate: backup snapshot of any files we're about to overwrite ──────
  const targetPaths = plan.files.map(f => f.path)
  const snapshot = await snapshotFiles(targetPaths)

  // ─── Gate: sandbox typecheck (runs `tsc --noEmit` against planned set) ─
  const typecheck = await typecheckPlannedFiles(plan.files)
  if (!typecheck.ok) {
    await appendAudit({
      timestamp: new Date().toISOString(),
      actor,
      operation: "materialize",
      pageId,
      outcome: "failure",
      schemaHash: hashSchema(schema),
      blockCount: schema.blocks.length,
      error: `tsc rejected planned files: ${typecheck.errors.slice(0, 3).join(" | ")}`,
    })
    throw new MaterializeRefused(
      `tsc --noEmit failed against planned files (${typecheck.errors.length} error(s))`,
      "typecheck-failed",
      { errors: typecheck.errors },
    )
  }

  // ─── Gate: persist with rollback + i18n merge + init-entities + lint --fix ─
  try {
    const result = await persistGeneration(plan, { force, refreshRegistry: false, lintFix: true })
    await appendAudit({
      timestamp: new Date().toISOString(),
      actor,
      operation: "materialize",
      pageId,
      outcome: "success",
      schemaHash: hashSchema(schema),
      blockCount: schema.blocks.length,
      error: null,
    })
    return {
      filesWritten: result.filesWritten,
      warnings: result.warnings,
      backupId: snapshot.id,
      navigationSuggestion: plan.navigationSuggestion,
    }
  } catch (err) {
    logger.error("[page-builder] materialize failed:", err)
    await appendAudit({
      timestamp: new Date().toISOString(),
      actor,
      operation: "materialize",
      pageId,
      outcome: "failure",
      schemaHash: hashSchema(schema),
      blockCount: schema.blocks.length,
      error: err instanceof Error ? err.message : "Unknown error",
    })
    if (err instanceof WriteAborted) {
      throw new MaterializeRefused(`Materialize aborted; ${err.message}`, "write-failed", {
        backupId: snapshot.id,
        cause: err.cause,
      })
    }
    throw err
  }
}

/**
 * Convenience for the route — returns the absolute disk path the
 * materialized page.tsx will land at. Used in the response body so the
 * UI can display "wrote 3 files at <path>" without re-deriving paths.
 */
export function materializedPageDir(pageId: string): string {
  return path.join("src", "app", "(dashboard)", "pages", pageId)
}
