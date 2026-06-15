/**
 * Cache behavior tests for the i18n override store.
 *
 * Same approach as the theme storage tests: cache hits are verified
 * indirectly by deleting (or rewriting) the underlying file after a
 * priming read and asserting subsequent reads still return the original.
 */

import { mkdtempSync, rmSync, writeFileSync, mkdirSync, unlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const ORIGINAL_CWD = process.cwd()
let sandbox: string

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), "i18n-storage-test-"))
  process.chdir(sandbox)
  vi.resetModules()
})

afterEach(() => {
  process.chdir(ORIGINAL_CWD)
  rmSync(sandbox, { recursive: true, force: true })
})

async function loadModule() {
  return await import("../storage")
}

function overridesDir(): string {
  return join(sandbox, "messages", "_overrides")
}

function localePath(locale: string): string {
  return join(overridesDir(), `${locale}.json`)
}

function versionPath(): string {
  return join(overridesDir(), ".version")
}

function seed(locale: string, content: object): void {
  const file = localePath(locale)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(content))
}

function seedVersion(n: number): void {
  mkdirSync(overridesDir(), { recursive: true })
  writeFileSync(versionPath(), String(n) + "\n")
}

describe("i18n storage cache", () => {
  it("readOverrides warm read survives the underlying file being deleted", async () => {
    seed("en", { "common.greeting": "Hi" })
    const mod = await loadModule()

    const cold = await mod.readOverrides("en")
    expect(cold).toEqual({ "common.greeting": "Hi" })

    unlinkSync(localePath("en"))
    const warm = await mod.readOverrides("en")
    expect(warm).toBe(cold) // cache hit — same reference, file gone
  })

  it("readVersion warm read survives the version file being deleted", async () => {
    seedVersion(42)
    const mod = await loadModule()

    expect(await mod.readVersion()).toBe(42)
    unlinkSync(versionPath())
    expect(await mod.readVersion()).toBe(42) // cached
  })

  it("setOverride refreshes the cache atomically", async () => {
    seed("en", {})
    seedVersion(0)
    const mod = await loadModule()
    await mod.readOverrides("en")
    await mod.readVersion()

    const result = await mod.setOverride("en", "common.hello", "Hello")
    expect(result.map["common.hello"]).toBe("Hello")
    expect(result.version).toBe(1)

    // Both the override and version cache must reflect the write without
    // re-reading from disk.
    unlinkSync(localePath("en"))
    unlinkSync(versionPath())
    const fromCache = await mod.readOverrides("en")
    expect(fromCache["common.hello"]).toBe("Hello")
    expect(await mod.readVersion()).toBe(1)
  })

  it("removeOverride refreshes the cache; missing key returns removed:false without bumping", async () => {
    seed("en", { "common.hello": "Hi" })
    seedVersion(5)
    const mod = await loadModule()
    await mod.readOverrides("en")

    const removed = await mod.removeOverride("en", "common.hello")
    expect(removed.removed).toBe(true)
    expect(removed.version).toBe(6)
    expect(removed.map["common.hello"]).toBeUndefined()

    const noop = await mod.removeOverride("en", "missing.key")
    expect(noop.removed).toBe(false)
    expect(noop.version).toBe(6) // not bumped
  })

  it("setOverride does not leak in-flight state through the cached reference", async () => {
    seed("en", { "common.a": "1" })
    seedVersion(0)
    const mod = await loadModule()
    const before = await mod.readOverrides("en")

    const after = (await mod.setOverride("en", "common.b", "2")).map
    expect(after).not.toBe(before)
    expect(before).toEqual({ "common.a": "1" }) // pre-write snapshot intact
    expect(after).toEqual({ "common.a": "1", "common.b": "2" })
  })

  it("test-hook reset drops both caches; next reads pick up disk truth", async () => {
    seed("en", { "common.a": "1" })
    seedVersion(1)
    const mod = await loadModule()
    expect(await mod.readOverrides("en")).toEqual({ "common.a": "1" })
    expect(await mod.readVersion()).toBe(1)

    // Out-of-band edits the in-process cache won't see.
    seed("en", { "common.a": "9" })
    seedVersion(99)
    expect(await mod.readOverrides("en")).toEqual({ "common.a": "1" })
    expect(await mod.readVersion()).toBe(1)

    mod.__testHooks.resetCacheForTests()
    expect(await mod.readOverrides("en")).toEqual({ "common.a": "9" })
    expect(await mod.readVersion()).toBe(99)
  })

  it("missing override file returns empty map and caches it", async () => {
    const mod = await loadModule()
    const empty = await mod.readOverrides("ar")
    expect(empty).toEqual({})
    const again = await mod.readOverrides("ar")
    expect(again).toBe(empty)
  })
})
