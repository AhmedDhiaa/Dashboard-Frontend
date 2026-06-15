/**
 * Filesystem-backed storage for the runtime builder.
 *
 * Single-process safety: every read-modify-write goes through an async mutex
 * keyed by file path so two concurrent PATCHes can't lose each other's
 * updates. For multi-process deployments (PM2 cluster, K8s replicas) swap
 * the mutex for a distributed lock or move the store to a real database.
 *
 * Atomic-write guarantee: writes go to a sibling tempfile that is then
 * renamed over the target. On POSIX and Windows NTFS, rename is atomic for
 * same-volume targets, so a crash mid-write leaves the previous good file
 * intact instead of a half-written one.
 */

import { promises as fs } from "node:fs"
import path from "node:path"
import { RUNTIME_CONFIG_FILE, RUNTIME_DATA_DIR, RUNTIME_DIR, RUNTIME_VERSION_FILE, isValidEntityId } from "./constants"
import { assertSafePath } from "@/shared/utils/safe-path"

// ─── Types ──────────────────────────────────────────────────────────────────

export interface RuntimeRecord {
  id: string
  createdAt: number
  updatedAt: number
  [field: string]: unknown
}

/** Match the shape the client uses; keeping this loose since the route just round-trips it. */
export type RuntimeConfig = Record<string, unknown>

// ─── Mutex ──────────────────────────────────────────────────────────────────

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

// ─── Filesystem helpers ─────────────────────────────────────────────────────

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(assertSafePath(dir), { recursive: true })
}

async function atomicWriteJson(file: string, data: unknown): Promise<void> {
  // Validate the target path BEFORE deriving a tempfile name from it.
  // The tempfile sits next to the target so it inherits the same root.
  const safeFile = assertSafePath(file)
  await ensureDir(path.dirname(safeFile))
  const tmp = assertSafePath(`${safeFile}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`)
  const payload = JSON.stringify(data, null, 2) + "\n"
  await fs.writeFile(tmp, payload, "utf8")
  try {
    await fs.rename(tmp, safeFile)
  } catch (err) {
    // Best-effort cleanup so we don't litter the dir on rename failure.
    fs.unlink(tmp).catch(() => {})
    throw err
  }
}

async function readJsonOrDefault<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(file, "utf8")
    return JSON.parse(raw) as T
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return fallback
    throw err
  }
}

// ─── Version ────────────────────────────────────────────────────────────────

export async function readVersion(): Promise<number> {
  try {
    const raw = await fs.readFile(RUNTIME_VERSION_FILE, "utf8")
    const n = parseInt(raw.trim(), 10)
    return Number.isFinite(n) ? n : 0
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return 0
    throw err
  }
}

async function bumpVersionUnsafe(): Promise<number> {
  const current = await readVersion()
  const next = current + 1
  await ensureDir(RUNTIME_DIR)
  // Version is a single integer — no atomic-write needed; readers tolerate
  // the (vanishingly rare) torn read by simply re-polling on the next tick.
  await fs.writeFile(assertSafePath(RUNTIME_VERSION_FILE), String(next) + "\n")
  return next
}

// `bumpVersion` lived here for routes that need to invalidate caches
// without writing config or records. None do today; bumping happens
// implicitly inside writeConfig / createRecord / updateRecord / deleteRecord.

// ─── Config (entities + pages + dashboards) ─────────────────────────────────

const EMPTY_CONFIG: RuntimeConfig = {
  entities: [],
  pages: [],
  dashboards: [],
  settings: { version: 1 },
}

export async function readConfig(): Promise<RuntimeConfig> {
  return readJsonOrDefault<RuntimeConfig>(RUNTIME_CONFIG_FILE, EMPTY_CONFIG)
}

export async function writeConfig(config: RuntimeConfig): Promise<{ version: number }> {
  return withLock(RUNTIME_CONFIG_FILE, async () => {
    await atomicWriteJson(RUNTIME_CONFIG_FILE, config)
    const version = await bumpVersionUnsafe()
    return { version }
  })
}

// ─── Per-entity record CRUD ─────────────────────────────────────────────────

function dataFile(entityId: string): string {
  if (!isValidEntityId(entityId)) {
    // This is a programming error — routes guard before calling.
    throw new Error(`Invalid entityId: ${String(entityId)}`)
  }
  return path.join(RUNTIME_DATA_DIR, `${entityId}.json`)
}

