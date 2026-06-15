/**
 * Wiring tests for the runtime materialize route — Part 3.1 additions.
 *
 * The full materialize pipeline (typecheck → snapshot → persist → patch →
 * cleanup) has many moving parts; this test mocks the heavy dependencies
 * and pins the THREE contract changes from Part 3.1:
 *
 *   1. Success → response.files[] includes the patched registry paths.
 *   2. Registry-patcher refusal → 409, rolledBack:true, the entity files
 *      get unlinked via rollbackFiles.
 *   3. dryRun → response.registryDiffs is non-empty when patches plan
 *      to insert.
 *
 * Heavier integration coverage (real fs, real patcher) lives in
 * apply-registry-patches.test.ts.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("@/app/api/_lib/require-permission", () => ({
  requirePermission: vi.fn(async () => ({
    ok: true,
    session: { user: { email: "tester@example.com", roles: ["admin"] } },
  })),
}))

vi.mock("@/features/admin-tools/entity-builder/server/code-generator", () => ({
  planGeneration: vi.fn(() => ({
    entityName: "brand",
    files: [
      { path: "src/domains/inventory/brand/brand.config.tsx", content: "// brand config" },
      { path: "src/domains/inventory/brand/brand.types.ts", content: "// brand types" },
    ],
    i18n: { en: {}, ar: {} },
  })),
}))

vi.mock("@/features/admin-tools/entity-builder/server/diff", () => ({
  diffPlannedFiles: vi.fn(async () => ({ added: [], modified: [], unchanged: [] })),
}))

vi.mock("@/features/admin-tools/entity-builder/server/typecheck", () => ({
  typecheckPlannedFiles: vi.fn(async () => ({ ok: true, errors: [] })),
}))

vi.mock("@/features/admin-tools/entity-builder/server/backup", () => ({
  snapshotFiles: vi.fn(async () => ({ id: "snap-test", dir: ".entity-builder-backups/snap-test", files: [] })),
}))

vi.mock("@/features/admin-tools/entity-builder/server/audit", () => ({
  appendAudit: vi.fn(async () => undefined),
  hashSchema: vi.fn(() => "deadbeef"),
}))

vi.mock("@/features/admin-tools/entity-builder/server/derivations", () => ({
  toKebabCase: (s: string) => s.toLowerCase(),
}))

vi.mock("@/features/admin-tools/entity-builder/server/file-writer", () => ({
  persistGeneration: vi.fn(async () => ({
    filesWritten: ["src/domains/inventory/brand/brand.config.tsx", "src/domains/inventory/brand/brand.types.ts"],
    warnings: [],
  })),
  rollbackFiles: vi.fn(async () => undefined),
  WriteAborted: class extends Error {},
}))

vi.mock("@/features/admin-tools/registry-updater/server/apply-registry-patches", () => ({
  applyRegistryPatches: vi.fn(),
}))

vi.mock("@/features/runtime-builder/materialize/runtime-to-builder-schema", () => ({
  mapRuntimeEntityToBuilderSchema: vi.fn(() => ({
    entityName: "brand",
    entityNamePlural: "brands",
    domain: "runtime",
    endpoint: "/api/app/brand",
    permissionKey: "Api.Brand",
    translations: {
      en: { title: "Brand" },
      ar: { title: "Brand" },
    },
    fields: [{ name: "name", type: "string", label: { en: "Name", ar: "Name" } }],
    listColumns: [{ field: "name", display: "text", sortable: true, hidden: false }],
    detailLayout: [],
    formLayout: [],
    features: { create: true, edit: true, delete: true, view: true, export: false, import: false },
  })),
}))

vi.mock("@/features/admin-tools/entity-builder/types/builder-schema", () => ({
  entityBuilderSchema: { safeParse: vi.fn((v: unknown) => ({ success: true, data: v })) },
}))

vi.mock("../../../_lib/storage", () => ({
  readConfig: vi.fn(async () => ({
    entities: [{ id: "brand", singularName: "Brand", pluralName: "Brands", fields: [] }],
  })),
  removeEntityFromConfig: vi.fn(async () => undefined),
  deleteEntityDataFile: vi.fn(async () => undefined),
}))

vi.mock("../../../_lib/constants", async () => {
  const actual = await vi.importActual<typeof import("../../../_lib/constants")>("../../../_lib/constants")
  return { ...actual, isValidEntityId: (v: unknown) => typeof v === "string" && /^[a-z][a-z0-9-]+$/.test(v) }
})

const ORIGINAL_ENV = process.env

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  process.env = { ...ORIGINAL_ENV, APP_ALLOW_RUNTIME_CODEGEN: "true" }
})

afterEach(() => {
  process.env = ORIGINAL_ENV
})

function makeRequest(dryRun = false): NextRequest {
  // Minimal NextRequest stand-in — the route only reads
  // nextUrl.searchParams and json().
  const url = new URL(`http://localhost/api/runtime/materialize/brand${dryRun ? "?dryRun=true" : ""}`)
  return {
    nextUrl: url,
    json: async () => ({}),
  } as unknown as NextRequest
}

const params = Promise.resolve({ entityId: "brand" })

describe("runtime materialize route — Part 3.1 wiring", () => {
  it("includes patched registry paths in response.files on success", async () => {
    const apply = await import("@/features/admin-tools/registry-updater/server/apply-registry-patches")
    vi.mocked(apply.applyRegistryPatches).mockResolvedValue({
      ok: true,
      diffs: [{ path: "src/shared/config/navigation.ts", diff: "/* added */" }],
      patchedFiles: ["src/shared/auth/permission-keys.ts", "src/shared/config/navigation.ts"],
    })

    const { POST } = await import("../route")
    const res = await POST(makeRequest(false), { params })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { files: string[]; registryDiffs: unknown[] }
    expect(body.files).toEqual(
      expect.arrayContaining([
        "src/domains/inventory/brand/brand.config.tsx",
        "src/shared/auth/permission-keys.ts",
        "src/shared/config/navigation.ts",
      ]),
    )
    expect(body.registryDiffs).toHaveLength(1)
  })

  it("returns 409 with rolledBack:true and unlinks entity files when patcher refuses", async () => {
    const apply = await import("@/features/admin-tools/registry-updater/server/apply-registry-patches")
    vi.mocked(apply.applyRegistryPatches).mockResolvedValue({
      ok: false,
      reason: "permission-keys: BRAND_APPROVE collision",
      conflictingPath: "src/shared/auth/permission-keys.ts",
    })

    const writer = await import("@/features/admin-tools/entity-builder/server/file-writer")
    const { POST } = await import("../route")
    const res = await POST(makeRequest(false), { params })
    expect(res.status).toBe(409)
    const body = (await res.json()) as { rolledBack: boolean; error: string; conflictingPath: string }
    expect(body.rolledBack).toBe(true)
    expect(body.error).toMatch(/BRAND_APPROVE collision/)
    expect(body.conflictingPath).toBe("src/shared/auth/permission-keys.ts")
    // rollbackFiles got the persistGeneration-written paths.
    expect(writer.rollbackFiles).toHaveBeenCalledWith([
      "src/domains/inventory/brand/brand.config.tsx",
      "src/domains/inventory/brand/brand.types.ts",
    ])
  })

  it("dryRun returns registryDiffs from the patcher preview", async () => {
    const apply = await import("@/features/admin-tools/registry-updater/server/apply-registry-patches")
    vi.mocked(apply.applyRegistryPatches).mockResolvedValue({
      ok: true,
      diffs: [{ path: "src/shared/config/navigation.ts", diff: "+ { titleKey: ..., href: /brands }" }],
      patchedFiles: [],
    })

    const { POST } = await import("../route")
    const res = await POST(makeRequest(true), { params })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { mode: string; registryDiffs: unknown[] }
    expect(body.mode).toBe("preview")
    expect(body.registryDiffs).toHaveLength(1)
    // The patcher was called with dryRun: true.
    expect(apply.applyRegistryPatches).toHaveBeenCalledWith(expect.objectContaining({ dryRun: true }))
  })
})
