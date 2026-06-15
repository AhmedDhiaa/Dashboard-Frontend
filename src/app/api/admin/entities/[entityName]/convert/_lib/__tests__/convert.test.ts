/**
 * Convert-flow tests against a tmpdir sandbox.
 *
 * Each test allocates a fresh `mkdtemp`, `process.chdir`s into it, AND
 * `vi.resetModules()`-then-dynamically-imports the convert module. The
 * reset is necessary because runtime/_lib/constants.ts and backup.ts
 * each capture `process.cwd()` in module-top-level constants — without
 * the reset, those constants hold the path from the FIRST test, not the
 * current sandbox.
 *
 * What we exercise here is the convert MODULE (not the route): parser →
 * snapshot → addEntityToConfig → i18n migrate → unlink → init-entities,
 * with rollback on any post-snapshot failure. The route's gating logic
 * (env, permission, dryRun routing) is a thin wrapper; integration
 * tests would be redundant given the surface.
 */

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

type ConvertModule = typeof import("../convert")

async function loadConvert(): Promise<ConvertModule> {
  return (await import("../convert")) as ConvertModule
}

const ORIGINAL_CWD = process.cwd()
let sandbox: string

const MINIMAL_BRAND_CONFIG = `
import { Tag } from "lucide-react"
import type { EntityConfig } from "@/core/entities/config-types"
export const brandConfig: EntityConfig = {
  entityName: "brand",
  singularName: "Brand",
  pluralName: "Brands",
  icon: Tag,
  permissionKey: "Api.Brand",
  formFields: {
    code: { type: "text", labelKey: "pages.brand.code", required: true },
    name: { type: "text", labelKey: "pages.brand.name", required: true },
  },
}
`

const MINIMAL_BRAND_TYPES = `
export interface Brand {
  id: number
  code: string
  name: string
}
`

const MINIMAL_BRAND_SCHEMA = `
import { z } from "zod"
export const brandSchema = z.object({ code: z.string(), name: z.string() })
`

const ORDER_REFUSED_CONFIG = `
import { ShoppingCart } from "lucide-react"
import type { EntityConfig } from "@/core/entities/config-types"
import { orderColumns } from "./renderers"
export const orderConfig: EntityConfig = {
  entityName: "order",
  singularName: "Order",
  pluralName: "Orders",
  icon: ShoppingCart,
  permissionKey: "Api.Order",
  listColumns: orderColumns,
  formFields: {
    name: { type: "text", labelKey: "pages.order.name" },
  },
}
`

function seed(relPath: string, content: string): void {
  const abs = join(sandbox, relPath)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, content, "utf8")
}

function seedBrand(): void {
  seed("src/domains/inventory/brand/brand.config.tsx", MINIMAL_BRAND_CONFIG)
  seed("src/domains/inventory/brand/brand.types.ts", MINIMAL_BRAND_TYPES)
  seed("src/domains/inventory/brand/brand.schema.ts", MINIMAL_BRAND_SCHEMA)
}

function seedI18n(): void {
  const en = {
    brand: {
      title: "Brands",
      description: "Manage brands",
      create: { title: "New brand", success: "Created" },
    },
    other: { keep: "kept" },
  }
  const ar = {
    brand: {
      title: "العلامات",
      description: "إدارة العلامات",
    },
    other: { keep: "محفوظ" },
  }
  seed("messages/en/pages.json", JSON.stringify(en, null, 4) + "\n")
  seed("messages/ar/pages.json", JSON.stringify(ar, null, 4) + "\n")
  seed("messages/en/pages_dynamic.json", JSON.stringify({}, null, 4) + "\n")
  seed("messages/ar/pages_dynamic.json", JSON.stringify({}, null, 4) + "\n")
}

function seedEmptyRuntimeConfig(): void {
  seed(
    "messages/_overrides/runtime/config.json",
    JSON.stringify({ entities: [], pages: [], dashboards: [], settings: { version: 0 } }, null, 2) + "\n",
  )
}

function readJson(rel: string): unknown {
  return JSON.parse(readFileSync(join(sandbox, rel), "utf8"))
}

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), "convert-test-"))
  process.chdir(sandbox)
  // Force a fresh module graph so module-load-time constants in
  // runtime/_lib/constants.ts and backup.ts capture THIS sandbox's cwd.
  vi.resetModules()
})

afterEach(() => {
  process.chdir(ORIGINAL_CWD)
  vi.restoreAllMocks()
  rmSync(sandbox, { recursive: true, force: true })
})

