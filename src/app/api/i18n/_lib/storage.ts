/**
 * Filesystem-backed translation override store.
 *
 * Layout:
 *   messages/_overrides/<locale>.json   – flat { "<namespace>.<keyPath>": value } map
 *   messages/_overrides/.version        – single integer line, bumped on every write
 *
 * Single-process safety: each per-locale read-modify-write goes through an
 * async mutex so two concurrent PATCHes can't lose each other's updates. For
 * multi-process deployments (PM2 cluster, K8s replicas) swap the mutex for a
 * distributed lock or move the store to a real database.
 *
 * Caching: `readOverrides(locale)` and `readVersion()` are called on every
 * request through `next-intl`'s `getRequestConfig`. We keep the parsed
 * results in memory so warm reads skip disk I/O entirely. Three invalidation
 * paths keep the cache honest:
 *
 *   1. Write helpers (`setOverride`, `removeOverride`, `bumpVersionUnsafe`)
 *      replace the cached value with what they just wrote — fast, deterministic,
 *      survives `await fs.writeFile`.
 *   2. `fs.watch` on the overrides directory clears the cache when files
 *      change from outside this process (another node, an editor saving the
 *      file, a deploy hook). Best-effort across platforms.
 *   3. Watcher errors (Windows ENOSYS, Linux EMFILE, sandboxed FS) eagerly
 *      invalidate and detach so we fall back to per-call reads.
 */

import { promises as fs, watch as fsWatch, type FSWatcher } from "node:fs"
import path from "node:path"
import { OVERRIDES_DIR, VERSION_FILE, type SupportedLocale } from "./constants"
import { assertSafePath } from "@/shared/utils/safe-path"
import { logger } from "@/shared/logger"

export type OverrideMap = Record<string, string>

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

async function ensureOverridesDir(): Promise<void> {
  await fs.mkdir(assertSafePath(OVERRIDES_DIR), { recursive: true })
}

function localeFilePath(locale: SupportedLocale): string {
  // `locale` is constrained by `isSupportedLocale` ("en" | "ar") so it
  // can't carry traversal sequences, but assertSafePath is the contract.
  return assertSafePath(path.join(OVERRIDES_DIR, `${locale}.json`))
}

// ─── Cache layer ───────────────────────────────────────────────────────────

const cachedOverrides = new Map<SupportedLocale, OverrideMap>()
let cachedVersion: number | null = null
let watcher: FSWatcher | null = null
let watcherAttached = false

function clearAllCaches(): void {
  cachedOverrides.clear()
  cachedVersion = null
}

function attachWatcherOnce(): void {
  if (watcherAttached) return
  watcherAttached = true
  try {
    // `persistent: false` so the watcher doesn't keep the Node process alive
    // for short-lived test runs / scripts.
    watcher = fsWatch(OVERRIDES_DIR, { persistent: false }, (_event, filename) => {
      // null filename on some platforms — invalidate everything.
      if (filename == null) {
        clearAllCaches()
        return
      }
      if (filename === path.basename(VERSION_FILE)) {
        cachedVersion = null
        return
      }
      const match = /^([a-z-]+)\.json$/.exec(filename)
      if (match) {
        cachedOverrides.delete(match[1] as SupportedLocale)
      }
    })
    watcher.on("error", err => {
      logger.warn("[i18n/storage] fs.watch error — falling back to per-call reads", err)
      clearAllCaches()
      try {
        watcher?.close()
      } catch {
        /* ignore */
      }
      watcher = null
    })
  } catch (err) {
    // Sandboxed environments may disallow fs.watch. Cache still benefits
    // from write-side invalidation, just won't pick up out-of-process edits.
    logger.warn("[i18n/storage] fs.watch unavailable — using write-side invalidation only", err)
    watcher = null
  }
}

/** Test-only hook to drop caches + detach the watcher. Not part of the public API. */
function resetCacheForTests(): void {
  clearAllCaches()
  if (watcher) {
    try {
      watcher.close()
    } catch {
      /* ignore */
    }
  }
  watcher = null
  watcherAttached = false
}

export const __testHooks = { resetCacheForTests }

