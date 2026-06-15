/**
 * One-way promotion: a handwritten static entity → a JSON runtime entity.
 *
 * The convert flow is the dual of the materialize flow that already exists
 * — materialize takes a RuntimeEntity and writes source files; this takes
 * source files and writes a RuntimeEntity. After convert succeeds, the
 * source files are deleted, the i18n keys are moved to the dynamic
 * namespace, and the registry is regenerated.
 *
 * Transactional guarantees: every step that mutates state is captured by
 * the pre-flight snapshot so a failure mid-flow rolls back to the
 * exact pre-convert state. The rollback contract:
 *
 *   - Source files: restored from the snapshot (which captured them
 *     before deletion).
 *   - Runtime config: if `addEntityToConfig` succeeded but a later step
 *     failed, we call `removeEntityFromConfig` to drop the partial entry.
 *   - i18n files: `messages/<locale>/pages.json` and `pages_dynamic.json`
 *     are both snapshotted; restoreSnapshot puts them back verbatim.
 *   - Registry: re-running `npm run init-entities` after the snapshot
 *     restore returns the registry to its pre-convert state.
 *
 * Audit: every attempt (success + failure + rolled-back) appends one
 * JSONL row to `.entity-builder-backups/_audit.jsonl`. Audit writes are
 * best-effort — a failure to append the row never blocks the convert.
 */

import { promises as fs } from "node:fs"
import { execSync } from "node:child_process"
import path from "node:path"
import { logger } from "@/shared/logger"
import { assertSafePath } from "@/shared/utils/safe-path"
import {
  snapshotFiles,
  restoreSnapshot,
  type BackupSnapshot,
} from "@/features/admin-tools/entity-builder/server/backup"
import { getNamespaceSource, setSourceKey, unsetSourceKey } from "@/app/api/i18n/_lib/source-storage"
import { SUPPORTED_LOCALES } from "@/app/api/i18n/_lib/constants"
import { addEntityToConfig, removeEntityFromConfig } from "@/app/api/runtime/_lib/storage"
import {
  parseStaticConfig,
  type ParseRefusal,
} from "@/features/admin-tools/entity-converter/server/parse-static-config"

// ─── Configuration ──────────────────────────────────────────────────────────

const SOURCE_I18N_NAMESPACE = "pages"
const TARGET_I18N_NAMESPACE = "pages_dynamic"
const AUDIT_DIR = ".entity-builder-backups"
const AUDIT_FILE = path.join(AUDIT_DIR, "_audit.jsonl")

export interface ConvertOptions {
  /** Override for tests (tmpdir). Defaults to process.cwd(). */
  repoRoot?: string
  /** Override the audit actor; defaults to "anonymous". */
  actor?: string | null
  /** When true, skips the `npm run init-entities` subprocess (tests). */
  skipInitEntities?: boolean
}

// ─── Public result shapes ───────────────────────────────────────────────────

export interface PreviewResult {
  ok: true
  planned: {
    runtimeEntityId: string
    filesToDelete: string[]
    i18nKeysToMigrate: number
  }
}

export interface ConvertSuccess {
  ok: true
  runtimeEntityId: string
  backupId: string
  deletedFiles: string[]
  migratedI18nKeyCount: number
  redirectTo: string
  auditWarning?: string
}

export interface ConvertRefusal {
  ok: false
  status: 422
  reason: string
  filePath: string
}

export interface ConvertFailure {
  ok: false
  status: 500
  error: string
  backupId: string | null
  rolledBack: boolean
}

export type PreviewOutcome = PreviewResult | ConvertRefusal
export type ConvertOutcome = ConvertSuccess | ConvertRefusal | ConvertFailure

// ─── Preview (dry-run) ─────────────────────────────────────────────────────

export async function previewConvert(entityName: string, options: ConvertOptions = {}): Promise<PreviewOutcome> {
  const repoRoot = options.repoRoot ?? process.cwd()
  const parsed = await parseStaticConfig(entityName, { repoRoot })
  if (!parsed.ok) return refusalFromParse(parsed)

  const keys = await countI18nLeavesForEntity(entityName)
  return {
    ok: true,
    planned: {
      runtimeEntityId: parsed.entity.id,
      filesToDelete: parsed.sourcePaths.map(p => path.relative(repoRoot, p).replace(/\\/g, "/")),
      i18nKeysToMigrate: keys,
    },
  }
}

// ─── Convert (the real path) ────────────────────────────────────────────────

interface ConvertCtx {
  entityName: string
  actor: string | null
  repoRoot: string
  skipInit: boolean
}

