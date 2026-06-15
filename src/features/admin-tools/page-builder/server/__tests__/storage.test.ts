import { describe, it, expect, afterEach } from "vitest"
import { promises as fs } from "node:fs"
import path from "node:path"
import {
  PAGES_DIR,
  isValidPageId,
  readPage,
  writePage,
  deletePage,
  listPages,
  readVersion,
  __testHooks,
} from "../storage"
import type { PageSchema } from "../../schema/page-schema"

const TEST_ID_PREFIX = "test-storage"

function makeId(): string {
  return `${TEST_ID_PREFIX}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`.slice(0, 41)
}

function buildPage(id: string): PageSchema {
  return {
    id,
    version: "1.0",
    title: { en: "T", ar: "ع" },
    permission: "Api.Admin.PageBuilder",
    layout: "full",
    blocks: [],
  } as never
}

afterEach(async () => {
  __testHooks.reset()
  // Best-effort cleanup of every test page we created.
  try {
    const entries = await fs.readdir(PAGES_DIR)
    for (const entry of entries) {
      if (entry.startsWith(TEST_ID_PREFIX) && entry.endsWith(".json")) {
        await fs.unlink(path.join(PAGES_DIR, entry)).catch(() => {})
      }
    }
  } catch {
    /* directory might not exist on a fresh checkout — fine */
  }
})

describe("storage — pageId validation", () => {
  it("accepts kebab-case 2-41 chars", () => {
    expect(isValidPageId("orders")).toBe(true)
    expect(isValidPageId("orders-overview")).toBe(true)
  })
  it("rejects single chars, PascalCase, leading digit, traversal sequences", () => {
    expect(isValidPageId("a")).toBe(false)
    expect(isValidPageId("OrdersOverview")).toBe(false)
    expect(isValidPageId("1orders")).toBe(false)
    expect(isValidPageId("../boom")).toBe(false)
    expect(isValidPageId("orders.json")).toBe(false)
  })
})

describe("storage — round-trip", () => {
  it("writePage + readPage returns the same schema (with stamped updatedAt)", async () => {
    const id = makeId()
    const { schema } = await writePage(id, buildPage(id))
    expect(schema.updatedAt).toBeTruthy()
    const back = await readPage(id)
    expect(back?.id).toBe(id)
    expect(back?.updatedAt).toBe(schema.updatedAt)
  })

  it("readPage returns null for unknown ids", async () => {
    expect(await readPage(makeId())).toBeNull()
  })

  it("writePage rejects when pageId/schema.id mismatch", async () => {
    const id = makeId()
    await expect(writePage(id, buildPage(`${id}-other`))).rejects.toThrow(/does not match schema\.id/)
  })

  it("writePage rejects invalid pageId", async () => {
    await expect(writePage("../boom", buildPage("../boom"))).rejects.toThrow()
  })
})

describe("storage — version bump", () => {
  it("readVersion returns a non-negative integer (zero on a fresh dir)", async () => {
    const v = await readVersion()
    expect(Number.isInteger(v)).toBe(true)
    expect(v).toBeGreaterThanOrEqual(0)
  })

  it("write followed by another write bumps the version", async () => {
    const id = makeId()
    await writePage(id, buildPage(id))
    const v1 = await readVersion()
    await writePage(id, buildPage(id))
    const v2 = await readVersion()
    expect(v2).toBeGreaterThan(v1)
  })
})

describe("storage — delete", () => {
  it("deletePage removes the file and returns removed=true + bumped version", async () => {
    const id = makeId()
    await writePage(id, buildPage(id))
    const v1 = await readVersion()
    const result = await deletePage(id)
    expect(result.removed).toBe(true)
    expect(result.version).toBeGreaterThan(v1)
    expect(await readPage(id)).toBeNull()
  })

  it("deletePage returns removed=false for unknown ids", async () => {
    const result = await deletePage(makeId())
    expect(result.removed).toBe(false)
  })
})

describe("storage — listPages", () => {
  it("listPages includes a written page summary", async () => {
    const id = makeId()
    await writePage(id, { ...buildPage(id), title: { en: "Hello list", ar: "مرحبا" } } as never)
    const pages = await listPages()
    const me = pages.find(p => p.id === id)
    expect(me).toBeDefined()
    expect(me?.title.en).toBe("Hello list")
    expect(me?.blockCount).toBe(0)
  })
})
