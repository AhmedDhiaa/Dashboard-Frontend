/**
 * End-to-end pass over every real `*.config.{ts,tsx}` under `src/domains/`.
 *
 * The detailed PASS/REFUSE table is committed under
 * `docs/static-entity-convertibility.md` (rebuilt via
 * `scripts/build-static-entity-convertibility.mts`). The test here is
 * deliberately coarse: it asserts the report's *shape* and a sensible
 * floor on the convert pass-rate so a future regression that flips an
 * entire pattern to refused (or vice versa) flunks CI.
 */

import { describe, it, expect } from "vitest"
import path from "node:path"
import { buildConvertibilityReport } from "../parse-static-config"

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..", "..", "..", "..")

// The walk reads 51 .config.{ts,tsx} files and parses each via the TS
// compiler. Under full-suite load on slow runners that brushes against
// vitest's 5s default; 20s is comfortable headroom without masking a
// real regression.
const SLOW_TIMEOUT_MS = 20_000

describe("buildConvertibilityReport", () => {
  it("reports on every config under src/domains/", { timeout: SLOW_TIMEOUT_MS }, async () => {
    const rows = await buildConvertibilityReport({ repoRoot: REPO_ROOT })
    // ~17 configs remain after the platform strip-down (business + relational
    // domains removed). A wide band catches catastrophic loss (zero rows) or a
    // glob escape (hundreds of rows) without flaking on entity adds/removes.
    expect(rows.length).toBeGreaterThanOrEqual(8)
    expect(rows.length).toBeLessThanOrEqual(80)
    for (const row of rows) {
      expect(typeof row.entityName).toBe("string")
      expect(row.configPath.endsWith(".tsx") || row.configPath.endsWith(".ts")).toBe(true)
      if (row.ok) {
        expect(row.reason).toBeNull()
      } else {
        expect(typeof row.reason).toBe("string")
        expect(row.reason!.length).toBeGreaterThan(0)
      }
    }
  })

  it("converts at least a handful of basic CRUD entities", { timeout: SLOW_TIMEOUT_MS }, async () => {
    // Sanity floor: connection / enum / notification are the simple
    // shapes that remain after the strip-down. The convert flow exists to
    // handle those, so at least SOME must pass — this catches the failure mode
    // where a future refusal-rule tightening accidentally refuses everything.
    const rows = await buildConvertibilityReport({ repoRoot: REPO_ROOT })
    const passCount = rows.filter(r => r.ok).length
    expect(passCount).toBeGreaterThanOrEqual(2)
  })

  it("refuses the canonical complex entities (order)", { timeout: SLOW_TIMEOUT_MS }, async () => {
    const rows = await buildConvertibilityReport({ repoRoot: REPO_ROOT })
    const order = rows.find(r => r.entityName === "order")
    if (order) {
      expect(order.ok).toBe(false)
      expect(order.reason).toMatch(/external renderers|custom render/i)
    }
  })
})
