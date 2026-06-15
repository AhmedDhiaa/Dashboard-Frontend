/**
 * Filesystem-backed theme override store.
 *
 * Single JSON file at `messages/_overrides/theme.json` with shape:
 *   {
 *     draft:   { tokens: {...}, updatedBy: "...", updatedAt: "..." },
 *     live:    { tokens: {...}, updatedBy: "...", updatedAt: "..." },
 *     version: <integer, bumped on each publish>
 *   }
 *
 * Workflow:
 *   - PATCH writes to draft (no version bump — draft is admin-only).
 *   - PUBLISH copies draft → live and bumps version (everyone sees it).
 *   - REVERT resets draft to current live (no version bump).
 *
 * Concurrency: a single async mutex serialises all writes. For multi-process
 * deployments (PM2 cluster, K8s replicas) swap for a distributed lock or DB.
 *
 * Caching: `readStore()` is a hot path — every dashboard render asks for the
 * live token map. We keep the parsed store in process memory so warm reads
 * don't touch the disk. Three invalidation paths keep the cache honest:
 *
 *   1. Every write helper (`saveDraft`, `publishDraft`, `revertDraft`)
 *      replaces `cachedStore` with the value it just wrote. This is the
 *      common case — admin edits via the in-app theme editor.
 *   2. `fs.watch` on the parent dir invalidates if the file changes from
 *      outside this process (another node, an editor, a deploy hook).
 *      Best-effort: on platforms where watch fails the cache still works,
 *      it just relies on path 1.
 *   3. Errors from the watcher (Windows ENOSYS, Linux EMFILE) eagerly
 *      invalidate the cache and detach so we fall back to per-call reads.
 */

import { promises as fs, watch as fsWatch, type FSWatcher } from "node:fs"
import path from "node:path"
import { THEME_FILE } from "./constants"
import { assertSafePath } from "@/shared/utils/safe-path"
import { logger } from "@/shared/logger"

export interface ThemeStage {
  tokens: Record<string, string>
  updatedBy: string | null
  updatedAt: string | null
}

export interface ThemeStore {
  draft: ThemeStage
  live: ThemeStage
  version: number
}

const EMPTY_STAGE: ThemeStage = { tokens: {}, updatedBy: null, updatedAt: null }
const EMPTY_STORE: ThemeStore = { draft: EMPTY_STAGE, live: EMPTY_STAGE, version: 0 }

let writeLock: Promise<unknown> = Promise.resolve()

async function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = writeLock.then(fn, fn)
  writeLock = next.catch(() => undefined)
  return next
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(assertSafePath(path.dirname(THEME_FILE)), { recursive: true })
}

// ─── Cache layer ───────────────────────────────────────────────────────────

let cachedStore: ThemeStore | null = null
let watcher: FSWatcher | null = null
let watcherAttached = false

function attachWatcherOnce(): void {
  if (watcherAttached) return
  watcherAttached = true
  try {
    const dir = path.dirname(THEME_FILE)
    const target = path.basename(THEME_FILE)
    // `persistent: false` so the watcher doesn't keep the process alive in
    // tests / short-lived scripts.
    watcher = fsWatch(dir, { persistent: false }, (_event, filename) => {
      // Some platforms emit `filename === null`; treat as a wildcard hit
      // and invalidate, since we only watch the dir for one file anyway.
      if (filename == null || filename === target) {
        cachedStore = null
      }
    })
    watcher.on("error", err => {
      logger.warn("[theme/storage] fs.watch error — falling back to per-call reads", err)
      cachedStore = null
      try {
        watcher?.close()
      } catch {
        /* ignore */
      }
      watcher = null
    })
  } catch (err) {
    // Some sandboxed environments disallow fs.watch. The cache still works
    // via direct invalidation on writes — just no out-of-process detection.
    logger.warn("[theme/storage] fs.watch unavailable — using write-side invalidation only", err)
    watcher = null
  }
}

/** Test-only hook to drop the cache + detach the watcher. Not exported. */
function resetCacheForTests(): void {
  cachedStore = null
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

// Surfaced through a non-public symbol so tests can poke at it without
// widening the module's public API.
export const __testHooks = { resetCacheForTests }

// ─── Read / write ──────────────────────────────────────────────────────────

export async function readStore(): Promise<ThemeStore> {
  if (cachedStore !== null) return cachedStore
  attachWatcherOnce()
  try {
    const raw = await fs.readFile(THEME_FILE, "utf8")
    const parsed = JSON.parse(raw) as Partial<ThemeStore>
    const store: ThemeStore = {
      draft: parsed.draft ?? EMPTY_STAGE,
      live: parsed.live ?? EMPTY_STAGE,
      version: typeof parsed.version === "number" ? parsed.version : 0,
    }
    cachedStore = store
    return store
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      cachedStore = EMPTY_STORE
      return EMPTY_STORE
    }
    throw err
  }
}

async function writeStoreUnsafe(store: ThemeStore): Promise<void> {
  await ensureDir()
  await fs.writeFile(assertSafePath(THEME_FILE), JSON.stringify(store, null, 2) + "\n")
  // Replace the cache with the just-written snapshot. The fs.watch event
  // would clear it on its own, but that's async and order-dependent — doing
  // it here makes "write then immediately read" deterministic.
  cachedStore = store
}

export async function readVersion(): Promise<number> {
  return (await readStore()).version
}

// Writers build the next snapshot rather than mutating the one returned by
// `readStore`. Without this, concurrent readers would see in-flight changes
// before the file write commits — a footgun that didn't exist before
// caching, since reads used to re-parse from disk every time.

/** Save a new draft. Does NOT bump the version (drafts are admin-only). */
export async function saveDraft(tokens: Record<string, string>, updatedBy: string | null): Promise<ThemeStore> {
  return withLock(async () => {
    const current = await readStore()
    const next: ThemeStore = {
      ...current,
      draft: { tokens, updatedBy, updatedAt: new Date().toISOString() },
    }
    await writeStoreUnsafe(next)
    return next
  })
}

/** Promote draft → live and bump the version. */
export async function publishDraft(updatedBy: string | null): Promise<ThemeStore> {
  return withLock(async () => {
    const current = await readStore()
    const next: ThemeStore = {
      ...current,
      live: {
        tokens: { ...current.draft.tokens },
        updatedBy,
        updatedAt: new Date().toISOString(),
      },
      version: current.version + 1,
    }
    await writeStoreUnsafe(next)
    return next
  })
}

/** Reset draft to current live (discards unpublished edits). No version bump. */
export async function revertDraft(): Promise<ThemeStore> {
  return withLock(async () => {
    const current = await readStore()
    const next: ThemeStore = {
      ...current,
      draft: {
        tokens: { ...current.live.tokens },
        updatedBy: current.live.updatedBy,
        updatedAt: current.live.updatedAt,
      },
    }
    await writeStoreUnsafe(next)
    return next
  })
}
