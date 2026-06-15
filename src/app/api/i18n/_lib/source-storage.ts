/**
 * Direct source-of-truth writer for translation namespace files.
 *
 * Layout:
 *   messages/<locale>/<namespace>.json — nested JSON the dev hand-edits,
 *   loaded by next-intl via dynamic import. We round-trip edits straight
 *   back into these files so admin edits commit to git instead of living
 *   in the runtime overrides store.
 *
 * Locking: per (locale, namespace) so two PATCHes on the same file
 * serialise but writes targeting different namespaces don't contend.
 *
 * Formatting: matches the existing files exactly — 4-space indent,
 * trailing newline — so write-side diffs stay minimal and reviewable.
 *
 * Version bump: shares messages/_overrides/.version with the overrides
 * store. Bumping after every successful write triggers next-intl to
 * refetch on the client (request.ts is keyed off `readVersion()`),
 * which is enough to pick up the freshly-rewritten import.
 */

import { promises as fs } from "node:fs"
import path from "node:path"
import { assertSafePath } from "@/shared/utils/safe-path"
import { logger } from "@/shared/logger"
import { SUPPORTED_LOCALES, type SupportedLocale } from "./constants"
import { buildFlatKey, bumpVersion, readOverrides, readVersion, removeOverride } from "./storage"

/**
 * Filename remap for namespaces whose `t()` key differs from the filename
 * on disk. Keep this in sync with `NAMESPACE_FILENAME` in src/i18n/request.ts.
 */
const NAMESPACE_FILENAME: Record<string, string> = { Enum: "enum" }

/** Allowed namespace tokens — letters, digits, underscores; must start with a letter. */
const NAMESPACE_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/

/**
 * Key segments that, if accepted by deep-set, would mutate every object on
 * the prototype chain. We reject keyPaths that contain ANY of these as a
 * whole segment so a crafted payload can't poison Object.prototype.
 */
const DANGEROUS_KEY_SEGMENT = /^(?:__proto__|constructor|prototype)$/

export class InvalidNamespaceError extends Error {
  constructor(public readonly namespace: string) {
    super(`Invalid namespace "${namespace}"`)
    this.name = "InvalidNamespaceError"
  }
}

export class InvalidKeyPathError extends Error {
  constructor(
    public readonly keyPath: string,
    public readonly detail: string,
  ) {
    super(`Invalid keyPath "${keyPath}": ${detail}`)
    this.name = "InvalidKeyPathError"
  }
}

export class ProtoPollutionError extends Error {
  constructor(public readonly segment: string) {
    super(`keyPath segment "${segment}" is not allowed`)
    this.name = "ProtoPollutionError"
  }
}

// ─── Lock layer ────────────────────────────────────────────────────────────

const locks = new Map<string, Promise<unknown>>()

function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = locks.get(key) ?? Promise.resolve()
  const next = previous.then(fn, fn)
  // The bookkeeping chain only exists to evict the lock entry once `next`
  // settles. We attach `.catch(noop)` so its tail isn't flagged as an
  // unhandled rejection when fn() throws — the actual rejection still
  // propagates to the caller via the returned `next`.
  const tail = next.finally(() => {
    if (locks.get(key) === next) locks.delete(key)
  })
  tail.catch(() => {
    /* observed; the caller sees the real rejection on `next` */
  })
  locks.set(key, tail)
  return next
}

function lockKey(locale: SupportedLocale, namespace: string): string {
  return `${locale}:${namespace}`
}

/**
 * Acquire the per-(locale,namespace) locks for several locales before running
 * `fn`. Locales are sorted so the acquisition order is deterministic across
 * callers — without that, two concurrent all-locale writes could grab the
 * locks in opposite orders and deadlock.
 */
function withLocks<T>(locales: readonly SupportedLocale[], namespace: string, fn: () => Promise<T>): Promise<T> {
  const ordered = [...locales].sort()
  const run = (i: number): Promise<T> => {
    if (i >= ordered.length) return fn()
    return withLock(lockKey(ordered[i]!, namespace), () => run(i + 1))
  }
  return run(0)
}

// ─── Path + key validation ─────────────────────────────────────────────────

function sourceFilePath(locale: SupportedLocale, namespace: string): string {
  if (!NAMESPACE_PATTERN.test(namespace)) throw new InvalidNamespaceError(namespace)
  const filename = NAMESPACE_FILENAME[namespace] ?? namespace
  // assertSafePath enforces the "messages/..." allowed root so a tampered
  // filename (e.g. "../../something") is rejected before any fs call.
  return assertSafePath(path.join("messages", locale, `${filename}.json`))
}

function splitKeyPath(keyPath: string): string[] {
  const trimmed = keyPath.trim()
  if (trimmed === "") throw new InvalidKeyPathError(keyPath, "must be non-empty")
  const segments = trimmed.split(".")
  for (const seg of segments) {
    if (seg === "") throw new InvalidKeyPathError(keyPath, "contains empty segment")
    if (DANGEROUS_KEY_SEGMENT.test(seg)) throw new ProtoPollutionError(seg)
  }
  return segments
}

