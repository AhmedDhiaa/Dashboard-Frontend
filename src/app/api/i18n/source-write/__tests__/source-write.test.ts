/**
 * Storage-layer behaviour for the /api/i18n/source-write endpoint.
 *
 * The HTTP glue (auth, env gate, JSON parse) is intentionally thin and
 * mirrors the page-builder materialize route, which is already covered
 * elsewhere. The interesting logic — deep set/unset, prototype-pollution
 * rejection, the per-(locale,namespace) lock, namespace path safety —
 * all lives in _lib/source-storage.ts, so the tests target that module
 * directly. Each test chdirs into a fresh tmp sandbox so the production
 * cwd never gets touched.
 */

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const ORIGINAL_CWD = process.cwd()
let sandbox: string

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), "i18n-source-write-test-"))
  process.chdir(sandbox)
  // Each test gets a clean module graph so the in-process lock map +
  // override cache from one test don't leak into the next.
  vi.resetModules()
})

afterEach(() => {
  process.chdir(ORIGINAL_CWD)
  rmSync(sandbox, { recursive: true, force: true })
})

async function loadStorage() {
  return await import("../../_lib/source-storage")
}

function namespacePath(locale: string, filename: string): string {
  return join(sandbox, "messages", locale, `${filename}.json`)
}

function seed(locale: string, filename: string, content: object): void {
  const file = namespacePath(locale, filename)
  mkdirSync(join(sandbox, "messages", locale), { recursive: true })
  writeFileSync(file, JSON.stringify(content, null, 4) + "\n", "utf8")
}

function readNamespace(locale: string, filename: string): unknown {
  return JSON.parse(readFileSync(namespacePath(locale, filename), "utf8"))
}

describe("source-storage: deep-set", () => {
  it("creates missing intermediate parents", async () => {
    seed("en", "common", { existing: "leaf" })
    const mod = await loadStorage()

    await mod.setSourceKey("en", "common", "deeply.nested.new.key", "Hello")

    expect(readNamespace("en", "common")).toEqual({
      existing: "leaf",
      deeply: { nested: { new: { key: "Hello" } } },
    })
  })

  it("preserves the 4-space indent + trailing newline file format", async () => {
    seed("en", "common", { a: "1" })
    const mod = await loadStorage()
    await mod.setSourceKey("en", "common", "b", "2")

    const raw = readFileSync(namespacePath("en", "common"), "utf8")
    expect(raw.endsWith("\n")).toBe(true)
    // Two top-level keys → at least two 4-space-indented lines.
    expect(raw).toMatch(/\n    "a": "1",/)
    expect(raw).toMatch(/\n    "b": "2"/)
  })

  it("overwrites an existing leaf in place", async () => {
    seed("en", "common", { greeting: "Hi" })
    const mod = await loadStorage()
    await mod.setSourceKey("en", "common", "greeting", "Hello")
    expect(readNamespace("en", "common")).toEqual({ greeting: "Hello" })
  })

  it("creates the namespace file when it doesn't exist yet", async () => {
    const mod = await loadStorage()
    await mod.setSourceKey("ar", "common", "welcome", "مرحبا")
    expect(readNamespace("ar", "common")).toEqual({ welcome: "مرحبا" })
  })

  it("remaps Enum → enum.json (filename / namespace mismatch)", async () => {
    const mod = await loadStorage()
    await mod.setSourceKey("en", "Enum", "Status.active", "Active")
    // The on-disk filename is the lowercased form.
    expect(readNamespace("en", "enum")).toEqual({ Status: { active: "Active" } })
  })
})

describe("source-storage: deep-unset", () => {
  it("removes a leaf and collapses empty parents up to the namespace root", async () => {
    seed("en", "common", { a: { b: { c: "leaf" }, sibling: "stays" } })
    const mod = await loadStorage()

    const result = await mod.unsetSourceKey("en", "common", "a.b.c")
    expect(result.removed).toBe(true)

    // `a.b` should have collapsed (no more children), but `a.sibling` keeps `a`.
    expect(readNamespace("en", "common")).toEqual({ a: { sibling: "stays" } })
  })

  it("collapses all the way to top-level when no siblings remain", async () => {
    seed("en", "common", { only: { child: { leaf: "x" } } })
    const mod = await loadStorage()

    await mod.unsetSourceKey("en", "common", "only.child.leaf")
    expect(readNamespace("en", "common")).toEqual({})
  })

  it("returns removed:false (no rewrite, no version bump) when the key is missing", async () => {
    seed("en", "common", { a: "1" })
    const mod = await loadStorage()
    const before = readFileSync(namespacePath("en", "common"), "utf8")

    const result = await mod.unsetSourceKey("en", "common", "ghost.key")
    expect(result.removed).toBe(false)

    // File untouched.
    expect(readFileSync(namespacePath("en", "common"), "utf8")).toBe(before)
  })
})

