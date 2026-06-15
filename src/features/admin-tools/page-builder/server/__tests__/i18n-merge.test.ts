import { describe, it, expect, afterEach } from "vitest"
import { promises as fs } from "node:fs"
import path from "node:path"
import { mergePageI18n, removePageI18n } from "../i18n-merge"
import type { PageSchema } from "../../schema/page-schema"

const TEST_ID_PREFIX = "test-i18n"

const ROOT = process.cwd()
const PAGES_DYNAMIC = (locale: string) => path.join(ROOT, "messages", locale, "pages_dynamic.json")

function makeId(): string {
  return `${TEST_ID_PREFIX}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`.slice(0, 41)
}

function buildPage(id: string): PageSchema {
  return {
    id,
    version: "1.0",
    title: { en: "Hello", ar: "مرحبا" },
    description: { en: "Body copy", ar: "متن" },
    permission: "Api.Admin.PageBuilder",
    layout: "full",
    blocks: [
      {
        id: `${id}-h`,
        type: "heading",
        text: { en: "Section", ar: "قسم" },
        level: 2,
        hidden: false,
      } as never,
    ],
  } as never
}

async function readJson(filePath: string): Promise<Record<string, unknown>> {
  try {
    const raw = await fs.readFile(filePath, "utf8")
    return raw.trim() ? (JSON.parse(raw) as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

afterEach(async () => {
  // Strip every TEST_ID_PREFIX entry from both bundles so subsequent runs
  // don't accumulate. We deliberately read-modify-write rather than wipe
  // the file so unrelated keys (added by hand in dev) survive.
  for (const locale of ["en", "ar"]) {
    const filePath = PAGES_DYNAMIC(locale)
    const json = await readJson(filePath)
    let dirty = false
    for (const key of Object.keys(json)) {
      if (key.startsWith(TEST_ID_PREFIX)) {
        delete json[key]
        dirty = true
      }
    }
    if (dirty) {
      const sorted: Record<string, unknown> = {}
      for (const k of Object.keys(json).sort()) sorted[k] = json[k]
      await fs.writeFile(filePath, JSON.stringify(sorted, null, 2) + "\n")
    }
  }
})

describe("mergePageI18n", () => {
  it("writes the page subtree under both locales using pageId as the top-level key", async () => {
    const id = makeId()
    const result = await mergePageI18n(buildPage(id))
    expect(result.warnings).toEqual([])
    expect(result.keysWritten).toBeGreaterThan(0)

    const en = (await readJson(PAGES_DYNAMIC("en")))[id] as Record<string, unknown>
    const ar = (await readJson(PAGES_DYNAMIC("ar")))[id] as Record<string, unknown>
    expect(en.title).toBe("Hello")
    expect(ar.title).toBe("مرحبا")
    expect(en.description).toBe("Body copy")
  })

  it("includes block-level localized strings nested under the same pageId", async () => {
    const id = makeId()
    await mergePageI18n(buildPage(id))
    const en = (await readJson(PAGES_DYNAMIC("en")))[id] as Record<string, unknown>
    expect(en.blocks).toBeDefined()
  })

  it("re-merging the same pageId replaces the previous subtree (not merges)", async () => {
    const id = makeId()
    await mergePageI18n(buildPage(id))
    const updated = { ...buildPage(id), title: { en: "Renamed", ar: "أُعيدت تسميته" } } as PageSchema
    await mergePageI18n(updated)
    const en = (await readJson(PAGES_DYNAMIC("en")))[id] as Record<string, unknown>
    expect(en.title).toBe("Renamed")
  })
})

describe("removePageI18n", () => {
  it("strips the pageId subtree from both locales", async () => {
    const id = makeId()
    await mergePageI18n(buildPage(id))
    const before = await readJson(PAGES_DYNAMIC("en"))
    expect(before[id]).toBeDefined()

    const result = await removePageI18n(id)
    expect(result.removed).toBe(true)
    const after = await readJson(PAGES_DYNAMIC("en"))
    expect(after[id]).toBeUndefined()
  })

  it("returns removed=false when the pageId isn't in either bundle", async () => {
    const id = makeId()
    const result = await removePageI18n(id)
    expect(result.removed).toBe(false)
  })
})
