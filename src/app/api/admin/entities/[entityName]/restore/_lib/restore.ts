/**
 * Inverse of `convertStaticEntity` — promote a backup back into the
 * static source tree.
 *
 * Convert's transactional contract (Part 1.2) snapshotted six files
 * before doing any mutation:
 *
 *   - the 3 source files (.config.tsx + .schema.ts + .types.ts)
 *   - messages/{en,ar}/pages.json (the pre-convert state, brand subtree
 *     still present)
 *   - messages/{en,ar}/pages_dynamic.json (the pre-convert state,
 *     brand subtree NOT YET present)
 *
 * So `restoreSnapshot(backupId)` alone reverses the i18n migration AND
 * recreates the source files — there's no per-key migration to do. The
 * only piece NOT under the snapshot is `messages/_overrides/runtime/
 * config.json`, which the convert wrote into AFTER the snapshot was
 * taken; we drop the entity from it manually.
 *
 * Safety contract:
 *
 *   - A NEW snapshot of CURRENT state is taken before any write, so
 *     a mid-restore failure can `restoreSnapshot(safetyId)` to return
 *     to the post-convert state exactly.
 *   - If the safety restore itself fails (disk fault), we log loudly
 *     and return `partialState: "half-restored"` — the admin must
 *     hand-recover from either snapshot.
 *
 * Backup-shape validation: a convert backup is identified by the
 * presence of `messages/<locale>/pages_dynamic.json` in the snapshot
 * directory. Materialize backups don't include those files. A naked
 * file-writer backup likewise doesn't. Refusing to "restore" a non-
 * convert backup keeps this route from corrupting unrelated state.
 */

import { promises as fs } from "node:fs"
import { existsSync } from "node:fs"
import { execSync } from "node:child_process"
import path from "node:path"
import { logger } from "@/shared/logger"
import { assertSafePath } from "@/shared/utils/safe-path"
import {
  BACKUP_DIR,
  restoreSnapshot,
  snapshotFiles,
  type BackupSnapshot,
} from "@/features/admin-tools/entity-builder/server/backup"
import { getNamespaceSource } from "@/app/api/i18n/_lib/source-storage"
import { SUPPORTED_LOCALES } from "@/app/api/i18n/_lib/constants"
import { removeEntityFromConfig } from "@/app/api/runtime/_lib/storage"

// ─── Public surface ─────────────────────────────────────────────────────────

export interface RestoreOptions {
  backupId: string
  /** Plan only — no fs writes. */
  dryRun: boolean
  /** Audit actor; passed through verbatim. */
  actor?: string | null
  /** Override for tests; defaults to process.cwd(). */
  repoRoot?: string
  /** Skip `npm run init-entities` (tests). */
  skipInitEntities?: boolean
}

export interface RestoreSuccess {
  ok: true
  restoredFiles: string[]
  removedRuntimeId: string
  migratedI18nKeyCount: number
  safetyBackupId: string
}

export interface RestoreRefusal {
  ok: false
  status: 422
  reason: string
}

export interface RestoreFailure {
  ok: false
  status: 500
  error: string
  partialState: "untouched" | "half-restored"
  rolledBack: boolean
  safetyBackupId: string | null
}

export type RestoreResult = RestoreSuccess | RestoreRefusal | RestoreFailure

export interface RestorePreview {
  ok: true
  planned: {
    backupId: string
    runtimeEntityId: string
    filesToRestore: string[]
    estimatedI18nKeyCount: number
  }
}

export type RestoreOutcome = RestoreResult | RestorePreview

/** Preview-only outcome — never carries `RestoreFailure`. */
export type PreviewOutcome = RestorePreview | RestoreRefusal

// ─── Constants ──────────────────────────────────────────────────────────────

const AUDIT_FILE = path.join(".entity-builder-backups", "_audit.jsonl")
const RUNTIME_CONFIG_REL = "messages/_overrides/runtime/config.json"

const PAGES_DYNAMIC_FILES: readonly string[] = SUPPORTED_LOCALES.map(loc => `messages/${loc}/pages_dynamic.json`)

// ─── Entry points ──────────────────────────────────────────────────────────

export async function previewRestore(entityName: string, options: RestoreOptions): Promise<PreviewOutcome> {
  const inspected = await inspectBackup(options.backupId)
  if (!inspected.ok) return inspected
  if (!inspected.containsEntity(entityName)) {
    return refusal(`Backup does not contain a source file for "${entityName}"`)
  }
  const estimatedCount = await countLeavesInBackupPages(options.backupId, entityName)
  return {
    ok: true,
    planned: {
      backupId: options.backupId,
      runtimeEntityId: entityName,
      filesToRestore: inspected.files,
      estimatedI18nKeyCount: estimatedCount,
    },
  }
}