describe("source-storage: validation", () => {
  it.each(["__proto__", "constructor", "prototype"])("rejects '%s' as a keyPath segment", async dangerous => {
    const mod = await loadStorage()
    await expect(mod.setSourceKey("en", "common", `${dangerous}.poisoned`, "x")).rejects.toBeInstanceOf(
      mod.ProtoPollutionError,
    )
    // Also rejects when the dangerous segment is mid-path.
    await expect(mod.setSourceKey("en", "common", `safe.${dangerous}.x`, "x")).rejects.toBeInstanceOf(
      mod.ProtoPollutionError,
    )
  })

  it("rejects empty keyPath segments", async () => {
    const mod = await loadStorage()
    await expect(mod.setSourceKey("en", "common", "a..b", "x")).rejects.toBeInstanceOf(mod.InvalidKeyPathError)
    await expect(mod.setSourceKey("en", "common", ".leading", "x")).rejects.toBeInstanceOf(mod.InvalidKeyPathError)
  })

  it("rejects namespaces that would land outside the messages tree", async () => {
    const mod = await loadStorage()

    // path traversal: ../ inside the namespace string would escape locale dir.
    await expect(mod.setSourceKey("en", "../etc/passwd", "x", "y")).rejects.toBeInstanceOf(mod.InvalidNamespaceError)

    // path separators (forward + back) are also invalid namespace tokens.
    await expect(mod.setSourceKey("en", "sub/dir", "x", "y")).rejects.toBeInstanceOf(mod.InvalidNamespaceError)
    await expect(mod.setSourceKey("en", "sub\\dir", "x", "y")).rejects.toBeInstanceOf(mod.InvalidNamespaceError)
  })

  it("guarantees Object.prototype is not poisoned even by a crafted payload", async () => {
    const mod = await loadStorage()
    await expect(mod.setSourceKey("en", "common", "__proto__.polluted", "yes")).rejects.toBeDefined()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(({} as any).polluted).toBeUndefined()
  })
})

describe("source-storage: concurrency", () => {
  it("two concurrent PATCHes on the same namespace both land — neither write is lost", async () => {
    seed("en", "common", {})
    const mod = await loadStorage()

    // Fire both writes "simultaneously". Without the per-(locale,namespace)
    // lock the second readSource() would race the first's writeFile() and
    // one of the two values would be lost.
    await Promise.all([mod.setSourceKey("en", "common", "first", "A"), mod.setSourceKey("en", "common", "second", "B")])

    expect(readNamespace("en", "common")).toEqual({ first: "A", second: "B" })
  })

  it("100 concurrent PATCHes on the same namespace all land", async () => {
    seed("en", "common", {})
    const mod = await loadStorage()

    const writes = Array.from({ length: 100 }, (_, i) => mod.setSourceKey("en", "common", `k${i}`, `v${i}`))
    await Promise.all(writes)

    const result = readNamespace("en", "common") as Record<string, string>
    expect(Object.keys(result)).toHaveLength(100)
    for (let i = 0; i < 100; i++) expect(result[`k${i}`]).toBe(`v${i}`)
  })

  it("concurrent writes on different namespaces don't contend (different locks)", async () => {
    const mod = await loadStorage()
    await Promise.all([
      mod.setSourceKey("en", "common", "x", "1"),
      mod.setSourceKey("en", "auth", "y", "2"),
      mod.setSourceKey("ar", "common", "z", "3"),
    ])

    expect(readNamespace("en", "common")).toEqual({ x: "1" })
    expect(readNamespace("en", "auth")).toEqual({ y: "2" })
    expect(readNamespace("ar", "common")).toEqual({ z: "3" })
  })
})

describe("source-storage: shadowing-override cleanup", () => {
  it("PATCH clears any matching override so the source write isn't shadowed at read time", async () => {
    // Seed an override that would otherwise win at read time (applyOverrides
    // in src/i18n/request.ts runs after the source JSON is loaded).
    const overrides = await import("../../_lib/storage")
    await overrides.setOverride("en", "common.greeting", "Old override")

    const mod = await loadStorage()
    await mod.setSourceKey("en", "common", "greeting", "Fresh from source")

    // Source-side: the new value is on disk.
    expect(readNamespace("en", "common")).toEqual({ greeting: "Fresh from source" })
    // Override-side: the shadowing entry is gone, so the source value wins.
    const remaining = await overrides.readOverrides("en")
    expect(remaining).not.toHaveProperty("common.greeting")
  })

  it("DELETE clears any matching override too", async () => {
    // Source must contain the key for unsetSourceKey to take the write
    // branch (and therefore the override-cleanup branch).
    seed("en", "common", { greeting: "Hi" })
    const overrides = await import("../../_lib/storage")
    await overrides.setOverride("en", "common.greeting", "Override of doomed key")

    const mod = await loadStorage()
    const result = await mod.unsetSourceKey("en", "common", "greeting")
    expect(result.removed).toBe(true)

    // Override-side: the entry is gone — it would otherwise resurrect the value.
    const remaining = await overrides.readOverrides("en")
    expect(remaining).not.toHaveProperty("common.greeting")
  })
})

