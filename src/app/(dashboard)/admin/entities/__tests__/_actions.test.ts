/**
 * Server-Action gate + delegation tests.
 *
 * `convertEntityAction` re-validates env + auth + input, then delegates
 * to `convertStaticEntity` from the API _lib module. The mocks here
 * isolate the action's contract from the actual convert pipeline (which
 * has its own coverage in convert.test.ts).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/infra/auth/server", () => ({ auth: vi.fn() }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/app/api/admin/entities/[entityName]/convert/_lib/convert", () => ({
  convertStaticEntity: vi.fn(),
}))
vi.mock("@/app/api/admin/entities/[entityName]/restore/_lib/restore", () => ({
  restoreStaticEntity: vi.fn(),
}))

const VALID_BACKUP_ID = "2026-05-13T12-34-56-789Z"

const ORIGINAL_ENV = process.env

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  process.env = { ...ORIGINAL_ENV, NODE_ENV: "development", APP_ALLOW_RUNTIME_CODEGEN: "true" }
})

afterEach(() => {
  process.env = ORIGINAL_ENV
})

describe("convertEntityAction — gates", () => {
  it("refuses in production builds", async () => {
    Object.assign(process.env, { NODE_ENV: "production" })
    const { convertEntityAction } = await import("../_actions")
    const result = await convertEntityAction("brand")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/disabled in production/i)
  })

  it("refuses when APP_ALLOW_RUNTIME_CODEGEN is not 'true'", async () => {
    process.env.APP_ALLOW_RUNTIME_CODEGEN = "false"
    const { convertEntityAction } = await import("../_actions")
    const result = await convertEntityAction("brand")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/APP_ALLOW_RUNTIME_CODEGEN/)
  })

  it("refuses invalid entityName (path-traversal, bad chars)", async () => {
    const { convertEntityAction } = await import("../_actions")
    for (const bad of ["", "BAD", "../etc", "with space", "a".repeat(50)]) {
      const result = await convertEntityAction(bad)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.reason).toMatch(/Invalid entityName/)
    }
  })

  it("refuses without a session", async () => {
    const auth = (await import("@/infra/auth/server")).auth as ReturnType<typeof vi.fn>
    auth.mockResolvedValue(null)
    const { convertEntityAction } = await import("../_actions")
    const result = await convertEntityAction("brand")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/don't have permission/i)
  })

  it("refuses non-admin roles", async () => {
    const auth = (await import("@/infra/auth/server")).auth as ReturnType<typeof vi.fn>
    auth.mockResolvedValue({ user: { roles: ["user"], email: "u@x" } })
    const { convertEntityAction } = await import("../_actions")
    const result = await convertEntityAction("brand")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/don't have permission/i)
  })
})

describe("convertEntityAction — delegation", () => {
  async function setup() {
    const auth = (await import("@/infra/auth/server")).auth as ReturnType<typeof vi.fn>
    auth.mockResolvedValue({ user: { roles: ["admin"], email: "a@x" } })
    const cache = await import("next/cache")
    const convertMod = await import("@/app/api/admin/entities/[entityName]/convert/_lib/convert")
    return {
      revalidatePath: cache.revalidatePath as ReturnType<typeof vi.fn>,
      convertStaticEntity: convertMod.convertStaticEntity as ReturnType<typeof vi.fn>,
    }
  }

  it("calls convertStaticEntity with actor + revalidates on success", async () => {
    const { revalidatePath, convertStaticEntity } = await setup()
    convertStaticEntity.mockResolvedValue({
      ok: true,
      runtimeEntityId: "brand",
      backupId: "snap-1",
      deletedFiles: ["a.tsx"],
      migratedI18nKeyCount: 6,
      redirectTo: "/builder?entity=brand",
    })
    const { convertEntityAction } = await import("../_actions")
    const result = await convertEntityAction("brand")
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.runtimeEntityId).toBe("brand")
      expect(result.redirectTo).toBe("/builder?entity=brand")
    }
    expect(convertStaticEntity).toHaveBeenCalledWith("brand", { actor: "a@x" })
    expect(revalidatePath).toHaveBeenCalledWith("/admin/entities")
  })

  it("surfaces 422 refusal verbatim without throwing", async () => {
    const { revalidatePath, convertStaticEntity } = await setup()
    convertStaticEntity.mockResolvedValue({
      ok: false,
      status: 422,
      reason: "listColumns is an identifier ref",
      filePath: "src/domains/business/order/order.config.tsx",
    })
    const { convertEntityAction } = await import("../_actions")
    const result = await convertEntityAction("order")
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe("listColumns is an identifier ref")
      expect(result.filePath).toMatch(/order\.config\.tsx$/)
    }
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it("surfaces 500 failure without throwing + does not revalidate", async () => {
    const { revalidatePath, convertStaticEntity } = await setup()
    convertStaticEntity.mockResolvedValue({
      ok: false,
      status: 500,
      error: "snapshot failed: ENOSPC",
      backupId: null,
      rolledBack: false,
    })
    const { convertEntityAction } = await import("../_actions")
    const result = await convertEntityAction("brand")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/snapshot failed/)
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

describe("restoreConvertAction", () => {
  async function setupRestore() {
    const auth = (await import("@/infra/auth/server")).auth as ReturnType<typeof vi.fn>
    auth.mockResolvedValue({ user: { roles: ["admin"], email: "a@x" } })
    const cache = await import("next/cache")
    const restoreMod = await import("@/app/api/admin/entities/[entityName]/restore/_lib/restore")
    return {
      revalidatePath: cache.revalidatePath as ReturnType<typeof vi.fn>,
      restoreStaticEntity: restoreMod.restoreStaticEntity as ReturnType<typeof vi.fn>,
    }
  }

  it("refuses with both env gates off (production / flag missing)", async () => {
    Object.assign(process.env, { NODE_ENV: "production" })
    const { restoreConvertAction } = await import("../_actions")
    const r1 = await restoreConvertAction("brand", VALID_BACKUP_ID)
    expect(r1.ok).toBe(false)
    if (!r1.ok) expect(r1.reason).toMatch(/disabled in production/i)

    Object.assign(process.env, { NODE_ENV: "development", APP_ALLOW_RUNTIME_CODEGEN: "false" })
    const r2 = await restoreConvertAction("brand", VALID_BACKUP_ID)
    expect(r2.ok).toBe(false)
    if (!r2.ok) expect(r2.reason).toMatch(/APP_ALLOW_RUNTIME_CODEGEN/)
  })

  it("refuses with invalid entityName or backupId shapes", async () => {
    const { restoreConvertAction } = await import("../_actions")
    const r1 = await restoreConvertAction("BAD", VALID_BACKUP_ID)
    expect(r1.ok).toBe(false)
    if (!r1.ok) expect(r1.reason).toMatch(/Invalid entityName/)
    const r2 = await restoreConvertAction("brand", "not-a-timestamp")
    expect(r2.ok).toBe(false)
    if (!r2.ok) expect(r2.reason).toMatch(/Invalid backupId/)
  })

  it("refuses non-admin auth", async () => {
    const auth = (await import("@/infra/auth/server")).auth as ReturnType<typeof vi.fn>
    auth.mockResolvedValue({ user: { roles: ["user"], email: "u@x" } })
    const { restoreConvertAction } = await import("../_actions")
    const result = await restoreConvertAction("brand", VALID_BACKUP_ID)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/don't have permission/i)
  })

  it("calls restoreStaticEntity with actor + revalidates on success", async () => {
    const { revalidatePath, restoreStaticEntity } = await setupRestore()
    restoreStaticEntity.mockResolvedValue({
      ok: true,
      restoredFiles: ["a.tsx", "b.ts", "c.ts"],
      removedRuntimeId: "brand",
      migratedI18nKeyCount: 6,
      safetyBackupId: "2026-05-13T22-22-22-222Z",
    })
    const { restoreConvertAction } = await import("../_actions")
    const result = await restoreConvertAction("brand", VALID_BACKUP_ID)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.restoredFiles).toHaveLength(3)
      expect(result.removedRuntimeId).toBe("brand")
    }
    expect(restoreStaticEntity).toHaveBeenCalledWith("brand", {
      backupId: VALID_BACKUP_ID,
      dryRun: false,
      actor: "a@x",
    })
    expect(revalidatePath).toHaveBeenCalledWith("/admin/entities")
  })

  it("surfaces 422 refusal verbatim without throwing + does not revalidate", async () => {
    const { revalidatePath, restoreStaticEntity } = await setupRestore()
    restoreStaticEntity.mockResolvedValue({
      ok: false,
      status: 422,
      reason: "Backup not found",
    })
    const { restoreConvertAction } = await import("../_actions")
    const result = await restoreConvertAction("brand", VALID_BACKUP_ID)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe("Backup not found")
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it("flags half-restored failure prominently in the surfaced reason", async () => {
    const { restoreStaticEntity } = await setupRestore()
    restoreStaticEntity.mockResolvedValue({
      ok: false,
      status: 500,
      error: "disk fault",
      partialState: "half-restored",
      rolledBack: false,
      safetyBackupId: "2026-05-13T22-22-22-222Z",
    })
    const { restoreConvertAction } = await import("../_actions")
    const result = await restoreConvertAction("brand", VALID_BACKUP_ID)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toMatch(/hand-recover from snapshots/i)
      expect(result.reason).toMatch(/disk fault/)
    }
  })
})
