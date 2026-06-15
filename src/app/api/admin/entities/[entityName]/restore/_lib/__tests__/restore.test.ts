/**
 * Restore-flow tests against a tmpdir sandbox. Mirrors the convert
 * test harness: process.chdir into a fresh mkdtemp + vi.resetModules
 * so backup.ts / runtime/_lib/constants pick up the sandbox cwd in
 * their module-load-time path constants.
 *
 * The fixture seeds a convert-shaped backup directly into
 * `.entity-builder-backups/<id>/`: three source files, both pages.json
 * (with the brand subtree intact, i.e. the PRE-convert state), and
 * both pages_dynamic.json (empty, i.e. PRE-convert). The "current"
 * live state mirrors what convert would have left behind: source files
 * deleted, pages.json with brand removed, pages_dynamic.json with the
 * brand subtree present, and a brand entity in runtime config.json.
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

type RestoreModule = typeof import("../restore")

async function loadRestore(): Promise<RestoreModule> {
  return (await import("../restore")) as RestoreModule
}

const ORIGINAL_CWD = process.cwd()
let sandbox: string

const BACKUP_ID = "2026-05-13T12-34-56-789Z"

const PAGES_PRE = {
  brand: {
    title: "Brands",
    create: { title: "New", success: "Saved" },
  },
  other: { keep: "kept" },
}
const PAGES_AR_PRE = {
  brand: { title: "العلامات" },
  other: { keep: "محفوظ" },
}
const PAGES_DYN_PRE = { "draft-page": { title: "Draft" } } // brand NOT yet migrated in
const PAGES_AR_DYN_PRE = { "draft-page": { title: "مسودة" } }

const PAGES_POST = { other: { keep: "kept" } } // brand subtree removed by convert
const PAGES_AR_POST = { other: { keep: "محفوظ" } }
const PAGES_DYN_POST = {
  "draft-page": { title: "Draft" },
  brand: { title: "Brands", create: { title: "New", success: "Saved" } },
}
const PAGES_AR_DYN_POST = {
  "draft-page": { title: "مسودة" },
  brand: { title: "العلامات" },
}

const SOURCE_FILES = [
  "src/domains/inventory/brand/brand.config.tsx",
  "src/domains/inventory/brand/brand.types.ts",
  "src/domains/inventory/brand/brand.schema.ts",
] as const

function seed(rel: string, content: string): void {
  const abs = join(sandbox, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, content, "utf8")
}

function readJson(rel: string): unknown {
  return JSON.parse(readFileSync(join(sandbox, rel), "utf8"))
}

function seedConvertBackup(): void {
  // Snapshot of pre-convert state: source files + pages.json (with
  // brand) + pages_dynamic.json (without brand).
  for (const rel of SOURCE_FILES) {
    seed(join(".entity-builder-backups", BACKUP_ID, rel), `// pre-convert ${rel}\n`)
  }
  seed(join(".entity-builder-backups", BACKUP_ID, "messages/en/pages.json"), JSON.stringify(PAGES_PRE) + "\n")
  seed(join(".entity-builder-backups", BACKUP_ID, "messages/ar/pages.json"), JSON.stringify(PAGES_AR_PRE) + "\n")
  seed(
    join(".entity-builder-backups", BACKUP_ID, "messages/en/pages_dynamic.json"),
    JSON.stringify(PAGES_DYN_PRE) + "\n",
  )
  seed(
    join(".entity-builder-backups", BACKUP_ID, "messages/ar/pages_dynamic.json"),
    JSON.stringify(PAGES_AR_DYN_PRE) + "\n",
  )
}

function seedPostConvertLiveState(): void {
  // Live state AFTER a successful convert: source files gone, pages.json
  // without brand, pages_dynamic with brand, runtime config has brand.
  seed("messages/en/pages.json", JSON.stringify(PAGES_POST, null, 4) + "\n")
  seed("messages/ar/pages.json", JSON.stringify(PAGES_AR_POST, null, 4) + "\n")
  seed("messages/en/pages_dynamic.json", JSON.stringify(PAGES_DYN_POST, null, 4) + "\n")
  seed("messages/ar/pages_dynamic.json", JSON.stringify(PAGES_AR_DYN_POST, null, 4) + "\n")
  seed(
    "messages/_overrides/runtime/config.json",
    JSON.stringify(
      {
        entities: [{ id: "brand", fields: [], pluralName: "Brands", singularName: "Brand" }],
        pages: [],
        dashboards: [],
        settings: { version: 1 },
      },
      null,
      2,
    ) + "\n",
  )
}

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), "restore-test-"))
  process.chdir(sandbox)
  vi.resetModules()
})

afterEach(() => {
  process.chdir(ORIGINAL_CWD)
  vi.restoreAllMocks()
  rmSync(sandbox, { recursive: true, force: true })
})

describe("previewRestore (dryRun)", () => {
  it("returns the planned restore shape without touching disk", async () => {
    seedConvertBackup()
    seedPostConvertLiveState()
    const { previewRestore } = await loadRestore()
    const result = await previewRestore("brand", { backupId: BACKUP_ID, dryRun: true })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.planned.backupId).toBe(BACKUP_ID)
    expect(result.planned.runtimeEntityId).toBe("brand")
    expect(result.planned.filesToRestore).toEqual(expect.arrayContaining([...SOURCE_FILES]))
    expect(result.planned.estimatedI18nKeyCount).toBeGreaterThan(0)
    // Source files still absent, pages.json still missing brand → no
    // write happened.
    for (const rel of SOURCE_FILES) expect(existsSync(join(sandbox, rel))).toBe(false)
    const pages = readJson("messages/en/pages.json") as { brand?: unknown }
    expect(pages.brand).toBeUndefined()
  })
})

describe("restoreStaticEntity — refusals", () => {
  it("refuses with 422 when the backup directory does not exist", async () => {
    seedPostConvertLiveState()
    const { restoreStaticEntity } = await loadRestore()
    const result = await restoreStaticEntity("brand", { backupId: "9999-12-31T00-00-00-000Z", dryRun: false })
    expect(result.ok).toBe(false)
    if (result.ok || result.status !== 422) throw new Error("expected 422")
    expect(result.reason).toMatch(/not found/i)
  })

  it("refuses with 422 when the backup is not a convert snapshot (no pages_dynamic)", async () => {
    // Seed a backup with only source files — no pages_dynamic = not a convert backup.
    for (const rel of SOURCE_FILES) seed(join(".entity-builder-backups", BACKUP_ID, rel), "// x")
    seed(join(".entity-builder-backups", BACKUP_ID, "messages/en/pages.json"), "{}")
    seedPostConvertLiveState()
    const { restoreStaticEntity } = await loadRestore()
    const result = await restoreStaticEntity("brand", { backupId: BACKUP_ID, dryRun: false })
    expect(result.ok).toBe(false)
    if (result.ok || result.status !== 422) throw new Error("expected 422")
    expect(result.reason).toMatch(/not a convert snapshot/i)
  })

  it("refuses with 422 when backup is convert-shaped but does not contain the requested entity", async () => {
    // Seed a convert-shaped backup but for the WRONG entity.
    seed(join(".entity-builder-backups", BACKUP_ID, "src/domains/inventory/category/category.config.tsx"), "// x")
    seed(join(".entity-builder-backups", BACKUP_ID, "messages/en/pages.json"), "{}")
    seed(join(".entity-builder-backups", BACKUP_ID, "messages/ar/pages.json"), "{}")
    seed(join(".entity-builder-backups", BACKUP_ID, "messages/en/pages_dynamic.json"), "{}")
    seed(join(".entity-builder-backups", BACKUP_ID, "messages/ar/pages_dynamic.json"), "{}")
    seedPostConvertLiveState()
    const { restoreStaticEntity } = await loadRestore()
    const result = await restoreStaticEntity("brand", { backupId: BACKUP_ID, dryRun: false })
    expect(result.ok).toBe(false)
    if (result.ok || result.status !== 422) throw new Error("expected 422")
    expect(result.reason).toMatch(/does not contain a source file for "brand"/)
  })
})

describe("restoreStaticEntity — happy path", () => {
  it("restores all 3 source files + pages.json + drops the runtime entity + audits", async () => {
    seedConvertBackup()
    seedPostConvertLiveState()
    const { restoreStaticEntity } = await loadRestore()
    const result = await restoreStaticEntity("brand", {
      backupId: BACKUP_ID,
      dryRun: false,
      actor: "tester",
      skipInitEntities: true,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return

    // Source files restored.
    for (const rel of SOURCE_FILES) {
      expect(existsSync(join(sandbox, rel))).toBe(true)
    }
    // pages.json brand subtree returned.
    const en = readJson("messages/en/pages.json") as { brand?: unknown }
    expect(en.brand).toBeDefined()
    // pages_dynamic.json brand subtree gone (restored to pre-convert state).
    const dyn = readJson("messages/en/pages_dynamic.json") as { brand?: unknown; "draft-page"?: unknown }
    expect(dyn.brand).toBeUndefined()
    expect(dyn["draft-page"]).toBeDefined()
    // Runtime entity removed.
    const config = readJson("messages/_overrides/runtime/config.json") as { entities: unknown[] }
    expect(config.entities).toHaveLength(0)
    // Audit row.
    const auditLine = readFileSync(join(sandbox, ".entity-builder-backups", "_audit.jsonl"), "utf8").trim()
    const audit = JSON.parse(auditLine) as { kind: string; outcome: string; entityName: string; safetyBackupId: string }
    expect(audit.kind).toBe("restore")
    expect(audit.outcome).toBe("success")
    expect(audit.entityName).toBe("brand")
    expect(audit.safetyBackupId).toBeTruthy()
    // Safety snapshot exists.
    expect(existsSync(join(sandbox, ".entity-builder-backups", result.safetyBackupId))).toBe(true)
  })
})

describe("restoreStaticEntity — rollback", () => {
  it("rolls back to safety snapshot when init-entities fails (no package.json in sandbox)", async () => {
    seedConvertBackup()
    seedPostConvertLiveState()
    const { restoreStaticEntity } = await loadRestore()
    // skipInitEntities defaults to false → the execSync("npm run init-entities")
    // call WILL fail in the bare sandbox (no node_modules / package.json),
    // triggering the rollback path.
    const result = await restoreStaticEntity("brand", { backupId: BACKUP_ID, dryRun: false })
    expect(result.ok).toBe(false)
    if (result.ok || result.status !== 500) throw new Error("expected 500 failure")
    expect(result.partialState).toBe("untouched")
    expect(result.rolledBack).toBe(true)
    // Safety restore put everything back to the post-convert state.
    for (const rel of SOURCE_FILES) expect(existsSync(join(sandbox, rel))).toBe(false)
    const config = readJson("messages/_overrides/runtime/config.json") as { entities: unknown[] }
    expect(config.entities).toHaveLength(1)
    // Audit row notes the rollback.
    const auditLines = readFileSync(join(sandbox, ".entity-builder-backups", "_audit.jsonl"), "utf8")
      .trim()
      .split("\n")
    const lastAudit = JSON.parse(auditLines.at(-1) ?? "{}") as { outcome: string }
    expect(lastAudit.outcome).toBe("rolled-back")
  })
})

describe("restoreStaticEntity — early refusal", () => {
  it("dryRun=true is rejected — callers should route to previewRestore", async () => {
    seedConvertBackup()
    seedPostConvertLiveState()
    const { restoreStaticEntity } = await loadRestore()
    const result = await restoreStaticEntity("brand", { backupId: BACKUP_ID, dryRun: true })
    expect(result.ok).toBe(false)
    if (result.ok || result.status !== 500) throw new Error("expected 500")
    expect(result.error).toMatch(/dryRun=true/)
  })
})