export async function restoreStaticEntity(entityName: string, options: RestoreOptions): Promise<RestoreResult> {
  if (options.dryRun) {
    // Dry-run is a different return shape; this function's signature
    // is the WRITE path. Callers route dryRun → previewRestore.
    return failure(`restoreStaticEntity called with dryRun=true; use previewRestore`, "untouched", null, false)
  }

  // 1-2. Validate the backup exists AND has the convert-shape files.
  const inspected = await inspectBackup(options.backupId)
  if (!inspected.ok) return inspected
  if (!inspected.containsEntity(entityName)) {
    return refusal(`Backup does not contain a source file for "${entityName}"`)
  }

  // 3. Safety snapshot of CURRENT state — anything the restore is about
  // to overwrite, plus the runtime config which isn't under the convert
  // backup's paths.
  let safetyBackup: BackupSnapshot
  try {
    safetyBackup = await snapshotFiles([...inspected.files, ...PAGES_DYNAMIC_FILES, RUNTIME_CONFIG_REL])
  } catch (err) {
    return failure(`Safety snapshot failed: ${(err as Error).message}`, "untouched", null, false)
  }

  return runRestore({ entityName, options, inspected, safetyBackup })
}

// ─── Core flow (extracted to keep restoreStaticEntity under the line gate) ─

interface RestoreCtx {
  entityName: string
  options: RestoreOptions
  inspected: BackupOk
  safetyBackup: BackupSnapshot
}

async function runRestore(ctx: RestoreCtx): Promise<RestoreResult> {
  const { entityName, options, safetyBackup } = ctx
  try {
    // 4-5-6. restoreSnapshot writes back every file the convert had
    // captured: source files AND both pages.json AND both
    // pages_dynamic.json. No per-key migration needed.
    const { restored, warnings } = await restoreSnapshot(options.backupId)
    if (warnings.length > 0) {
      logger.warn("[entity-converter:restore] restoreSnapshot warnings", { warnings })
    }

    // 7. Drop the entity from the runtime config. The convert wrote it
    // AFTER taking the snapshot, so restoreSnapshot doesn't touch it.
    await removeEntityFromConfig(entityName)

    // 8. Regenerate the static registry so the freshly-restored
    // .config.tsx is loaded.
    if (!options.skipInitEntities) {
      execSync("npm run init-entities", { cwd: options.repoRoot ?? process.cwd(), stdio: "pipe" })
    }

    const migratedI18nKeyCount = await countLeavesInLivePages(entityName)
    await appendRestoreAudit({
      ts: new Date().toISOString(),
      actor: options.actor ?? null,
      kind: "restore",
      entityName,
      backupId: options.backupId,
      safetyBackupId: safetyBackup.id,
      restoredFiles: restored,
      removedRuntimeId: entityName,
      migratedI18nKeyCount,
      outcome: "success",
      error: null,
    })

    return {
      ok: true,
      restoredFiles: restored,
      removedRuntimeId: entityName,
      migratedI18nKeyCount,
      safetyBackupId: safetyBackup.id,
    }
  } catch (err) {
    return rollback(ctx, err)
  }
}

async function rollback(ctx: RestoreCtx, originalErr: unknown): Promise<RestoreFailure> {
  const errorMessage = (originalErr as Error).message ?? String(originalErr)
  logger.error("[entity-converter:restore] write failed; rolling back", { err: originalErr })
  try {
    // restoreSnapshot only resurrects files that EXISTED at safety-
    // snapshot time. The 3 source files the convert deleted aren't in
    // the safety snapshot (they were absent), so restoreSnapshot won't
    // remove them after our step-4 brought them back. Unlink the gap
    // explicitly so "rolledBack: untouched" actually means untouched.
    const safetyFiles = new Set(ctx.safetyBackup.files)
    for (const rel of ctx.inspected.files) {
      if (safetyFiles.has(rel)) continue
      try {
        await fs.unlink(assertSafePath(rel))
      } catch {
        // If unlink fails (file already gone, perm error), the
        // restoreSnapshot below STILL leaves the live tree in a
        // recoverable state — just not byte-for-byte. Logged via the
        // half-restored catch path if it cascades.
      }
    }
    await restoreSnapshot(ctx.safetyBackup.id)
    if (!ctx.options.skipInitEntities) {
      try {
        execSync("npm run init-entities", { cwd: ctx.options.repoRoot ?? process.cwd(), stdio: "pipe" })
      } catch {
        // best-effort, see file header
      }
    }
    await appendRestoreAudit({
      ts: new Date().toISOString(),
      actor: ctx.options.actor ?? null,
      kind: "restore",
      entityName: ctx.entityName,
      backupId: ctx.options.backupId,
      safetyBackupId: ctx.safetyBackup.id,
      restoredFiles: [],
      removedRuntimeId: ctx.entityName,
      migratedI18nKeyCount: 0,
      outcome: "rolled-back",
      error: errorMessage,
    })
    return failure(errorMessage, "untouched", ctx.safetyBackup.id, true)
  } catch (rollbackErr) {
    logger.error("[entity-converter:restore] rollback itself failed — half-restored state", rollbackErr)
    await appendRestoreAudit({
      ts: new Date().toISOString(),
      actor: ctx.options.actor ?? null,
      kind: "restore",
      entityName: ctx.entityName,
      backupId: ctx.options.backupId,
      safetyBackupId: ctx.safetyBackup.id,
      restoredFiles: [],
      removedRuntimeId: ctx.entityName,
      migratedI18nKeyCount: 0,
      outcome: "half-restored",
      error: `${errorMessage} | rollback: ${(rollbackErr as Error).message}`,
    })
    return failure(errorMessage, "half-restored", ctx.safetyBackup.id, false)
  }
}

