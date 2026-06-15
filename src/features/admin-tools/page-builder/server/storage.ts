/**
 * Filesystem-backed Page Builder schema store.
 *
 * Layout:
 *   messages/_overrides/pages/<pageId>.json       – one file per page
 *   messages/_overrides/pages/.version            – integer, bumped on every write
 *   messages/_overrides/pages/_audit.jsonl        – append-only audit (audit.ts)
 *
 * Mirrors `src/app/api/i18n/_lib/storage.ts`:
 *   - Per-page mutex so concurrent writes don't lose updates.
 *   - In-memory parsed cache + best-effort `fs.watch` invalidation.
 *   - `assertSafePath` enforced on every disk write — no fs primitive runs
 *     against a path outside the overrides directory.
 *
 * Validation: every read AND write is parsed through `pageSchema`. A draft
 * that doesn't validate cannot be persisted (route returns 400) and a
 * corrupted on-disk file fails loudly at read time (route returns 422).
 */

import { promises as fs, watch as fsWatch, type FSWatcher } from "node:fs"
import path from "node:path"
import { logger } from "@/shared/logger"
import { assertSafePath } from "@/shared/utils/safe-path"
import { pageSchema, type PageSchema } from "../schema/page-schema"

export const PAGES_DIR = path.join(process.cwd(), "messages", "_overrides", "pages")
export const VERSION_FILE = path.join(PAGES_DIR, ".version")

// kebab-case identifier (matches the schema's kebabIdSchema). Re-checked
// here because the path goes to disk; defense-in-depth.
const PAGE_ID_PATTERN = /^[a-z][a-z0-9-]{1,40}$/

export function isValidPageId(pageId: string): boolean {
  return PAGE_ID_PATTERN.test(pageId)
}

function pageFilePath(pageId: string): string {
  if (!isValidPageId(pageId)) throw new Error(`Invalid pageId "${pageId}"`)
  return assertSafePath(path.join(PAGES_DIR, `${pageId}.json`))
}

// ─── Lock ──────────────────────────────────────────────────────────────────

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

// ─── Cache + invalidation ──────────────────────────────────────────────────

const cachedPages = new Map<string, PageSchema>()
let cachedVersion: number | null = null
let watcher: FSWatcher | null = null
let watcherAttached = false

function clearAllCaches(): void {
  cachedPages.clear()
  cachedVersion = null
}

function attachWatcherOnce(): void {
  if (watcherAttached) return
  watcherAttached = true
  try {
    watcher = fsWatch(PAGES_DIR, { persistent: false }, (_event, filename) => {
      if (filename == null) {
        clearAllCaches()
        return
      }
      if (filename === path.basename(VERSION_FILE)) {
        cachedVersion = null
        return
      }
      const match = /^([a-z][a-z0-9-]{1,40})\.json$/.exec(filename)
      if (match) cachedPages.delete(match[1]!)
    })
    watcher.on("error", err => {
      logger.warn("[page-builder/storage] fs.watch error — falling back to per-call reads", err)
      clearAllCaches()
      try {
        watcher?.close()
      } catch {
        /* ignore */
      }
      watcher = null
    })
  } catch (err) {
    logger.warn("[page-builder/storage] fs.watch unavailable", err)
    watcher = null
  }
}

async function ensurePagesDir(): Promise<void> {
  await fs.mkdir(assertSafePath(PAGES_DIR), { recursive: true })
}

// ─── Reads ─────────────────────────────────────────────────────────────────

export interface PageSummary {
  id: string
  title: { en: string; ar: string }
  permission: string
  layout: string
  blockCount: number
  /** Mirrors `pageSchema.navigation` so the sidebar can filter + group + sort
   *  without fetching every full schema. */
  navigation?: {
    enabled: boolean
    group: string
    icon: string
    order: number
    href?: string
  }
  updatedAt?: string
}

export async function readPage(pageId: string): Promise<PageSchema | null> {
  if (!isValidPageId(pageId)) return null
  const cached = cachedPages.get(pageId)
  if (cached) return cached
  attachWatcherOnce()
  try {
    const raw = await fs.readFile(pageFilePath(pageId), "utf8")
    const parsed = pageSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) {
      throw new Error(`Stored page "${pageId}" failed schema validation`)
    }
    cachedPages.set(pageId, parsed.data)
    return parsed.data
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null
    throw err
  }
}

export async function listPages(): Promise<PageSummary[]> {
  attachWatcherOnce()
  try {
    const entries = await fs.readdir(PAGES_DIR)
    const summaries: PageSummary[] = []
    for (const entry of entries) {
      const match = /^([a-z][a-z0-9-]{1,40})\.json$/.exec(entry)
      if (!match) continue
      const pageId = match[1]!
      try {
        const page = await readPage(pageId)
        if (!page) continue
        summaries.push({
          id: page.id,
          title: page.title,
          permission: page.permission,
          layout: page.layout,
          blockCount: page.blocks.length,
          navigation: page.navigation,
          updatedAt: page.updatedAt,
        })
      } catch (err) {
        logger.warn(`[page-builder/storage] skipping malformed page "${pageId}"`, err)
      }
    }
    return summaries.sort((a, b) => a.id.localeCompare(b.id))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return []
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

async function writePageUnsafe(pageId: string, schema: PageSchema): Promise<void> {
  await ensurePagesDir()
  await fs.writeFile(pageFilePath(pageId), JSON.stringify(schema, null, 2) + "\n")
  cachedPages.set(pageId, schema)
}

async function bumpVersionUnsafe(): Promise<number> {
  const current = await readVersion()
  const next = current + 1
  await ensurePagesDir()
  await fs.writeFile(assertSafePath(VERSION_FILE), String(next) + "\n")
  cachedVersion = next
  return next
}

export async function writePage(pageId: string, schema: PageSchema): Promise<{ schema: PageSchema; version: number }> {
  if (!isValidPageId(pageId)) throw new Error(`Invalid pageId "${pageId}"`)
  if (schema.id !== pageId) throw new Error(`pageId "${pageId}" does not match schema.id "${schema.id}"`)
  return withLock(pageId, async () => {
    const stamped = stampMetadata(schema)
    await writePageUnsafe(pageId, stamped)
    const version = await bumpVersionUnsafe()
    return { schema: stamped, version }
  })
}

export async function deletePage(pageId: string): Promise<{ removed: boolean; version: number }> {
  if (!isValidPageId(pageId)) return { removed: false, version: await readVersion() }
  return withLock(pageId, async () => {
    try {
      await fs.unlink(pageFilePath(pageId))
      cachedPages.delete(pageId)
      const version = await bumpVersionUnsafe()
      return { removed: true, version }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return { removed: false, version: await readVersion() }
      }
      throw err
    }
  })
}

function stampMetadata(schema: PageSchema): PageSchema {
  // `updatedAt` is server-managed; ignore any client value to keep clocks consistent.
  const now = new Date().toISOString()
  return { ...schema, updatedAt: now, createdAt: schema.createdAt ?? now }
}

/** Test-only: drop caches + detach watcher. */
export const __testHooks = {
  reset: () => {
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
  },
}
