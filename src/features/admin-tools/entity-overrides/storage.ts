/**
 * Filesystem-backed entity-override store.
 *
 * Layout: `messages/_overrides/entity-overrides.json` — single JSON file
 * keyed by entityName. Mirrors the i18n storage pattern: per-key mutex,
 * memory cache, fs.watch invalidation. Single-process safe; clustered
 * deployments need a shared lock.
 *
 * Why one file and not per-entity files? Entities are read in bulk on
 * every `getEntityConfig()` lookup; a single 4–10 KB JSON parse is
 * cheaper than 51 file probes, and the watcher only needs to invalidate
 * one path.
 */

import { promises as fs, watch as fsWatch, type FSWatcher } from "node:fs"
import path from "node:path"
import { assertSafePath } from "@/shared/utils/safe-path"
import { logger } from "@/shared/logger"
import { entityOverrideMapSchema, type EntityOverride, type EntityOverrideMap } from "@/core/entities/overrides/schema"

const OVERRIDES_DIR = path.join(process.cwd(), "messages", "_overrides")
const OVERRIDES_FILE = path.join(OVERRIDES_DIR, "entity-overrides.json")

const LOCK_KEY = "entity-overrides"
const locks = new Map<string, Promise<unknown>>()

async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = locks.get(key) ?? Promise.resolve()
  const next = previous.then(fn, fn)
  locks.set(
    key,
    next.finally(() => {
      if (locks.get(key) === next) locks.delete(key)
    }),
  )
  return next
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(assertSafePath(OVERRIDES_DIR), { recursive: true })
}

// ─── Cache layer ──────────────────────────────────────────────────────────────

let cachedMap: EntityOverrideMap | null = null
let watcher: FSWatcher | null = null
let watcherAttached = false

function clearCache(): void {
  cachedMap = null
}

function attachWatcherOnce(): void {
  if (watcherAttached) return
  watcherAttached = true
  try {
    watcher = fsWatch(OVERRIDES_DIR, { persistent: false }, (_event, filename) => {
      if (filename == null) {
        clearCache()
        return
      }
      if (filename === path.basename(OVERRIDES_FILE)) clearCache()
    })
    watcher.on("error", err => {
      logger.warn("[entity-overrides] fs.watch error — falling back to per-call reads", err)
      clearCache()
      try {
        watcher?.close()
      } catch {
        /* ignore */
      }
      watcher = null
    })
  } catch (err) {
    logger.warn("[entity-overrides] fs.watch unavailable — using write-side invalidation only", err)
    watcher = null
  }
}

// ─── Reads ────────────────────────────────────────────────────────────────────

export async function readEntityOverrides(): Promise<EntityOverrideMap> {
  if (cachedMap) return cachedMap
  attachWatcherOnce()
  try {
    const raw = await fs.readFile(OVERRIDES_FILE, "utf8")
    const parsed = JSON.parse(raw)
    const result = entityOverrideMapSchema.safeParse(parsed)
    if (!result.success) {
      logger.warn("[entity-overrides] file failed schema validation, ignoring:", result.error.flatten())
      cachedMap = {}
      return {}
    }
    cachedMap = result.data
    return result.data
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      cachedMap = {}
      return {}
    }
    throw err
  }
}

// ─── Writes ───────────────────────────────────────────────────────────────────

async function writeUnsafe(map: EntityOverrideMap): Promise<void> {
  await ensureDir()
  // Sort keys for deterministic diffs in version control.
  const sorted: EntityOverrideMap = {}
  for (const k of Object.keys(map).sort()) sorted[k] = map[k]!
  await fs.writeFile(assertSafePath(OVERRIDES_FILE), JSON.stringify(sorted, null, 2) + "\n")
  cachedMap = sorted
}

export async function setEntityOverride(entityName: string, override: EntityOverride): Promise<EntityOverrideMap> {
  return withLock(LOCK_KEY, async () => {
    const current = await readEntityOverrides()
    const next: EntityOverrideMap = { ...current, [entityName]: override }
    await writeUnsafe(next)
    return next
  })
}

export async function removeEntityOverride(entityName: string): Promise<{ map: EntityOverrideMap; removed: boolean }> {
  return withLock(LOCK_KEY, async () => {
    const current = await readEntityOverrides()
    if (!(entityName in current)) return { map: current, removed: false }
    const next: EntityOverrideMap = { ...current }
    delete next[entityName]
    await writeUnsafe(next)
    return { map: next, removed: true }
  })
}