// ─── Disk I/O ──────────────────────────────────────────────────────────────

async function readSource(locale: SupportedLocale, namespace: string): Promise<Record<string, unknown>> {
  const file = sourceFilePath(locale, namespace)
  try {
    const raw = await fs.readFile(file, "utf8")
    const parsed = JSON.parse(raw) as unknown
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return {}
    return parsed as Record<string, unknown>
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return {}
    throw err
  }
}

async function writeSource(locale: SupportedLocale, namespace: string, json: Record<string, unknown>): Promise<void> {
  const file = sourceFilePath(locale, namespace)
  await fs.mkdir(path.dirname(file), { recursive: true })
  // 4-space indent + trailing newline matches every existing namespace file.
  await fs.writeFile(file, JSON.stringify(json, null, 4) + "\n", "utf8")
}

/**
 * Drop any override that would shadow the just-written source key.
 *
 * The override store wins at read time (see applyOverrides in
 * src/i18n/request.ts), so a successful source write followed by no override
 * cleanup leaves the admin's edit invisible — they fix the source, the UI
 * still shows the stale override value. We use the SAME namespace token the
 * caller passed (e.g. "Enum", not the on-disk "enum") because the override
 * store keys against the `t()`-side namespace, not the filename.
 *
 * Failure mode: this runs after writeSource has committed. A throw here
 * MUST NOT bubble up — the source change is already on disk, and forcing
 * the route handler to 500 over an override-cleanup hiccup would be wrong.
 * We log and move on; the override survives until manually cleared.
 */
async function clearShadowingOverride(locale: SupportedLocale, namespace: string, keyPath: string): Promise<void> {
  const flatKey = buildFlatKey(namespace, keyPath)
  try {
    const overrides = await readOverrides(locale)
    if (!(flatKey in overrides)) return
    await removeOverride(locale, flatKey)
  } catch (err) {
    logger.warn("[i18n-source-write] failed to clear shadowing override; source write was applied", {
      locale,
      namespace,
      keyPath,
      err,
    })
  }
}

// ─── Deep mutations ────────────────────────────────────────────────────────

/**
 * Set `value` at the dotted path inside `root`, creating intermediate plain
 * objects as needed. Overwrites any non-object value at an intermediate
 * segment (deliberate: the admin is editing the source, and the alternative
 * — refusing the write — is worse UX than a clear "you replaced a leaf").
 */
function deepSet(root: Record<string, unknown>, segments: readonly string[], value: string): void {
  let cursor: Record<string, unknown> = root
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i]!
    const next = cursor[seg]
    if (typeof next !== "object" || next === null || Array.isArray(next)) {
      cursor[seg] = {}
    }
    cursor = cursor[seg] as Record<string, unknown>
  }
  cursor[segments[segments.length - 1]!] = value
}

/**
 * Unset the dotted path. Walks back up and removes empty parents so the
 * source file doesn't grow stranded `"foo": {}` husks after a delete.
 * Returns false (no-op) when the key didn't exist to begin with.
 */
function deepUnset(root: Record<string, unknown>, segments: readonly string[]): boolean {
  const stack: Array<{ container: Record<string, unknown>; key: string }> = []
  let cursor: Record<string, unknown> = root

  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i]!
    const next = cursor[seg]
    if (typeof next !== "object" || next === null || Array.isArray(next)) return false
    stack.push({ container: cursor, key: seg })
    cursor = next as Record<string, unknown>
  }

  const last = segments[segments.length - 1]!
  if (!(last in cursor)) return false
  delete cursor[last]

  // Collapse empty ancestors back up to (but not including) the namespace root.
  for (let i = stack.length - 1; i >= 0; i--) {
    const frame = stack[i]!
    const child = frame.container[frame.key]
    if (child && typeof child === "object" && !Array.isArray(child) && Object.keys(child).length === 0) {
      delete frame.container[frame.key]
    } else {
      break
    }
  }
  return true
}

// ─── Public API ────────────────────────────────────────────────────────────

export interface SourceWriteResult {
  json: Record<string, unknown>
  version: number
}

export interface SourceUnsetResult extends SourceWriteResult {
  removed: boolean
}

/** Read the full namespace JSON as it lives on disk (or {} if missing). */
export async function getNamespaceSource(locale: SupportedLocale, namespace: string): Promise<Record<string, unknown>> {
  // No lock on reads: stale-once-after-write is acceptable, and the route
  // handler can re-fetch if it sees a 409 in the future.
  return readSource(locale, namespace)
}

/**
 * Deep-set a string at `keyPath` inside the namespace file. Always rewrites
 * the file (even when the value is unchanged) so the caller's mental model
 * of "patch returned 200 → file reflects my change" is preserved.
 */