async function applyConvert(
  ctx: ConvertCtx,
  parsedEntity: { id: string },
  sourcePaths: string[],
  completed: CompletedSteps,
): Promise<{ migratedCount: number; deletedFiles: string[] }> {
  const deletedFiles: string[] = []
  // 3. Insert. Refuse on duplicate id so a re-run after a partial earlier
  //    convert doesn't silently overwrite the prior copy.
  const { inserted } = await addEntityToConfig(parsedEntity)
  if (!inserted) {
    throw new Error(
      `Runtime entity "${parsedEntity.id}" already exists. Restore from the prior snapshot before re-running convert.`,
    )
  }
  completed.entityWritten = true

  // 4. Lift `pages.<entityName>` into `pages_dynamic.<id>`, per locale.
  const migratedCount = await migrateI18nForEntity(ctx.entityName, parsedEntity.id)
  completed.i18nMigrated = true

  // 5. Delete source files. Snapshot in step 2 covers these for rollback.
  for (const abs of sourcePaths) {
    await fs.unlink(assertSafePath(path.relative(ctx.repoRoot, abs)))
    deletedFiles.push(path.relative(ctx.repoRoot, abs).replace(/\\/g, "/"))
  }
  completed.sourcesDeleted = true

  // 6. Regenerate the static registry so it forgets the deleted entity.
  if (!ctx.skipInit) execSync("npm run init-entities", { cwd: ctx.repoRoot, stdio: "pipe" })

  return { migratedCount, deletedFiles }
}

export async function convertStaticEntity(entityName: string, options: ConvertOptions = {}): Promise<ConvertOutcome> {
  const ctx: ConvertCtx = {
    entityName,
    actor: options.actor ?? null,
    repoRoot: options.repoRoot ?? process.cwd(),
    skipInit: !!options.skipInitEntities,
  }

  // 1. Parse — refuses early on unsupported shapes. No mutation yet.
  const parsed = await parseStaticConfig(entityName, { repoRoot: ctx.repoRoot })
  if (!parsed.ok) return refusalFromParse(parsed)

  // 2. Snapshot every file we might mutate. snapshotFiles auto-includes
  //    messages/{en,ar}/pages.json; we also list pages_dynamic.json
  //    explicitly so a failure mid-migration can restore both sides.
  const snapshot = await safeSnapshot(parsed.sourcePaths, ctx)
  if (!snapshot.ok) return snapshot.failure

  const completed: CompletedSteps = { entityWritten: false, i18nMigrated: false, sourcesDeleted: false }
  try {
    const { migratedCount, deletedFiles } = await applyConvert(ctx, parsed.entity, parsed.sourcePaths, completed)
    const auditWarning = await appendConvertAudit({
      ts: new Date().toISOString(),
      actor: ctx.actor,
      kind: "convert",
      entityName,
      runtimeEntityId: parsed.entity.id,
      backupId: snapshot.id,
      migratedI18nKeyCount: migratedCount,
      deletedFiles,
      outcome: "success",
      error: null,
    })
    return {
      ok: true,
      runtimeEntityId: parsed.entity.id,
      backupId: snapshot.id,
      deletedFiles,
      migratedI18nKeyCount: migratedCount,
      redirectTo: `/builder?entity=${encodeURIComponent(parsed.entity.id)}`,
      ...(auditWarning ? { auditWarning } : {}),
    }
  } catch (err) {
    const errorMessage = (err as Error).message
    logger.error("[entity-converter] convert failed; rolling back", { entityName, err })
    const rolledBack = await rollback(parsed.entity.id, snapshot.id, completed, ctx.repoRoot, ctx.skipInit)
    await appendConvertAudit({
      ts: new Date().toISOString(),
      actor: ctx.actor,
      kind: "convert",
      entityName,
      runtimeEntityId: parsed.entity.id,
      backupId: snapshot.id,
      migratedI18nKeyCount: 0,
      deletedFiles: [],
      outcome: rolledBack ? "rolled-back" : "failed",
      error: errorMessage,
    })
    return {
      ok: false,
      status: 500,
      error: errorMessage,
      backupId: snapshot.id,
      rolledBack,
    }
  }
}

// ─── Rollback ───────────────────────────────────────────────────────────────

interface CompletedSteps {
  entityWritten: boolean
  i18nMigrated: boolean
  sourcesDeleted: boolean
}

// Pre-flight snapshot wrapper. Returns either `{ ok: true, id }` so the
// caller can pass id to rollback, or `{ ok: false, failure }` carrying a
// fully-formed 500 response (snapshot failure has nothing to roll back
// from).
type SnapshotOutcome = { ok: true; id: string } | { ok: false; failure: ConvertFailure }

async function safeSnapshot(sourcePaths: string[], ctx: ConvertCtx): Promise<SnapshotOutcome> {
  const filesToSnapshot: string[] = [
    ...sourcePaths.map(p => path.relative(ctx.repoRoot, p).replace(/\\/g, "/")),
    "messages/en/pages_dynamic.json",
    "messages/ar/pages_dynamic.json",
  ]
  let snap: BackupSnapshot
  try {
    snap = await snapshotFiles(filesToSnapshot)
  } catch (err) {
    const message = `snapshot failed: ${(err as Error).message}`
    await appendConvertAudit({
      ts: new Date().toISOString(),
      actor: ctx.actor,
      kind: "convert",
      entityName: ctx.entityName,
      runtimeEntityId: ctx.entityName,
      backupId: null,
      migratedI18nKeyCount: 0,
      deletedFiles: [],
      outcome: "failed",
      error: message,
    })
    return {
      ok: false,
      failure: { ok: false, status: 500, error: message, backupId: null, rolledBack: false },
    }
  }
  return { ok: true, id: snap.id }
}

