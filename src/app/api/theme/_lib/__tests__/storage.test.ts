/**
 * Cache behavior tests for the theme override store.
 *
 * Cache hits are verified indirectly: after a successful read primes the
 * cache, deleting the underlying file should NOT cause subsequent
 * `readStore()` calls to throw — they're served from memory. After a
 * test-hook reset, the file is gone (or different) and the next read
 * reflects that.
 *
 * This avoids spying on `fs/promises` directly, which vitest can't do
 * for live ESM exports without a top-level `vi.mock`.
 */

import { mkdtempSync, rmSync, writeFileSync, mkdirSync, unlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const ORIGINAL_CWD = process.cwd()
let sandbox: string

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), "theme-storage-test-"))
  process.chdir(sandbox)
  // Drop the cached module evaluation so THEME_FILE resolves under <sandbox>.
  vi.resetModules()
})

afterEach(() => {
  process.chdir(ORIGINAL_CWD)
  rmSync(sandbox, { recursive: true, force: true })
})

async function loadModule() {
  return await import("../storage")
}

function themeFilePath(): string {
  return join(sandbox, "messages", "_overrides", "theme.json")
}

function seedThemeFile(content: object): void {
  const file = themeFilePath()
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(content))
}

describe("theme storage cache", () => {
  it("warm read returns the same reference and does not require the file to still exist", async () => {
    seedThemeFile({
      draft: { tokens: { "--primary": "blue" }, updatedBy: null, updatedAt: null },
      live: { tokens: { "--primary": "red" }, updatedBy: null, updatedAt: null },
      version: 7,
    })
    const mod = await loadModule()

    const cold = await mod.readStore()
    expect(cold.version).toBe(7)

    // Removing the file proves the second read is served from memory: a
    // disk-backed implementation would throw ENOENT here.
    unlinkSync(themeFilePath())
    const warm = await mod.readStore()

    expect(warm).toBe(cold)
    expect(warm.version).toBe(7)
  })

  it("write helpers replace the cache atomically (write then read returns the new snapshot)", async () => {
    seedThemeFile({
      draft: { tokens: {}, updatedBy: null, updatedAt: null },
      live: { tokens: {}, updatedBy: null, updatedAt: null },
      version: 0,
    })
    const mod = await loadModule()
    await mod.readStore()

    const after = await mod.saveDraft({ "--primary": "purple" }, "alice")
    expect(after.draft.tokens).toEqual({ "--primary": "purple" })

    // Re-read after delete — must come from cache.
    unlinkSync(themeFilePath())
    const reread = await mod.readStore()
    expect(reread).toBe(after)
    expect(reread.draft.tokens).toEqual({ "--primary": "purple" })
  })

  it("writers build a fresh next snapshot — the cached pre-write value stays intact", async () => {
    // Regression guard for the hazard introduced when readStore() became a
    // shared cached reference: a writer that mutated `store.draft = …` in
    // place would have leaked half-built state to concurrent readers.
    // The current writer constructs a new object; we assert the
    // pre-write snapshot is preserved (different identity from `after`).
    seedThemeFile({
      draft: { tokens: { "--primary": "blue" }, updatedBy: null, updatedAt: null },
      live: { tokens: { "--primary": "blue" }, updatedBy: null, updatedAt: null },
      version: 0,
    })
    const mod = await loadModule()
    const before = await mod.readStore()

    const after = await mod.saveDraft({ "--primary": "purple" }, "alice")
    expect(after).not.toBe(before) // different reference
    expect(before.draft.tokens).toEqual({ "--primary": "blue" }) // unchanged
    expect(after.draft.tokens).toEqual({ "--primary": "purple" })
  })

  it("publishDraft promotes draft → live and bumps version", async () => {
    seedThemeFile({
      draft: { tokens: { "--primary": "purple" }, updatedBy: "a", updatedAt: "t1" },
      live: { tokens: { "--primary": "blue" }, updatedBy: "a", updatedAt: "t0" },
      version: 3,
    })
    const mod = await loadModule()
    await mod.readStore()

    const after = await mod.publishDraft("bob")
    expect(after.live.tokens).toEqual({ "--primary": "purple" })
    expect(after.version).toBe(4)
    expect(after.live.updatedBy).toBe("bob")

    expect(await mod.readVersion()).toBe(4)
  })

  it("test-hook reset drops the cache; next read reflects on-disk reality", async () => {
    seedThemeFile({
      draft: { tokens: {}, updatedBy: null, updatedAt: null },
      live: { tokens: {}, updatedBy: null, updatedAt: null },
      version: 1,
    })
    const mod = await loadModule()
    const first = await mod.readStore()
    expect(first.version).toBe(1)

    // Mutate the file out-of-band, then prove the cache still serves the
    // stale value (no auto-invalidation on a same-process write).
    seedThemeFile({
      draft: { tokens: {}, updatedBy: null, updatedAt: null },
      live: { tokens: {}, updatedBy: null, updatedAt: null },
      version: 9,
    })
    const stillStale = await mod.readStore()
    expect(stillStale.version).toBe(1)
    expect(stillStale).toBe(first)

    // Forcing a reset is what fs.watch does on external change. After it,
    // the next read picks up the new disk state.
    mod.__testHooks.resetCacheForTests()
    const fresh = await mod.readStore()
    expect(fresh.version).toBe(9)
    expect(fresh).not.toBe(first)
  })

  it("missing file returns the empty store and caches it", async () => {
    // No seed — the file doesn't exist.
    const mod = await loadModule()
    const empty = await mod.readStore()
    expect(empty.version).toBe(0)
    expect(empty.draft.tokens).toEqual({})

    // Subsequent read returns the same cached EMPTY_STORE reference.
    const again = await mod.readStore()
    expect(again).toBe(empty)
  })
})