export async function setSourceKey(
  locale: SupportedLocale,
  namespace: string,
  keyPath: string,
  value: string,
): Promise<SourceWriteResult> {
  const segments = splitKeyPath(keyPath)
  return withLock(lockKey(locale, namespace), async () => {
    const json = await readSource(locale, namespace)
    deepSet(json, segments, value)
    await writeSource(locale, namespace, json)
    // Without this, an override on the same key would keep winning at read
    // time and the admin's source edit would appear to have no effect.
    await clearShadowingOverride(locale, namespace, keyPath)
    const version = await bumpVersion()
    return { json, version }
  })
}

/**
 * Deep-unset `keyPath` inside the namespace file. No-op (removed: false)
 * when the path didn't exist — the route returns 404 in that case.
 */
export async function unsetSourceKey(
  locale: SupportedLocale,
  namespace: string,
  keyPath: string,
): Promise<SourceUnsetResult> {
  const segments = splitKeyPath(keyPath)
  return withLock(lockKey(locale, namespace), async () => {
    const json = await readSource(locale, namespace)
    const removed = deepUnset(json, segments)
    if (!removed) {
      return { json, version: await readVersion(), removed: false }
    }
    await writeSource(locale, namespace, json)
    // Drop any shadowing override too — otherwise the override would
    // resurrect the value the admin just removed from source.
    await clearShadowingOverride(locale, namespace, keyPath)
    const version = await bumpVersion()
    return { json, version, removed: true }
  })
}

// ─── Parity helpers ──────────────────────────────────────────────────────────

/**
 * Resolve the dotted path and report whether it lands on a defined value
 * (string leaf OR an existing object branch). Used by the parity guard: a
 * single-locale write may only EDIT a key that already exists in every other
 * locale — creating a sibling-absent key would break the en/ar parity gate.
 */
export async function keyExistsInLocale(
  locale: SupportedLocale,
  namespace: string,
  keyPath: string,
): Promise<boolean> {
  const segments = splitKeyPath(keyPath)
  const json = await readSource(locale, namespace)
  let cursor: unknown = json
  for (const seg of segments) {
    if (typeof cursor !== "object" || cursor === null || Array.isArray(cursor)) return false
    cursor = (cursor as Record<string, unknown>)[seg]
    if (cursor === undefined) return false
  }
  return true
}

/**
 * True when `keyPath` exists in EVERY locale other than `locale`. The route's
 * single-locale PATCH uses this: if it returns false the write would introduce
 * a key missing from a sibling locale, so the caller must instead create the
 * key in all locales at once via {@link setSourceKeyAllLocales}.
 */
export async function existsInAllSiblingLocales(
  locale: SupportedLocale,
  namespace: string,
  keyPath: string,
): Promise<boolean> {
  for (const sibling of SUPPORTED_LOCALES) {
    if (sibling === locale) continue
    if (!(await keyExistsInLocale(sibling, namespace, keyPath))) return false
  }
  return true
}

export interface AllLocalesWriteResult {
  version: number
  byLocale: Record<SupportedLocale, Record<string, unknown>>
}

/**
 * Atomically deep-set `keyPath` in EVERY supported locale's namespace file —
 * the parity-preserving way to create (or rewrite) a translation key. Reads all
 * originals first, then writes; if any write fails the already-written files are
 * restored to their original contents so a partial, parity-broken state can't
 * survive. Bumps the shared version counter once.
 */
export async function setSourceKeyAllLocales(
  namespace: string,
  keyPath: string,
  valuesByLocale: Record<SupportedLocale, string>,
): Promise<AllLocalesWriteResult> {
  const segments = splitKeyPath(keyPath)
  // Validate the namespace token once (throws InvalidNamespaceError) before
  // touching any locale file.
  sourceFilePath(SUPPORTED_LOCALES[0]!, namespace)

  return withLocks(SUPPORTED_LOCALES, namespace, async () => {
    const originals = {} as Record<SupportedLocale, Record<string, unknown>>
    const updated = {} as Record<SupportedLocale, Record<string, unknown>>

    for (const loc of SUPPORTED_LOCALES) {
      const current = await readSource(loc, namespace)
      originals[loc] = current
      const working = JSON.parse(JSON.stringify(current)) as Record<string, unknown>
      deepSet(working, segments, valuesByLocale[loc])
      updated[loc] = working
    }

    const written: SupportedLocale[] = []
    try {
      for (const loc of SUPPORTED_LOCALES) {
        await writeSource(loc, namespace, updated[loc])
        written.push(loc)
      }
    } catch (err) {
      // Roll back every file we managed to write so we never leave the key in
      // some locales but not others.
      for (const loc of written) {
        try {
          await writeSource(loc, namespace, originals[loc])
        } catch (rollbackErr) {
          logger.error("[i18n-source-write] rollback failed for locale", { loc, namespace, rollbackErr })
        }
      }
      throw err
    }

    for (const loc of SUPPORTED_LOCALES) {
      await clearShadowingOverride(loc, namespace, keyPath)
    }
    const version = await bumpVersion()
    return { version, byLocale: updated }
  })
}

/** Test-only escape hatch — drops the in-process lock map. */
export const __testHooks = {
  resetLocksForTests(): void {
    locks.clear()
  },
}
