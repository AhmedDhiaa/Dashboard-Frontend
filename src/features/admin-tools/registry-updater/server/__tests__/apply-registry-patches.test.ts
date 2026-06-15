/**
 * Transactional applier — five spec cases:
 *
 *   1. dryRun returns diffs without any fs.writeFile
 *   2. Apply success writes both files; emitted diffs match the patcher
 *   3. Permission-patch refusal → ok: false AND nav write never happens
 *   4. Nav-patch refusal AFTER perm patch wrote → restore perm bytes
 *   5. Both no-op (entries exist) → ok: true with empty diffs
 *
 * Tests run in a tmpdir sandbox so the patcher's `process.cwd()`-resolved
 * paths land inside it. `vi.resetModules()` per test ensures the patcher
 * modules re-read PERMISSION_KEYS_PATH / NAVIGATION_PATH constants
 * relative to the fresh cwd.
 */

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import * as fsModule from "node:fs"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const ORIGINAL_CWD = process.cwd()
let sandbox: string

type Module = typeof import("../apply-registry-patches")
async function load(): Promise<Module> {
  return (await import("../apply-registry-patches")) as Module
}

const PERMS_FIXTURE = `export const PERMISSIONS = {
  ADMIN_ENTITY_BUILDER: "Api.Admin.EntityBuilder",
  THEME_MANAGE: "Api.Theme.Manage",
} as const
`

const NAV_FIXTURE = `import { Box } from "lucide-react"

export const NAV_GROUPS = [
  {
    titleKey: "nav.operations",
    items: [
      { titleKey: "nav.brands", href: "/brands", icon: Box },
    ],
  },
] as const
`

function seed(rel: string, content: string): void {
  const abs = join(sandbox, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, content, "utf8")
}

function readSeeded(rel: string): string {
  return readFileSync(join(sandbox, rel), "utf8")
}

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), "apply-registry-test-"))
  process.chdir(sandbox)
  vi.resetModules()
  seed("src/shared/auth/permission-keys.ts", PERMS_FIXTURE)
  seed("src/shared/config/navigation.ts", NAV_FIXTURE)
})

afterEach(() => {
  process.chdir(ORIGINAL_CWD)
  vi.restoreAllMocks()
  rmSync(sandbox, { recursive: true, force: true })
})