// ─── Reads ─────────────────────────────────────────────────────────────────

export async function readOverrides(locale: SupportedLocale): Promise<OverrideMap> {
  const cached = cachedOverrides.get(locale)
  if (cached) return cached
  attachWatcherOnce()
  try {
    const raw = await fs.readFile(localeFilePath(locale), "utf8")
    const parsed = JSON.parse(raw)
    const map: OverrideMap = parsed && typeof parsed === "object" ? (parsed as OverrideMap) : {}
    cachedOverrides.set(locale, map)
    return map
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      const empty: OverrideMap = {}
      cachedOverrides.set(locale, empty)
      return empty
    }
    throw err
  }
}

export async function readVersion(): Promise<number> {
  if (cachedVersion !== null) return cachedVersion
  attachWatcherOnce()
  try {
    const raw = await fs.readFile(VERSION_FILE, "utf8")
    const n = parseInt(raw.trim(), 10)
    const v = Number.isFinite(n) ? n : 0
    cachedVersion = v
    return v
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      cachedVersion = 0
      return 0
    }
    throw err
  }
}

// ─── Writes ────────────────────────────────────────────────────────────────

async function writeOverridesUnsafe(locale: SupportedLocale, map: OverrideMap): Promise<void> {
  await ensureOverridesDir()
  // Sort keys for deterministic diffs in version control.
  const sorted: OverrideMap = {}
  for (const k of Object.keys(map).sort()) sorted[k] = map[k]!
  await fs.writeFile(localeFilePath(locale), JSON.stringify(sorted, null, 2) + "\n")
  // Refresh cache with the snapshot we just persisted. The fs.watch event
  // would clear it independently, but that race is order-dependent;
  // updating here makes "write then read" deterministic for callers.
  cachedOverrides.set(locale, sorted)
}

async function bumpVersionUnsafe(): Promise<number> {
  const current = await readVersion()
  const next = current + 1
  await ensureOverridesDir()
  await fs.writeFile(assertSafePath(VERSION_FILE), String(next) + "\n")
  cachedVersion = next
  return next
}

/**
 * Lock-guarded version bump for callers that aren't writing to a per-locale
 * override file but still want next-intl to refetch (e.g. the source-write
 * endpoint, which edits messages/<locale>/<namespace>.json directly).
 *
 * The key "__version__" is intentionally distinct from any locale key so it
 * serialises with itself but doesn't contend with `setOverride`/`removeOverride`,
 * which already bump the version inside their own per-locale critical section.
 */
export async function bumpVersion(): Promise<number> {
  return withLock("__version__", () => bumpVersionUnsafe())
}

/**
 * Set or update a single override and bump the global version. Atomic per
 * locale (mutex-guarded) so concurrent PATCHes don't drop writes.
 */
export async function setOverride(
  locale: SupportedLocale,
  flatKey: string,
  value: string,
): Promise<{ map: OverrideMap; version: number }> {
  return withLock(locale, async () => {
    // Build a fresh map so concurrent readers don't observe in-flight state
    // through the cached reference before the file write commits.
    const current = await readOverrides(locale)
    const next: OverrideMap = { ...current, [flatKey]: value }
    await writeOverridesUnsafe(locale, next)
    const version = await bumpVersionUnsafe()
    return { map: next, version }
  })
}

/**
 * Remove a single override. Returns whether anything was actually deleted so
 * the route can decide between 200 and 404.
 */
export async function removeOverride(
  locale: SupportedLocale,
  flatKey: string,
): Promise<{ map: OverrideMap; version: number; removed: boolean }> {
  return withLock(locale, async () => {
    const current = await readOverrides(locale)
    if (!(flatKey in current)) {
      return { map: current, version: await readVersion(), removed: false }
    }
    const next: OverrideMap = { ...current }
    delete next[flatKey]
    await writeOverridesUnsafe(locale, next)
    const version = await bumpVersionUnsafe()
    return { map: next, version, removed: true }
  })
}

export function buildFlatKey(namespace: string, keyPath: string): string {
  const ns = namespace.trim()
  const kp = keyPath.trim()
  if (!ns) return kp
  return `${ns}.${kp}`
}
