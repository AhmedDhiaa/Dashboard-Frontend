/**
 * Convert-audit lookup used by /admin/entities to surface the
 * "Restore from source" affordance on runtime rows.
 *
 * Walks `.entity-builder-backups/_audit.jsonl` (one JSON object per
 * line — best-effort, malformed lines skipped) and returns a
 * `Map<entityName, backupId>` of the MOST RECENT successful convert
 * whose snapshot directory still exists. Both predicates matter:
 *
 *   - outcome:"success" — failed converts shouldn't offer restore.
 *   - dir existence — snapshots are pruned to the last 20 by
 *     `snapshotFiles`, so an old convert may no longer have its
 *     backing snapshot.
 *
 * Read-only, no fs writes. Safe to call from a Server Component
 * during SSR.
 */

import { promises as fs } from "node:fs"
import { existsSync } from "node:fs"
import path from "node:path"

const AUDIT_FILE = path.join(".entity-builder-backups", "_audit.jsonl")

interface ConvertAuditEntry {
  kind?: string
  entityName?: string
  runtimeEntityId?: string
  backupId?: string
  outcome?: string
}

function parseAuditLines(raw: string): ConvertAuditEntry[] {
  const out: ConvertAuditEntry[] = []
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue
    try {
      out.push(JSON.parse(line) as ConvertAuditEntry)
    } catch {
      // Malformed line — skip silently. The audit log is best-effort.
    }
  }
  return out
}

function snapshotStillExists(repoRoot: string, backupId: string): boolean {
  return existsSync(path.join(repoRoot, ".entity-builder-backups", backupId))
}

/**
 * Returns `Map<runtimeEntityId, backupId>` — caller looks up by the
 * runtime entity's id (= entityName during convert). The latest
 * successful convert per entity wins; older entries are overwritten
 * as we walk the log. A successful `restore` entry for the same
 * entity AFTER the convert prunes the entry — there's no runtime
 * entity left to restore from.
 */
export async function findConvertBackupsByRuntimeId(repoRoot: string = process.cwd()): Promise<Map<string, string>> {
  const auditPath = path.join(repoRoot, AUDIT_FILE)
  if (!existsSync(auditPath)) return new Map()

  let raw: string
  try {
    raw = await fs.readFile(auditPath, "utf8")
  } catch {
    return new Map()
  }

  const entries = parseAuditLines(raw)
  const out = new Map<string, string>()
  for (const entry of entries) {
    if (entry.kind !== "convert" || entry.outcome !== "success") continue
    const id = entry.runtimeEntityId ?? entry.entityName
    const backupId = entry.backupId
    if (!id || !backupId) continue
    if (!snapshotStillExists(repoRoot, backupId)) continue
    out.set(id, backupId)
  }
  // Prune entries whose entity has been restored since the convert.
  for (const entry of entries) {
    if (entry.kind === "restore" && entry.outcome === "success" && entry.entityName) {
      out.delete(entry.entityName)
    }
  }
  return out
}
