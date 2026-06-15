/**
 * Allowlist + binary detection — these are the gates everything else
 * rests on. Pure functions, no git invocation required.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { ALLOWED_PREFIXES, isAllowedPath, isLikelyBinary, normaliseRepoPath, protectedBranches } from "../paths"

let sandbox: string

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), "git-bridge-paths-"))
})
afterEach(() => rmSync(sandbox, { recursive: true, force: true }))

describe("isAllowedPath", () => {
  it("accepts the spec'd prefixes", () => {
    for (const prefix of ALLOWED_PREFIXES) {
      expect(isAllowedPath(sandbox, prefix + "foo.json"), prefix).toBe(true)
    }
  })

  it("rejects paths outside the allowlist", () => {
    for (const p of ["node_modules/foo", ".env", "package.json", "src/shared/foo.ts", "messages/_overrides/x.json"]) {
      expect(isAllowedPath(sandbox, p), p).toBe(false)
    }
  })

  it("rejects path-traversal attempts", () => {
    for (const p of ["../etc/passwd", "messages/en/../../../etc/passwd", "messages/en/..\\..\\..\\evil"]) {
      expect(isAllowedPath(sandbox, p), p).toBe(false)
    }
  })

  it("rejects absolute paths even if they happen to land inside an allowlist prefix", () => {
    expect(isAllowedPath(sandbox, "/etc/passwd")).toBe(false)
    // An absolute path resolving INTO the sandbox would be normalised back
    // to the repo-relative form; we'd accept that only if it's inside an
    // allowlist prefix. This case shouldn't happen in practice (UI always
    // sends repo-relative paths) but pin the behaviour.
    expect(isAllowedPath(sandbox, join(sandbox, "messages/en/x.json"))).toBe(true)
  })

  it("normaliseRepoPath returns forward-slash repo-relative form", () => {
    expect(normaliseRepoPath(sandbox, "messages/en/x.json")).toBe("messages/en/x.json")
    expect(normaliseRepoPath(sandbox, "messages\\en\\x.json")).toBe("messages/en/x.json")
  })
})

describe("protectedBranches", () => {
  const ORIGINAL = process.env.GIT_PROTECTED_BRANCHES
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.GIT_PROTECTED_BRANCHES
    else process.env.GIT_PROTECTED_BRANCHES = ORIGINAL
  })

  it("defaults to main / master / production", () => {
    delete process.env.GIT_PROTECTED_BRANCHES
    expect(protectedBranches()).toEqual(["main", "master", "production"])
  })

  it("respects the env override and trims whitespace", () => {
    process.env.GIT_PROTECTED_BRANCHES = "  main , release/* ,develop"
    expect(protectedBranches()).toEqual(["main", "release/*", "develop"])
  })

  it("ignores empty entries from a trailing comma", () => {
    process.env.GIT_PROTECTED_BRANCHES = "main,,prod,"
    expect(protectedBranches()).toEqual(["main", "prod"])
  })
})

describe("isLikelyBinary", () => {
  it("returns false for an ASCII text file", async () => {
    const p = join(sandbox, "text.txt")
    writeFileSync(p, "hello world\nsecond line\n")
    expect(await isLikelyBinary(p)).toBe(false)
  })

  it("returns true when the file has a NUL in the first 8 KB", async () => {
    const p = join(sandbox, "binary.bin")
    const buf = Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x00, 0x6f])
    writeFileSync(p, buf)
    expect(await isLikelyBinary(p)).toBe(true)
  })

  it("returns true for an unreadable / missing file (safer to refuse)", async () => {
    expect(await isLikelyBinary(join(sandbox, "does-not-exist"))).toBe(true)
  })

  it("returns false for a large JSON file (matches translation use case)", async () => {
    const p = join(sandbox, "messages.json")
    mkdirSync(dirname(p), { recursive: true })
    const huge = JSON.stringify({ key: "x".repeat(20_000) })
    writeFileSync(p, huge)
    expect(await isLikelyBinary(p)).toBe(false)
  })
})
