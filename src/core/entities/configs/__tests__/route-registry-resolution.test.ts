/**
 * Route ↔ entity-registry resolution guard.
 *
 * Regression test for the generator collision that silently broke /items and
 * /price-lists: a nested `entityName`
 * poisoned the generated registry key, so a route's `entityConfigName` resolved
 * to nothing and the page rendered `configuration_not_found`.
 *
 * Asserts (a) every `entityConfigName`/`entityName` literal used in a
 * (dashboard) page.tsx resolves to a known registry key, and (b) init.ts
 * registers every key exactly once.
 */
import { describe, it, expect } from "vitest"
import fs from "node:fs"
import path from "node:path"
import { initializeEntityConfigs } from "@/core/entities/configs/init"
import { getKnownEntityNames } from "@/core/entities/registry"

const ROOT = process.cwd()
const DASHBOARD_DIR = path.join(ROOT, "src", "app", "(dashboard)")
const INIT_FILE = path.join(ROOT, "src", "core", "entities", "configs", "init.ts")

function collectPageFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) collectPageFiles(full, out)
    else if (entry.name === "page.tsx") out.push(full)
  }
  return out
}

describe("route ↔ entity-registry resolution", () => {
  try {
    initializeEntityConfigs()
  } catch {
    /* already initialized in this module instance */
  }
  const known = new Set(getKnownEntityNames())

  it("init.ts registers every entityName exactly once (no collisions)", () => {
    const content = fs.readFileSync(INIT_FILE, "utf8")
    const keys = [...content.matchAll(/registerLazyLoader\("([^"]+)"/g)].map(m => m[1])
    const duplicates = keys.filter((k, i) => keys.indexOf(k) !== i)
    expect(duplicates).toEqual([])
    // Representative entities must each be present exactly once (the original bug).
    expect(keys.filter(k => k === "example")).toHaveLength(1)
    expect(keys.filter(k => k === "role")).toHaveLength(1)
  })

  it("every entityConfigName/entityName literal in (dashboard) page.tsx resolves in the registry", () => {
    const pages = collectPageFiles(DASHBOARD_DIR)
    const missing: { file: string; name: string }[] = []
    for (const file of pages) {
      const content = fs.readFileSync(file, "utf8")
      for (const m of content.matchAll(/entity(?:Config)?Name=["']([a-z0-9-]+)["']/g)) {
        const name = m[1]
        if (name && !known.has(name)) missing.push({ file: path.relative(ROOT, file), name })
      }
    }
    expect(missing).toEqual([])
  })
})