describe("source-storage: read-only helper", () => {
  it("returns {} when the namespace file is missing", async () => {
    const mod = await loadStorage()
    expect(await mod.getNamespaceSource("en", "common")).toEqual({})
  })

  it("returns the parsed nested JSON when present", async () => {
    seed("en", "common", { nested: { value: "X" } })
    const mod = await loadStorage()
    expect(await mod.getNamespaceSource("en", "common")).toEqual({ nested: { value: "X" } })
  })
})

describe("source-storage: parity helpers", () => {
  it("keyExistsInLocale: true for an existing leaf/branch, false for a missing path or file", async () => {
    seed("en", "common", { a: { b: "leaf" } })
    const mod = await loadStorage()
    expect(await mod.keyExistsInLocale("en", "common", "a.b")).toBe(true)
    expect(await mod.keyExistsInLocale("en", "common", "a")).toBe(true) // existing branch
    expect(await mod.keyExistsInLocale("en", "common", "a.c")).toBe(false)
    expect(await mod.keyExistsInLocale("en", "common", "x.y.z")).toBe(false)
    expect(await mod.keyExistsInLocale("ar", "common", "a.b")).toBe(false) // file absent
  })

  it("existsInAllSiblingLocales: true only when every OTHER locale has the key", async () => {
    // Key present in en only.
    seed("en", "common", { shared: "x" })
    const mod = await loadStorage()
    // From en's view its sibling (ar) lacks it → false (re-writing en wouldn't fix parity).
    expect(await mod.existsInAllSiblingLocales("en", "common", "shared")).toBe(false)
    // From ar's view its sibling (en) HAS it → true (writing ar RESTORES parity).
    expect(await mod.existsInAllSiblingLocales("ar", "common", "shared")).toBe(true)
  })

  it("existsInAllSiblingLocales: true when the key is present in both locales", async () => {
    seed("en", "common", { shared: "x" })
    seed("ar", "common", { shared: "ص" })
    const mod = await loadStorage()
    expect(await mod.existsInAllSiblingLocales("en", "common", "shared")).toBe(true)
    expect(await mod.existsInAllSiblingLocales("ar", "common", "shared")).toBe(true)
  })
})

describe("source-storage: atomic all-locale write", () => {
  it("creates the key in EVERY locale and bumps the version once", async () => {
    const mod = await loadStorage()
    const result = await mod.setSourceKeyAllLocales("common", "actions.add", { en: "Add", ar: "إضافة" })
    expect(readNamespace("en", "common")).toEqual({ actions: { add: "Add" } })
    expect(readNamespace("ar", "common")).toEqual({ actions: { add: "إضافة" } })
    expect(typeof result.version).toBe("number")
  })

  it("deep-merges — existing keys in each locale are preserved", async () => {
    seed("en", "common", { existing: "keep" })
    seed("ar", "common", { existing: "احتفظ" })
    const mod = await loadStorage()
    await mod.setSourceKeyAllLocales("common", "fresh", { en: "Fresh", ar: "جديد" })
    expect(readNamespace("en", "common")).toEqual({ existing: "keep", fresh: "Fresh" })
    expect(readNamespace("ar", "common")).toEqual({ existing: "احتفظ", fresh: "جديد" })
  })

  it("rolls back already-written locales when a later write fails (no partial parity break)", async () => {
    seed("en", "common", { original: "en-value" })
    seed("ar", "common", { original: "ar-value" })
    const mod = await loadStorage()

    // Make the SECOND file write (ar, written after en) throw, then assert en
    // is restored to its original contents rather than left with the new key.
    const fsPromises = (await import("node:fs")).promises
    const realWriteFile = fsPromises.writeFile.bind(fsPromises)
    const arDir = join("messages", "ar")
    const spy = vi.spyOn(fsPromises, "writeFile").mockImplementation((file, data, opts) => {
      if (String(file).includes(arDir) && String(data).includes("newkey")) {
        return Promise.reject(new Error("disk full (simulated)"))
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return realWriteFile(file as any, data as any, opts as any)
    })

    await expect(
      mod.setSourceKeyAllLocales("common", "newkey", { en: "EN", ar: "AR" }),
    ).rejects.toThrow(/disk full/)

    // en was written then rolled back → back to the original, no orphaned key.
    expect(readNamespace("en", "common")).toEqual({ original: "en-value" })
    spy.mockRestore()
  })
})
