/**
 * End-to-end safety tests against a real `git` sandbox repo.
 *
 * Each test creates a fresh sandbox via `git init`, seeds the allowlist
 * paths with content, makes working-tree changes, and then drives the
 * server modules directly (no HTTP, no Next route). This catches the
 * "the allowlist filter is wrong" and "we refused for the wrong reason"
 * classes of bug that pure unit tests can't see.
 */

import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { commit, CommitRefusedError, preview } from "../commit"
import { revertFiles } from "../revert"
import { getScopedStatus } from "../status"

let sandbox: string

function git(args: string[]): string {
  return execFileSync("git", args, { cwd: sandbox, encoding: "utf8" }).trim()
}

function seedFile(rel: string, content: string): void {
  const abs = join(sandbox, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, content)
}

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), "git-bridge-int-"))
  git(["init", "--initial-branch=main", "--quiet"])
  git(["config", "user.email", "tester@local"])
  git(["config", "user.name", "Tester"])
  git(["config", "commit.gpgsign", "false"])
  // Windows hosts default to autocrlf=true which would silently rewrite
  // LF → CRLF on checkout and fail the byte-equality assertions below.
  // The dev convention in this repo is LF everywhere, so pin it here too.
  git(["config", "core.autocrlf", "false"])
  git(["config", "core.eol", "lf"])
  // Seed one tracked file per allowlist prefix so HEAD exists.
  seedFile("messages/en/common.json", `{"hello":"hi"}\n`)
  seedFile("src/domains/foo/foo.config.tsx", `export const fooConfig = { name: "foo" }\n`)
  git(["add", "--", "."])
  git(["commit", "-m", "init", "--quiet"])
  // Move off the protected branch so commits don't get refused by default.
  git(["checkout", "-b", "feature/work", "--quiet"])
})

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true })
})

describe("getScopedStatus", () => {
  it("returns only allowlisted paths", async () => {
    // Allowed change.
    writeFileSync(join(sandbox, "messages/en/common.json"), `{"hello":"changed"}\n`)
    // Disallowed change — outside any allowlist prefix.
    seedFile("package.json", `{}\n`)
    seedFile("src/shared/secret.ts", `export const X = 1\n`)
    // Ignored-by-design: messages/_overrides/ is OUT of the allowlist.
    seedFile("messages/_overrides/runtime.json", `{}\n`)

    const report = await getScopedStatus(sandbox)
    const paths = report.entries.map(e => e.path)
    expect(paths).toContain("messages/en/common.json")
    expect(paths).not.toContain("package.json")
    expect(paths).not.toContain("src/shared/secret.ts")
    expect(paths).not.toContain("messages/_overrides/runtime.json")
  })

  it("classifies entries into the four buckets", async () => {
    writeFileSync(join(sandbox, "messages/en/common.json"), `{}`)
    writeFileSync(join(sandbox, "src/domains/foo/foo.config.tsx"), `// changed`)
    seedFile("src/app/(dashboard)/pages/foo/page.tsx", `export default function P() { return null }`)
    seedFile(".entity-builder-backups/2026/snap.json", `{}`)
    const report = await getScopedStatus(sandbox)
    const byCat = Object.fromEntries(report.entries.map(e => [e.category, e.path]))
    expect(byCat).toHaveProperty("translations")
    expect(byCat).toHaveProperty("entities")
    expect(byCat).toHaveProperty("pages")
    expect(byCat).toHaveProperty("other")
  })
})

async function expectRefused<T>(promise: Promise<T>): Promise<CommitRefusedError> {
  try {
    await promise
  } catch (e) {
    if (e instanceof CommitRefusedError) return e
    throw e
  }
  throw new Error("Expected CommitRefusedError but the promise resolved")
}

describe("commit refusal modes", () => {
  it("refuses out-of-allowlist files", async () => {
    seedFile("package.json", `{}`)
    const err = await expectRefused(
      commit({ message: "x", files: ["messages/en/common.json", "package.json"] }, sandbox),
    )
    expect(err.reason).toBe("out-of-scope-paths")
    expect(err.details.paths).toEqual(["package.json"])
    expect(git(["status", "--porcelain"])).toMatch(/package\.json/)
  })

  it("refuses binary files (NUL detected in first 8 KB)", async () => {
    writeFileSync(join(sandbox, "messages/en/common.json"), Buffer.from([0x7b, 0x00, 0x7d]))
    const err = await expectRefused(commit({ message: "binary please", files: ["messages/en/common.json"] }, sandbox))
    expect(err.reason).toBe("binary-file")
    expect(err.details.paths).toContain("messages/en/common.json")
  })

  it("refuses commits to a protected branch (main)", async () => {
    git(["checkout", "main", "--quiet"])
    writeFileSync(join(sandbox, "messages/en/common.json"), `{"x":1}`)
    const err = await expectRefused(commit({ message: "evil", files: ["messages/en/common.json"] }, sandbox))
    expect(err.reason).toBe("protected-branch")
    expect(err.details.current).toBe("main")
  })

  it("refuses empty messages", async () => {
    writeFileSync(join(sandbox, "messages/en/common.json"), `{"x":1}`)
    const err = await expectRefused(commit({ message: "   ", files: ["messages/en/common.json"] }, sandbox))
    expect(err.reason).toBe("empty-message")
  })

  it("dry-run reports the preview without committing", async () => {
    writeFileSync(join(sandbox, "messages/en/common.json"), `{"x":1}`)
    const before = git(["rev-parse", "HEAD"])
    const result = await preview({ message: "preview", files: ["messages/en/common.json"], dryRun: true }, sandbox)
    expect(result.files).toContain("messages/en/common.json")
    expect(git(["rev-parse", "HEAD"])).toBe(before) // no new commit
  })

  it("happy path: commits on feature branch and reports the hash", async () => {
    writeFileSync(join(sandbox, "messages/en/common.json"), `{"x":1}`)
    const result = await commit({ message: "feat: tweak greeting", files: ["messages/en/common.json"] }, sandbox)
    expect(result.commitHash).toMatch(/^[0-9a-f]{40}$/)
    expect(result.targetBranch).toBe("feature/work")
    expect(result.pushed).toBe(false)
    // The single new commit should be the one we just made.
    const head = git(["rev-parse", "HEAD"])
    expect(head).toBe(result.commitHash)
  })
})

describe("revertFiles", () => {
  it("restores tracked files to HEAD; ignores out-of-allowlist requests", async () => {
    const trackedPath = join(sandbox, "messages/en/common.json")
    const headContents = readFileSync(trackedPath, "utf8")
    writeFileSync(trackedPath, "DIRTY")
    seedFile("package.json", `{}`)
    const before = readFileSync(join(sandbox, "package.json"), "utf8")

    const result = await revertFiles(["messages/en/common.json", "package.json"], sandbox)
    expect(result.reverted).toEqual(["messages/en/common.json"])
    expect(result.refused).toEqual(["package.json"])
    expect(readFileSync(trackedPath, "utf8")).toBe(headContents)
    expect(readFileSync(join(sandbox, "package.json"), "utf8")).toBe(before) // untouched
  })

  it("removes untracked files inside the allowlist", async () => {
    seedFile("messages/en/untracked.json", `{}`)
    expect(() => readFileSync(join(sandbox, "messages/en/untracked.json"))).not.toThrow()
    const result = await revertFiles(["messages/en/untracked.json"], sandbox)
    expect(result.reverted).toEqual(["messages/en/untracked.json"])
    expect(() => readFileSync(join(sandbox, "messages/en/untracked.json"))).toThrow()
  })
})