describe("previewConvert (dryRun)", () => {
  it("returns planned shape without writing", async () => {
    seedBrand()
    seedI18n()
    const { previewConvert } = await loadConvert()
    const result = await previewConvert("brand")
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.planned.runtimeEntityId).toBe("brand")
    expect(result.planned.filesToDelete).toEqual(
      expect.arrayContaining([
        "src/domains/inventory/brand/brand.config.tsx",
        "src/domains/inventory/brand/brand.types.ts",
        "src/domains/inventory/brand/brand.schema.ts",
      ]),
    )
    // 4 leaves in en (title, description, create.title, create.success) + 2 in ar = 6
    expect(result.planned.i18nKeysToMigrate).toBe(6)
    // No mutations: source files still present, pages.json unchanged.
    expect(existsSync(join(sandbox, "src/domains/inventory/brand/brand.config.tsx"))).toBe(true)
    const pages = readJson("messages/en/pages.json") as { brand?: unknown }
    expect(pages.brand).toBeDefined()
  })

  it("returns 422-style refusal for the order config", async () => {
    seed("src/domains/business/order/order.config.tsx", ORDER_REFUSED_CONFIG)
    const { previewConvert } = await loadConvert()
    const result = await previewConvert("order")
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.status).toBe(422)
    expect(result.reason).toMatch(/listColumns is an identifier/)
  })
})

describe("convertStaticEntity — happy path", () => {
  it("creates runtime entity, migrates i18n, deletes source files, writes audit", async () => {
    seedBrand()
    seedI18n()
    seedEmptyRuntimeConfig()

    const { convertStaticEntity } = await loadConvert()
    const result = await convertStaticEntity("brand", { actor: "tester", skipInitEntities: true })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.runtimeEntityId).toBe("brand")
    expect(result.deletedFiles).toHaveLength(3)
    expect(result.migratedI18nKeyCount).toBe(6)
    expect(result.redirectTo).toBe("/builder?entity=brand")

    // Source files deleted.
    for (const rel of [
      "src/domains/inventory/brand/brand.config.tsx",
      "src/domains/inventory/brand/brand.types.ts",
      "src/domains/inventory/brand/brand.schema.ts",
    ]) {
      expect(existsSync(join(sandbox, rel))).toBe(false)
    }

    // Runtime entity present in config.
    const config = readJson("messages/_overrides/runtime/config.json") as { entities: { id: string }[] }
    expect(config.entities.some(e => e.id === "brand")).toBe(true)

    // i18n migrated: pages.json.brand gone, pages_dynamic.json.brand populated.
    const enPages = readJson("messages/en/pages.json") as { brand?: unknown; other: unknown }
    expect(enPages.brand).toBeUndefined()
    expect(enPages.other).toEqual({ keep: "kept" })
    const enDynamic = readJson("messages/en/pages_dynamic.json") as { brand: { title: string } }
    expect(enDynamic.brand?.title).toBe("Brands")
    const arDynamic = readJson("messages/ar/pages_dynamic.json") as { brand: { title: string } }
    expect(arDynamic.brand?.title).toBe("العلامات")

    // Audit row written.
    const auditPath = join(sandbox, ".entity-builder-backups", "_audit.jsonl")
    expect(existsSync(auditPath)).toBe(true)
    const auditLine = readFileSync(auditPath, "utf8").trim()
    const audit = JSON.parse(auditLine) as { outcome: string; kind: string; entityName: string }
    expect(audit.outcome).toBe("success")
    expect(audit.kind).toBe("convert")
    expect(audit.entityName).toBe("brand")

    // Backup snapshot present (id is the result.backupId).
    expect(existsSync(join(sandbox, ".entity-builder-backups", result.backupId))).toBe(true)
  })
})

describe("convertStaticEntity — refusals", () => {
  it("returns 422 with reason and filePath when the parser refuses", async () => {
    seed("src/domains/business/order/order.config.tsx", ORDER_REFUSED_CONFIG)
    seedI18n()
    seedEmptyRuntimeConfig()
    const { convertStaticEntity } = await loadConvert()
    const result = await convertStaticEntity("order", { skipInitEntities: true })
    expect(result.ok).toBe(false)
    if (result.ok || result.status !== 422) throw new Error("expected 422 refusal")
    expect(result.reason).toMatch(/listColumns is an identifier/)
    // No mutations: source still there, runtime config still empty.
    expect(existsSync(join(sandbox, "src/domains/business/order/order.config.tsx"))).toBe(true)
    const config = readJson("messages/_overrides/runtime/config.json") as { entities: unknown[] }
    expect(config.entities).toHaveLength(0)
  })

  it("returns 422 when the entity config file does not exist", async () => {
    seedI18n()
    seedEmptyRuntimeConfig()
    const { convertStaticEntity } = await loadConvert()
    const result = await convertStaticEntity("ghost", { skipInitEntities: true })
    expect(result.ok).toBe(false)
    if (result.ok || result.status !== 422) throw new Error("expected 422 refusal")
    expect(result.reason).toMatch(/Config file not found/)
  })
})