async function rollback(
  runtimeEntityId: string,
  backupId: string,
  completed: CompletedSteps,
  repoRoot: string,
  skipInitEntities: boolean,
): Promise<boolean> {
  let ok = true
  try {
    // Drop the partial entity entry. restoreSnapshot DOES NOT touch
    // messages/_overrides/runtime/config.json (it's not under the
    // snapshotted paths), so we have to do this manually.
    if (completed.entityWritten) {
      await removeEntityFromConfig(runtimeEntityId)
    }
  } catch (err) {
    ok = false
    logger.error("[entity-converter] rollback: removeEntityFromConfig failed", err)
  }
  try {
    await restoreSnapshot(backupId)
  } catch (err) {
    ok = false
    logger.error("[entity-converter] rollback: restoreSnapshot failed", err)
  }
  // Re-run init-entities — the registry's view of the world is now back to
  // pre-convert, but the in-process module cache may still be stale. The
  // dev script picks this up on next reload; we run it here so manual
  // testing doesn't need a server restart.
  if (!skipInitEntities && completed.sourcesDeleted) {
    try {
      execSync("npm run init-entities", { cwd: repoRoot, stdio: "pipe" })
    } catch (err) {
      // Best-effort — registry regen failure after rollback isn't fatal.
      logger.warn("[entity-converter] rollback: init-entities reapply failed", err)
    }
  }
  return ok
}

// ─── i18n migration ────────────────────────────────────────────────────────

async function migrateI18nForEntity(entityName: string, runtimeEntityId: string): Promise<number> {
  let totalLeaves = 0
  for (const locale of SUPPORTED_LOCALES) {
    const pages = await getNamespaceSource(locale, SOURCE_I18N_NAMESPACE)
    const subtree = pages[entityName]
    if (!isPlainObject(subtree)) continue

    const leaves = collectLeafPaths(subtree as Record<string, unknown>, [])
    for (const leaf of leaves) {
      const value = leaf.value
      // The migration only carries string-leaf translations. Numeric or
      // boolean values in pages.json are unexpected — log and skip rather
      // than refuse, since pages.json is hand-authored.
      if (typeof value !== "string") {
        logger.warn("[entity-converter] skipping non-string leaf during migration", {
          entityName,
          locale,
          path: leaf.path,
        })
        continue
      }
      const targetKey = [runtimeEntityId, ...leaf.path].join(".")
      await setSourceKey(locale, TARGET_I18N_NAMESPACE, targetKey, value)
      totalLeaves += 1
    }

    // Remove the whole entityName subtree from pages.json in one shot.
    // unsetSourceKey with a single segment deletes the entire branch.
    await unsetSourceKey(locale, SOURCE_I18N_NAMESPACE, entityName)
  }
  // The migrated count includes every leaf moved across every locale.
  // For brand with ~30 leaves * 2 locales = ~60. We return total leaves
  // because the audit field reads more naturally that way.
  return totalLeaves
}

async function countI18nLeavesForEntity(entityName: string): Promise<number> {
  let total = 0
  for (const locale of SUPPORTED_LOCALES) {
    const pages = await getNamespaceSource(locale, SOURCE_I18N_NAMESPACE)
    const subtree = pages[entityName]
    if (!isPlainObject(subtree)) continue
    total += collectLeafPaths(subtree as Record<string, unknown>, []).length
  }
  return total
}

interface Leaf {
  path: string[]
  value: unknown
}

function collectLeafPaths(node: Record<string, unknown>, prefix: string[]): Leaf[] {
  const out: Leaf[] = []
  for (const [key, value] of Object.entries(node)) {
    if (isPlainObject(value)) {
      out.push(...collectLeafPaths(value as Record<string, unknown>, [...prefix, key]))
    } else {
      out.push({ path: [...prefix, key], value })
    }
  }
  return out
}

function isPlainObject(value: unknown): boolean {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

// ─── Audit ──────────────────────────────────────────────────────────────────

export type ConvertAuditOutcome = "success" | "failed" | "rolled-back"

export interface ConvertAuditEntry {
  ts: string
  actor: string | null
  kind: "convert"
  entityName: string
  runtimeEntityId: string
  backupId: string | null
  migratedI18nKeyCount: number
  deletedFiles: string[]
  outcome: ConvertAuditOutcome
  error: string | null
}

/**
 * Append one JSONL line. Returns a warning string when the write fails so
 * the caller can surface it on the success response without aborting the
 * whole convert.
 */
async function appendConvertAudit(entry: ConvertAuditEntry): Promise<string | null> {
  try {
    const safe = assertSafePath(AUDIT_FILE)
    await fs.mkdir(path.dirname(safe), { recursive: true })
    await fs.appendFile(safe, JSON.stringify(entry) + "\n", "utf8")
    return null
  } catch (err) {
    const message = `audit append failed: ${(err as Error).message}`
    logger.warn("[entity-converter] " + message, { entry })
    return message
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function refusalFromParse(parsed: ParseRefusal): ConvertRefusal {
  return {
    ok: false,
    status: 422,
    reason: parsed.reason,
    filePath: parsed.filePath,
  }
}
