/**
 * Coverage for the planned-files diff renderer used by the wizard's review
 * tab. Tests run inside a tmp cwd so `path.resolve(ROOT, file.path)` aims at
 * fixture files we control, never the real source tree.
 */

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const ORIGINAL_CWD = process.cwd()
let sandbox: string

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), "diff-test-"))
  process.chdir(sandbox)
  // Drop the cached module evaluation so `ROOT = process.cwd()` resolves
  // to the per-test sandbox.
  vi.resetModules()
})

afterEach(() => {
  process.chdir(ORIGINAL_CWD)
  rmSync(sandbox, { recursive: true, force: true })
})

async function load() {
  return await import("../diff")
}

function seedFile(rel: string, content: string): void {
  const abs = join(sandbox, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, content)
}

describe("diffPlannedFiles", () => {
  it("flags files that don't exist on disk as 'new' with every line prefixed +", async () => {
    const mod = await load()
    const result = await mod.diffPlannedFiles([{ path: "src/foo/bar.ts", content: "line1\nline2", language: "ts" }])
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ path: "src/foo/bar.ts", status: "new" })
    expect(result[0]!.diff).toBe("+line1\n+line2")
  })

  it("flags byte-identical files as 'unchanged' with an empty diff", async () => {
    seedFile("src/keep.ts", "same content\n")
    const mod = await load()
    const result = await mod.diffPlannedFiles([{ path: "src/keep.ts", content: "same content\n", language: "ts" }])
    expect(result[0]).toEqual({ path: "src/keep.ts", status: "unchanged", diff: "" })
  })

  it("emits a unified-style diff for modified files: context lines, -old, +new", async () => {
    seedFile("src/edit.ts", "alpha\nbeta\ngamma")
    const mod = await load()
    const result = await mod.diffPlannedFiles([{ path: "src/edit.ts", content: "alpha\nBETA\ngamma", language: "ts" }])
    expect(result[0]!.status).toBe("modified")
    const diff = result[0]!.diff
    expect(diff).toContain(" alpha")
    expect(diff).toContain("-beta")
    expect(diff).toContain("+BETA")
    expect(diff).toContain(" gamma")
  })

  it("handles uneven line counts (extra new lines appear as additions)", async () => {
    seedFile("src/grow.ts", "one\ntwo")
    const mod = await load()
    const result = await mod.diffPlannedFiles([
      { path: "src/grow.ts", content: "one\ntwo\nthree\nfour", language: "ts" },
    ])
    const diff = result[0]!.diff
    expect(diff).toContain(" one")
    expect(diff).toContain(" two")
    expect(diff).toContain("+three")
    expect(diff).toContain("+four")
  })

  it("handles files that shrunk (extra old lines appear as deletions)", async () => {
    seedFile("src/shrink.ts", "one\ntwo\nthree\nfour")
    const mod = await load()
    const result = await mod.diffPlannedFiles([{ path: "src/shrink.ts", content: "one\ntwo", language: "ts" }])
    const diff = result[0]!.diff
    expect(diff).toContain(" one")
    expect(diff).toContain(" two")
    expect(diff).toContain("-three")
    expect(diff).toContain("-four")
  })

  it("preserves order across multiple files and reports each independently", async () => {
    seedFile("a.ts", "x")
    const mod = await load()
    const result = await mod.diffPlannedFiles([
      { path: "a.ts", content: "x", language: "ts" },
      { path: "b.ts", content: "+new", language: "ts" },
    ])
    expect(result.map(r => [r.path, r.status])).toEqual([
      ["a.ts", "unchanged"],
      ["b.ts", "new"],
    ])
  })
})
