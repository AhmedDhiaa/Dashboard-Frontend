/**
 * Targeted tests for the bits of file-writer that don't need a real fs:
 * the collision messages assertNoCollision throws when a generated file
 * would land on top of an existing one.
 *
 * The full persist/rollback path is exercised via the materialize route
 * tests; this file pins ONLY the message-shape contract so a future caller
 * can branch on the error text without grepping the writer source.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { persistGeneration } from "../file-writer"
import type { CodeGenPlan } from "../code-generator"

const ORIGINAL_CWD = process.cwd()
let sandbox: string

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), "file-writer-test-"))
  process.chdir(sandbox)
})

afterEach(() => {
  process.chdir(ORIGINAL_CWD)
  rmSync(sandbox, { recursive: true, force: true })
})

function seed(relPath: string, content = "// pre-existing\n"): void {
  const abs = join(sandbox, relPath)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, content, "utf8")
}

function planWith(path: string): CodeGenPlan {
  return {
    files: [{ path, content: "// generated\n", language: "tsx" }],
    i18n: { en: {}, ar: {} },
    entityName: "brand",
  }
}

describe("assertNoCollision message contract", () => {
  it("uses the handwritten-config-specific message for a colliding .config.tsx", async () => {
    seed("src/domains/inventory/brand/brand.config.tsx")
    const plan = planWith("src/domains/inventory/brand/brand.config.tsx")
    await expect(persistGeneration(plan, { refreshRegistry: false, lintFix: false })).rejects.toThrow(
      /Refusing to overwrite handwritten config at/,
    )
    await expect(persistGeneration(plan, { refreshRegistry: false, lintFix: false })).rejects.toThrow(
      /Delete or rename it first/,
    )
  })

  it("uses the handwritten-config message for a legacy .config.ts too", async () => {
    seed("src/domains/inventory/brand/brand.config.ts")
    const plan = planWith("src/domains/inventory/brand/brand.config.ts")
    await expect(persistGeneration(plan, { refreshRegistry: false, lintFix: false })).rejects.toThrow(
      /Refusing to overwrite handwritten config/,
    )
  })

  it("falls back to the generic 'File already exists' message for non-config files", async () => {
    seed("src/domains/inventory/brand/brand.types.ts")
    const plan = planWith("src/domains/inventory/brand/brand.types.ts")
    await expect(persistGeneration(plan, { refreshRegistry: false, lintFix: false })).rejects.toThrow(
      /File already exists: src\/domains\/inventory\/brand\/brand\.types\.ts\./,
    )
  })
})