describe("convertStaticEntity — rollback", () => {
  it("rolls back fully when the source-file unlink fails midway", async () => {
    seedBrand()
    seedI18n()
    seedEmptyRuntimeConfig()

    // Make the SECOND unlink throw. The first delete (of brand.config.tsx)
    // succeeds, but the run never finishes — the restoreSnapshot path then
    // recreates the deleted file from the backup.
    const fsModule = await import("node:fs")
    const realUnlink = fsModule.promises.unlink
    let calls = 0
    vi.spyOn(fsModule.promises, "unlink").mockImplementation(async (p: Parameters<typeof realUnlink>[0]) => {
      calls += 1
      if (calls === 2) throw new Error("Synthetic unlink failure")
      return realUnlink(p)
    })

    const { convertStaticEntity } = await loadConvert()
    const result = await convertStaticEntity("brand", { skipInitEntities: true })
    expect(result.ok).toBe(false)
    if (result.ok || result.status !== 500) throw new Error("expected 500 failure")
    expect(result.rolledBack).toBe(true)
    expect(result.backupId).toBeTruthy()

    // All 3 source files restored from snapshot.
    for (const rel of [
      "src/domains/inventory/brand/brand.config.tsx",
      "src/domains/inventory/brand/brand.types.ts",
      "src/domains/inventory/brand/brand.schema.ts",
    ]) {
      expect(existsSync(join(sandbox, rel))).toBe(true)
    }
    // Runtime entity removed.
    const config = readJson("messages/_overrides/runtime/config.json") as { entities: unknown[] }
    expect(config.entities).toHaveLength(0)
    // pages.json restored from snapshot (brand subtree present again).
    const enPages = readJson("messages/en/pages.json") as { brand?: unknown }
    expect(enPages.brand).toBeDefined()

    // Audit row notes the rollback.
    const auditLine = readFileSync(join(sandbox, ".entity-builder-backups", "_audit.jsonl"), "utf8").trim()
    const audit = JSON.parse(auditLine) as { outcome: string; error: string }
    expect(audit.outcome).toBe("rolled-back")
    expect(audit.error).toMatch(/Synthetic unlink failure/)
  })

  it("rolls back when `npm run init-entities` fails after source deletion", async () => {
    seedBrand()
    seedI18n()
    seedEmptyRuntimeConfig()

    // No `npm` / `package.json` exists in the sandbox, so leaving skipInit
    // off makes `execSync("npm run init-entities", { cwd: sandbox })` throw
    // — exactly the failure mode we want to cover for step 6.
    const { convertStaticEntity } = await loadConvert()
    const result = await convertStaticEntity("brand", { skipInitEntities: false })
    expect(result.ok).toBe(false)
    if (result.ok || result.status !== 500) throw new Error("expected 500 failure")
    expect(result.rolledBack).toBe(true)

    // Source files restored from snapshot — the unlink already happened in
    // step 5, restoreSnapshot recreates them.
    for (const rel of [
      "src/domains/inventory/brand/brand.config.tsx",
      "src/domains/inventory/brand/brand.types.ts",
      "src/domains/inventory/brand/brand.schema.ts",
    ]) {
      expect(existsSync(join(sandbox, rel))).toBe(true)
    }
    // Runtime entity dropped.
    const config = readJson("messages/_overrides/runtime/config.json") as { entities: unknown[] }
    expect(config.entities).toHaveLength(0)
    // Audit row notes the rollback.
    const auditLine = readFileSync(join(sandbox, ".entity-builder-backups", "_audit.jsonl"), "utf8").trim()
    const audit = JSON.parse(auditLine) as { outcome: string; error: string }
    expect(audit.outcome).toBe("rolled-back")
  })

  it("refuses second call when the runtime entity already exists (no race)", async () => {
    seedBrand()
    seedI18n()
    seed(
      "messages/_overrides/runtime/config.json",
      JSON.stringify(
        { entities: [{ id: "brand", fields: [] }], pages: [], dashboards: [], settings: { version: 1 } },
        null,
        2,
      ) + "\n",
    )

    const { convertStaticEntity } = await loadConvert()
    const result = await convertStaticEntity("brand", { skipInitEntities: true })
    expect(result.ok).toBe(false)
    if (result.ok || result.status !== 500) throw new Error("expected 500 failure")
    // The duplicate check throws after parsing → 500 with rolledBack:true
    // (snapshot already taken; rollback removes nothing material since
    // addEntityToConfig refused to insert).
    expect(result.error).toMatch(/already exists/)
    expect(result.rolledBack).toBe(true)
    // Source files still on disk (no deletion happened).
    expect(existsSync(join(sandbox, "src/domains/inventory/brand/brand.config.tsx"))).toBe(true)
  })
})
