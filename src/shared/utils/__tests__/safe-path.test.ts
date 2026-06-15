/**
 * Path-traversal regression net.
 *
 * Two flavours:
 *
 *   • The lexical guard (assertSafePath) must reject every malicious string
 *     in `MALICIOUS_INPUTS` and accept every benign string in `SAFE_INPUTS`.
 *
 *   • The realpath guard (assertSafePathResolved) must additionally catch
 *     a pre-planted symlink inside an allowed root that points outside
 *     the project. Symlink creation requires admin/dev-mode on Windows;
 *     the test soft-skips when symlink creation throws so the suite still
 *     passes on locked-down dev boxes.
 *
 * If a future writer wants to land a `fs.write*` call in this codebase,
 * the audit grep + this regression net is what keeps it honest.
 */

import { promises as fs } from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { ALLOWED_ROOTS, PathTraversalError, assertSafePath, assertSafePathResolved } from "../safe-path"

// ─── Lexical rejections ─────────────────────────────────────────────────────

const MALICIOUS_INPUTS: { name: string; input: string }[] = [
  { name: "parent traversal", input: "../../etc/passwd" },
  { name: "embedded traversal that resolves out", input: "src/../../escape" },
  { name: "absolute POSIX path", input: "/etc/passwd" },
  { name: "absolute Windows path", input: "C:/Windows/system32/drivers/etc/hosts" },
  { name: "absolute Windows backslash path", input: "C:\\Windows\\system32" },
  { name: "leading dot escape", input: "./../etc/passwd" },
  { name: "encoded path that lands outside", input: "src/domains/../../../escape" },
  { name: "outside-allowed-root sibling", input: "node_modules/.bin/something" },
  { name: "tsconfig at project root (not in any allowed root)", input: "tsconfig.json" },
  { name: "package.json (project root)", input: "package.json" },
  { name: "messages-evil prefix attack", input: "messages-evil/x.json" },
  { name: "src-evil prefix attack", input: "src-evil/x.ts" },
]

const SAFE_INPUTS: { name: string; input: string }[] = [
  { name: "messages root file", input: "messages/en/pages.json" },
  { name: "messages override", input: "messages/_overrides/runtime/config.json" },
  { name: "domains nested file", input: "src/domains/business/customer/customer.config.ts" },
  { name: "dashboard route", input: "src/app/(dashboard)/customers/page.tsx" },
  { name: "widget under widgets dir", input: "src/features/dashboard/widgets/sales-kpi.widget.ts" },
  { name: "backup snapshot", input: ".entity-builder-backups/2026-05-07T01-23-45-678Z/messages/en/pages.json" },
  { name: "typecheck sandbox", input: ".entity-builder-cache/typecheck/abc/tsconfig.json" },
]

describe("assertSafePath — lexical guard", () => {
  for (const { name, input } of MALICIOUS_INPUTS) {
    it(`throws on ${name}: ${input}`, () => {
      expect(() => assertSafePath(input)).toThrow(PathTraversalError)
    })
  }

  for (const { name, input } of SAFE_INPUTS) {
    it(`accepts ${name}: ${input}`, () => {
      const out = assertSafePath(input)
      expect(out).toBe(path.resolve(process.cwd(), input))
    })
  }

  it("rejects an empty string", () => {
    expect(() => assertSafePath("")).toThrow(PathTraversalError)
  })

  it("rejects null bytes (shells & FS routines may truncate at \\0)", () => {
    // The lexical guard catches this implicitly because the resolved path
    // doesn't fall under any allowed root after the truncation, but pin it
    // with a direct test so we notice if the contract changes.
    expect(() => assertSafePath("messages/x\0../../../escape")).toThrow()
  })

  it("attaches the original input to the error for audit logging", () => {
    try {
      assertSafePath("../../etc/passwd")
      expect.fail("should have thrown")
    } catch (err) {
      expect(err).toBeInstanceOf(PathTraversalError)
      expect((err as PathTraversalError).received).toBe("../../etc/passwd")
    }
  })

  it("ALLOWED_ROOTS is non-empty (sanity: someone must have removed the safety net)", () => {
    expect(ALLOWED_ROOTS.length).toBeGreaterThan(0)
  })
})