// ─── Backup inspection ─────────────────────────────────────────────────────

interface BackupOk {
  ok: true
  files: string[]
  containsEntity: (entityName: string) => boolean
}

async function inspectBackup(backupId: string): Promise<BackupOk | RestoreRefusal> {
  const dir = path.join(BACKUP_DIR, backupId)
  if (!existsSync(dir)) {
    return refusal(`Backup "${backupId}" not found`)
  }
  const files = await collectRelativePaths(dir)
  // Discriminator: a convert backup includes the pages_dynamic.json
  // files (snapshot of pre-convert state). Materialize backups don't.
  const hasDynamic = PAGES_DYNAMIC_FILES.some(p => files.includes(p))
  if (!hasDynamic) {
    return refusal(`Backup "${backupId}" is not a convert snapshot (no pages_dynamic.json files)`)
  }
  return {
    ok: true,
    files,
    containsEntity: (entityName: string): boolean =>
      files.some(f => f.startsWith("src/domains/") && f.includes(`/${entityName}.`)),
  }
}

async function collectRelativePaths(dir: string): Promise<string[]> {
  const out: string[] = []
  async function walk(current: string): Promise<void> {
    let entries: import("node:fs").Dirent[]
    try {
      entries = await fs.readdir(current, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      const next = path.join(current, e.name)
      if (e.isDirectory()) await walk(next)
      else out.push(path.relative(dir, next).replace(/\\/g, "/"))
    }
  }
  await walk(dir)
  return out
}

// ─── i18n key counting ─────────────────────────────────────────────────────

async function countLeavesInLivePages(entityName: string): Promise<number> {
  let total = 0
  for (const locale of SUPPORTED_LOCALES) {
    const pages = await getNamespaceSource(locale, "pages")
    const subtree = pages[entityName]
    if (subtree && typeof subtree === "object" && !Array.isArray(subtree)) {
      total += countLeaves(subtree as Record<string, unknown>)
    }
  }
  return total
}

async function countLeavesInBackupPages(backupId: string, entityName: string): Promise<number> {
  let total = 0
  for (const locale of SUPPORTED_LOCALES) {
    const rel = path.join(".entity-builder-backups", backupId, "messages", locale, "pages.json")
    let abs: string
    try {
      abs = assertSafePath(rel)
    } catch {
      continue
    }
    if (!existsSync(abs)) continue
    try {
      const raw = await fs.readFile(abs, "utf8")
      const parsed = JSON.parse(raw) as Record<string, unknown>
      const subtree = parsed[entityName]
      if (subtree && typeof subtree === "object" && !Array.isArray(subtree)) {
        total += countLeaves(subtree as Record<string, unknown>)
      }
    } catch {
      // Malformed JSON in the backup — count 0 for this locale and move on.
    }
  }
  return total
}

function countLeaves(node: Record<string, unknown>): number {
  let n = 0
  for (const v of Object.values(node)) {
    if (v && typeof v === "object" && !Array.isArray(v)) n += countLeaves(v as Record<string, unknown>)
    else n += 1
  }
  return n
}

// ─── Audit ──────────────────────────────────────────────────────────────────

export type RestoreAuditOutcome = "success" | "rolled-back" | "half-restored"

export interface RestoreAuditEntry {
  ts: string
  actor: string | null
  kind: "restore"
  entityName: string
  backupId: string
  safetyBackupId: string | null
  restoredFiles: string[]
  removedRuntimeId: string
  migratedI18nKeyCount: number
  outcome: RestoreAuditOutcome
  error: string | null
}

async function appendRestoreAudit(entry: RestoreAuditEntry): Promise<void> {
  try {
    const safe = assertSafePath(AUDIT_FILE)
    await fs.mkdir(path.dirname(safe), { recursive: true })
    await fs.appendFile(safe, JSON.stringify(entry) + "\n", "utf8")
  } catch (err) {
    logger.warn("[entity-converter:restore] audit append failed", err)
  }
}

// ─── Internal helpers ──────────────────────────────────────────────────────

function refusal(reason: string): RestoreRefusal {
  return { ok: false, status: 422, reason }
}

function failure(
  error: string,
  partialState: "untouched" | "half-restored",
  safetyBackupId: string | null,
  rolledBack: boolean,
): RestoreFailure {
  return { ok: false, status: 500, error, partialState, safetyBackupId, rolledBack }
}