export async function readRecords(entityId: string): Promise<RuntimeRecord[]> {
  return readJsonOrDefault<RuntimeRecord[]>(dataFile(entityId), [])
}

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export async function createRecord(
  entityId: string,
  data: Record<string, unknown>,
): Promise<{ record: RuntimeRecord; version: number }> {
  return withLock(dataFile(entityId), async () => {
    const items = await readRecords(entityId)
    const now = Date.now()
    const record: RuntimeRecord = {
      ...data,
      id: genId(entityId),
      createdAt: now,
      updatedAt: now,
    }
    items.push(record)
    await atomicWriteJson(dataFile(entityId), items)
    const version = await bumpVersionUnsafe()
    return { record, version }
  })
}

export async function updateRecord(
  entityId: string,
  id: string,
  patch: Record<string, unknown>,
): Promise<{ record: RuntimeRecord | null; version: number }> {
  return withLock(dataFile(entityId), async () => {
    const items = await readRecords(entityId)
    const idx = items.findIndex(r => r.id === id)
    if (idx === -1) return { record: null, version: await readVersion() }
    const existing = items[idx]
    if (!existing) return { record: null, version: await readVersion() }
    const next: RuntimeRecord = {
      ...existing,
      ...patch,
      // System fields aren't mutable from the client.
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: Date.now(),
    }
    items[idx] = next
    await atomicWriteJson(dataFile(entityId), items)
    const version = await bumpVersionUnsafe()
    return { record: next, version }
  })
}

export async function deleteRecord(entityId: string, id: string): Promise<{ removed: boolean; version: number }> {
  return withLock(dataFile(entityId), async () => {
    const items = await readRecords(entityId)
    const idx = items.findIndex(r => r.id === id)
    if (idx === -1) return { removed: false, version: await readVersion() }
    items.splice(idx, 1)
    await atomicWriteJson(dataFile(entityId), items)
    const version = await bumpVersionUnsafe()
    return { removed: true, version }
  })
}

/**
 * Delete an entity's data bucket entirely. Used by the materialize endpoint
 * after the runtime entity has been promoted into a real source-file entity
 * — the records are no longer stored in the runtime bucket.
 *
 * Silently skips if the file doesn't exist (the entity may have had no
 * records).
 */
export async function deleteEntityDataFile(entityId: string): Promise<void> {
  return withLock(dataFile(entityId), async () => {
    try {
      await fs.unlink(assertSafePath(dataFile(entityId)))
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err
    }
  })
}

/**
 * Insert (or replace) a single entity in the config, atomically. Used by
 * the entity-converter route to lift a handwritten entity into the runtime
 * store. Refuses (`inserted: false`) when an entity with the same id
 * already exists — the caller decides whether that's a hard failure or a
 * recoverable "already converted" state.
 */
export async function addEntityToConfig(entity: { id: string }): Promise<{ inserted: boolean; version: number }> {
  return withLock(RUNTIME_CONFIG_FILE, async () => {
    const config = await readConfig()
    const entities = Array.isArray(config.entities) ? (config.entities as { id: string }[]) : []
    if (entities.some(e => e.id === entity.id)) {
      return { inserted: false, version: await readVersion() }
    }
    const nextEntities = [...entities, entity]
    const nextConfig: RuntimeConfig = { ...config, entities: nextEntities }
    await atomicWriteJson(RUNTIME_CONFIG_FILE, nextConfig)
    const version = await bumpVersionUnsafe()
    return { inserted: true, version }
  })
}

/**
 * Remove a single entity from the config (and any pages bound to it),
 * atomically. Used by the materialize endpoint to retire a runtime entity
 * once its files have landed on disk. Returns whether anything changed and
 * the new version number.
 */
export async function removeEntityFromConfig(entityId: string): Promise<{ removed: boolean; version: number }> {
  return withLock(RUNTIME_CONFIG_FILE, async () => {
    const config = await readConfig()
    const entities = Array.isArray(config.entities) ? (config.entities as { id: string }[]) : []
    const idx = entities.findIndex(e => e.id === entityId)
    if (idx === -1) return { removed: false, version: await readVersion() }

    const nextEntities = entities.filter(e => e.id !== entityId)
    const pages = Array.isArray(config.pages)
      ? (config.pages as { entityId?: string }[]).filter(p => p.entityId !== entityId)
      : []
    const nextConfig: RuntimeConfig = { ...config, entities: nextEntities, pages }
    await atomicWriteJson(RUNTIME_CONFIG_FILE, nextConfig)
    const version = await bumpVersionUnsafe()
    return { removed: true, version }
  })
}
