/**
 * Snapshot every file the next generation is about to touch into
 * `.entity-builder-backups/<timestamp>/`, mirroring the original tree
 * (so restore can copy back to the same paths). Keeps the most recent
 * 20 snapshots; older ones get pruned on every snapshot call.
 *
 * "Affected files" = whatever existed at the planned target paths
 * BEFORE the write. New entities snapshot zero files (nothing to back up);
 * updates snapshot the previous version of every overwritten file.
 */

import { promises as fs } from "node:fs"
import { existsSync } from "node:fs"
import path from "node:path"
import { logger } from "@/shared/logger"
import { assertSafePath, assertSafePathResolved } from "@/shared/utils/safe-path"

const ROOT = process.cwd()
export const BACKUP_DIR = path.join(ROOT, ".entity-builder-backups")
const KEEP_LAST = 20

export interface BackupSnapshot {
  /** ISO-ish timestamp used as the snapshot folder name. */
  id: string
  /** Absolute path to the snapshot directory. */
  dir: string
  /** Source-relative paths captured into the snapshot. */
  files: string[]
}

function timestampId(): string {
  // Filesystem-safe ISO: 2026-05-06T12-34-56-789Z
  return new Date().toISOString().replace(/[:.]/g, "-")
}

/**
 * Snapshot every existing file from `paths` into a new timestamped folder.
 * Returns the snapshot descriptor — caller can stash the id and surface it
 * in the audit log / UI.
 */
export async function snapshotFiles(paths: string[]): Promise<BackupSnapshot> {
  const id = timestampId()
  const dir = assertSafePath(path.join(".entity-builder-backups", id))
  await fs.mkdir(dir, { recursive: true })
  const captured: string[] = []
  for (const rel of paths) {
    let absSource: string
    try {
      absSource = assertSafePath(rel)
    } catch (err) {
      logger.warn(`[entity-builder] refused snapshot of unsafe path "${rel}":`, err)
      continue
    }
    if (!existsSync(absSource)) continue
    // The destination is always inside .entity-builder-backups/<id>/ —
    // assertSafePath enforces it stays under that allowed root even if
    // `rel` somehow contains traversal sequences (it shouldn't, but
    // defence in depth).
    const target = assertSafePath(path.join(".entity-builder-backups", id, rel))
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.copyFile(absSource, target)
    captured.push(rel)
  }
  // Also copy the i18n files — they get mutated even on create flows.
  for (const locale of ["en", "ar"] as const) {
    const rel = `messages/${locale}/pages.json`
    const absSource = assertSafePath(rel)
    if (!existsSync(absSource)) continue
    const target = assertSafePath(path.join(".entity-builder-backups", id, rel))
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.copyFile(absSource, target)
    captured.push(rel)
  }
  await pruneOldSnapshots()
  return { id, dir, files: captured }
}

async function pruneOldSnapshots(): Promise<void> {
  try {
    const entries = await fs.readdir(BACKUP_DIR)
    const snaps = entries.sort()
    const excess = snaps.length - KEEP_LAST
    if (excess <= 0) return
    for (let i = 0; i < excess; i++) {
      const victim = snaps[i]
      if (!victim) continue
      // `victim` is a folder name from readdir; assertSafePath guards
      // against any future change that would let an attacker influence the
      // directory listing.
      await fs.rm(assertSafePath(path.join(".entity-builder-backups", victim)), { recursive: true, force: true })
    }
  } catch (err) {
    logger.warn("[entity-builder] snapshot prune failed:", err)
  }
}

export async function listSnapshots(): Promise<Array<{ id: string; fileCount: number }>> {
  try {
    const entries = await fs.readdir(BACKUP_DIR)
    const out: Array<{ id: string; fileCount: number }> = []
    for (const id of entries.sort().reverse()) {
      const files = await collectFiles(path.join(BACKUP_DIR, id))
      out.push({ id, fileCount: files.length })
    }
    return out
  } catch {
    return []
  }
}

async function collectFiles(dir: string): Promise<string[]> {
  const out: string[] = []
  async function walk(current: string): Promise<void> {
    const entries = await fs.readdir(current, { withFileTypes: true })
    for (const entry of entries) {
      const next = path.join(current, entry.name)
      if (entry.isDirectory()) await walk(next)
      else out.push(path.relative(dir, next).replace(/\\/g, "/"))
    }
  }
  try {
    await walk(dir)
  } catch {
    /* missing snapshot — return empty list */
  }
  return out
}

/**
 * Restore every file from a snapshot back to its original location.
 * Files in the source tree that don't exist in the snapshot are left
 * alone (snapshot only captured what existed at backup time, not the
 * later additions). Returns the list of restored relative paths.
 */
export async function restoreSnapshot(id: string): Promise<{ restored: string[]; warnings: string[] }> {
  // `id` reaches us from the route handler — it's regex-checked there too,
  // but the safe-path guard is what makes the contract enforceable.
  const dir = assertSafePath(path.join(".entity-builder-backups", id))
  if (!existsSync(dir)) throw new Error(`Snapshot not found: ${id}`)
  const files = await collectFiles(dir)
  const warnings: string[] = []
  const restored: string[] = []
  for (const rel of files) {
    let src: string
    let dest: string
    try {
      src = assertSafePath(path.join(".entity-builder-backups", id, rel))
      // Restore writes back to live source roots; use the resolved guard
      // so a pre-planted symlink inside an allowed root can't redirect
      // a copy to /etc.
      dest = await assertSafePathResolved(rel)
    } catch (err) {
      warnings.push(`refused unsafe path ${rel}: ${(err as Error).message}`)
      continue
    }
    try {
      await fs.mkdir(path.dirname(dest), { recursive: true })
      await fs.copyFile(src, dest)
      restored.push(rel)
    } catch (err) {
      warnings.push(`restore ${rel}: ${(err as Error).message}`)
    }
  }
  return { restored, warnings }
}