// ─── Resolved (symlink-aware) guard ─────────────────────────────────────────

describe("assertSafePathResolved — symlink guard", () => {
  // Stage one symlink inside an allowed root that points OUTSIDE the
  // project. If symlink creation fails (no admin / no dev mode on Windows)
  // the suite skips this section instead of failing.
  let outsideTargetDir: string | null = null
  let symlinkPath: string | null = null

  beforeAll(async () => {
    outsideTargetDir = await fs.mkdtemp(path.join(os.tmpdir(), "safe-path-test-"))
    const linkContainerRel = path.join("messages", "_overrides", ".safe-path-test")
    const linkContainerAbs = path.resolve(process.cwd(), linkContainerRel)
    await fs.mkdir(linkContainerAbs, { recursive: true })
    const linkPath = path.join(linkContainerAbs, "out-of-tree-link")
    try {
      await fs.symlink(outsideTargetDir, linkPath, "dir")
      symlinkPath = linkPath
    } catch {
      symlinkPath = null
    }
  })

  afterAll(async () => {
    if (symlinkPath) {
      await fs.unlink(symlinkPath).catch(() => undefined)
    }
    const linkContainerAbs = path.resolve(process.cwd(), "messages", "_overrides", ".safe-path-test")
    await fs.rm(linkContainerAbs, { recursive: true, force: true }).catch(() => undefined)
    if (outsideTargetDir) await fs.rm(outsideTargetDir, { recursive: true, force: true }).catch(() => undefined)
  })

  it("passes the lexical check for benign paths", async () => {
    const out = await assertSafePathResolved("messages/en/pages.json")
    expect(out).toBe(path.resolve(process.cwd(), "messages/en/pages.json"))
  })

  it("still throws on lexical attacks (it composes with the sync guard)", async () => {
    await expect(assertSafePathResolved("../../etc/passwd")).rejects.toThrow(PathTraversalError)
  })

  it("rejects a path that goes through a symlink to outside the project", async () => {
    if (!symlinkPath) {
      // Symlink creation isn't permitted in this environment; soft-skip.
      return
    }
    const traversed = "messages/_overrides/.safe-path-test/out-of-tree-link/leaked.txt"
    await expect(assertSafePathResolved(traversed)).rejects.toThrow(PathTraversalError)
  })

  it("accepts a path whose existing ancestors are real directories (no symlinks)", async () => {
    // The deepest existing ancestor for a brand-new file under messages is
    // the messages dir itself. realpath of that should be the same path —
    // no symlink, no rejection.
    const out = await assertSafePathResolved("messages/_overrides/runtime/brand-new-config.json")
    expect(out).toBe(path.resolve(process.cwd(), "messages/_overrides/runtime/brand-new-config.json"))
  })
})

// ─── Allowed-root coverage ──────────────────────────────────────────────────
//
// Pin the actual ALLOWED_ROOTS list so adding/removing one is a deliberate
// review action rather than a silent change.

describe("ALLOWED_ROOTS coverage", () => {
  it("matches the documented set for Task B2", () => {
    expect([...ALLOWED_ROOTS].sort()).toEqual(
      [
        ".entity-builder-backups",
        ".entity-builder-cache",
        "messages",
        "src/app/(dashboard)",
        "src/domains",
        "src/features/dashboard/widgets",
      ].sort(),
    )
  })

  it("each root exists OR is creatable (real-tree sanity)", () => {
    // We don't require every root to physically exist — `.entity-builder-cache`
    // only appears when a typecheck runs — but assertSafePath against the
    // root-as-string must succeed. That tells us the prefix-match logic
    // hasn't drifted from the actual root spelling.
    for (const root of ALLOWED_ROOTS) {
      expect(() => assertSafePath(`${root}/probe.json`)).not.toThrow()
    }
  })
})