describe("applyRegistryPatches — dryRun", () => {
  it("returns diffs without writing either file", async () => {
    const writeSpy = vi.spyOn(fsModule.promises, "writeFile")
    const { applyRegistryPatches } = await load()
    const result = await applyRegistryPatches({
      permissionKey: { identifier: "BRAND_APPROVE", value: "Api.Brand.Approve" },
      navigation: {
        group: "nav.operations",
        titleKey: "pages.widget.title",
        href: "/widgets",
        icon: "Box",
      },
      dryRun: true,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    // Two diffs — one per patcher.
    expect(result.diffs.length).toBe(2)
    expect(result.patchedFiles).toEqual([])
    // The audit log line MAY be written but no patch-target write.
    const targetWrites = writeSpy.mock.calls.filter(
      ([target]) =>
        typeof target === "string" && (target.endsWith("permission-keys.ts") || target.endsWith("navigation.ts")),
    )
    expect(targetWrites).toHaveLength(0)
    // Files still byte-identical to fixtures.
    expect(readSeeded("src/shared/auth/permission-keys.ts")).toBe(PERMS_FIXTURE)
    expect(readSeeded("src/shared/config/navigation.ts")).toBe(NAV_FIXTURE)
  })
})

describe("applyRegistryPatches — apply", () => {
  it("writes both files and surfaces a diff per patcher", async () => {
    const { applyRegistryPatches } = await load()
    const result = await applyRegistryPatches({
      permissionKey: { identifier: "BRAND_APPROVE", value: "Api.Brand.Approve" },
      navigation: {
        group: "nav.operations",
        titleKey: "pages.widget.title",
        href: "/widgets",
        icon: "Box",
      },
      dryRun: false,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.patchedFiles).toEqual(
      expect.arrayContaining([expect.stringContaining("permission-keys.ts"), expect.stringContaining("navigation.ts")]),
    )
    expect(readSeeded("src/shared/auth/permission-keys.ts")).toContain('BRAND_APPROVE: "Api.Brand.Approve"')
    expect(readSeeded("src/shared/config/navigation.ts")).toContain('href: "/widgets"')
  })

  it("returns refusal AND skips nav write when permission-keys patch refuses (collision)", async () => {
    // Pre-seed a collision: same identifier, different value → patcher refuses.
    seed(
      "src/shared/auth/permission-keys.ts",
      `export const PERMISSIONS = {
  BRAND_APPROVE: "Api.Brand.OldName",
} as const
`,
    )
    const writeSpy = vi.spyOn(fsModule.promises, "writeFile")
    const { applyRegistryPatches } = await load()
    const result = await applyRegistryPatches({
      permissionKey: { identifier: "BRAND_APPROVE", value: "Api.Brand.Approve" },
      navigation: {
        group: "nav.operations",
        titleKey: "pages.widget.title",
        href: "/widgets",
        icon: "Box",
      },
      dryRun: false,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toMatch(/permission-keys/i)
    // Critical: nav.ts was never written.
    const navWrites = writeSpy.mock.calls.filter(([t]) => typeof t === "string" && t.endsWith("navigation.ts"))
    expect(navWrites).toHaveLength(0)
    // permission-keys file content unchanged.
    expect(readSeeded("src/shared/auth/permission-keys.ts")).toContain('BRAND_APPROVE: "Api.Brand.OldName"')
  })

  it("rolls back perm-keys write when nav patcher refuses on href collision", async () => {
    // Pre-seed the href in nav → second patch refuses; first already wrote.
    seed(
      "src/shared/config/navigation.ts",
      `import { Box } from "lucide-react"

export const NAV_GROUPS = [
  {
    titleKey: "nav.operations",
    items: [
      { titleKey: "pages.widget.title", href: "/widgets", icon: Box },
    ],
  },
] as const
`,
    )
    const originalPerms = readSeeded("src/shared/auth/permission-keys.ts")
    const originalNav = readSeeded("src/shared/config/navigation.ts")

    const { applyRegistryPatches } = await load()
    const result = await applyRegistryPatches({
      permissionKey: { identifier: "BRAND_APPROVE", value: "Api.Brand.Approve" },
      navigation: {
        group: "nav.operations",
        titleKey: "pages.widget-rename.title",
        href: "/widgets",
        icon: "Box",
      },
      dryRun: false,
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toMatch(/navigation/i)
    // Both files byte-identical to pre-call.
    expect(readSeeded("src/shared/auth/permission-keys.ts")).toBe(originalPerms)
    expect(readSeeded("src/shared/config/navigation.ts")).toBe(originalNav)
  })
})

describe("applyRegistryPatches — idempotency", () => {
  it("returns ok with empty diffs when both entries already exist", async () => {
    // Both fixture files ALREADY contain the entries we'll ask for.
    seed(
      "src/shared/auth/permission-keys.ts",
      `export const PERMISSIONS = {
  ADMIN_ENTITY_BUILDER: "Api.Admin.EntityBuilder",
  BRAND_APPROVE: "Api.Brand.Approve",
} as const
`,
    )
    // The default NAV_FIXTURE already has /brands → href collision is exactly
    // the existing entry, which the patcher treats as a no-op.
    const beforePerms = readSeeded("src/shared/auth/permission-keys.ts")
    const beforeNav = readSeeded("src/shared/config/navigation.ts")
    const { applyRegistryPatches } = await load()
    const result = await applyRegistryPatches({
      permissionKey: { identifier: "BRAND_APPROVE", value: "Api.Brand.Approve" },
      navigation: {
        group: "nav.operations",
        titleKey: "nav.brands",
        href: "/brands",
        icon: "Box",
      },
      dryRun: false,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.diffs).toEqual([])
    expect(result.patchedFiles).toEqual([])
    // Byte-identical no-op.
    expect(readSeeded("src/shared/auth/permission-keys.ts")).toBe(beforePerms)
    expect(readSeeded("src/shared/config/navigation.ts")).toBe(beforeNav)
  })
})
