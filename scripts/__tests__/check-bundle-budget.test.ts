/**
 * End-to-end test for `scripts/check-bundle-budget.mjs`.
 *
 * The script reads `.next/build-manifest.json`, `.next/app-build-manifest.json`,
 * and `bundle-budgets.json` from the cwd, gzips referenced chunk files, and
 * exits 1 if any cap is exceeded. We exercise it inside a tmp directory
 * holding hand-crafted manifests + chunk fixtures.
 *
 * The "done when" criterion from the spec is the route-over-budget case:
 * stderr must call out the offending route and its delta.
 */

import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { tmpdir } from "node:os"
import { join, resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { randomBytes } from "node:crypto"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, "..", "..")
const SCRIPT = resolve(ROOT, "scripts", "check-bundle-budget.mjs")

interface RunResult {
  status: number
  stdout: string
  stderr: string
}

let sandbox: string

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), "bundle-budget-test-"))
  mkdirSync(join(sandbox, ".next", "static", "chunks"), { recursive: true })
})

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true })
})

function run(): RunResult {
  try {
    const stdout = execFileSync("node", [SCRIPT], {
      cwd: sandbox,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })
    return { status: 0, stdout, stderr: "" }
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string }
    return { status: e.status ?? -1, stdout: e.stdout ?? "", stderr: e.stderr ?? "" }
  }
}

// Write a chunk file whose gzipped size is approximately `targetGzipKB`.
// Cryptographic random bytes are effectively incompressible, so gzip output
// length ≈ input length within a few percent — close enough for the
// pass/fail thresholds the tests rely on.
function writeChunk(relPath: string, targetGzipKB: number): void {
  const abs = join(sandbox, ".next", relPath)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, randomBytes(Math.max(1, Math.round(targetGzipKB * 1024))))
}

function writeManifests(opts: { shared: string[]; routes: Record<string, string[]> }): void {
  writeFileSync(
    join(sandbox, ".next", "build-manifest.json"),
    JSON.stringify({
      pages: { "/_app": [] },
      devFiles: [],
      polyfillFiles: [],
      lowPriorityFiles: [],
      rootMainFiles: opts.shared,
    }),
  )
  writeFileSync(join(sandbox, ".next", "app-build-manifest.json"), JSON.stringify({ pages: opts.routes }))
}

function writeBudgets(b: { shared: number; routes: Record<string, number> }): void {
  writeFileSync(join(sandbox, "bundle-budgets.json"), JSON.stringify(b))
}

describe("check:bundle-budget CI script", () => {
  it("exits 0 when shared and all routes fit their budgets", () => {
    writeChunk("static/chunks/shared.js", 100)
    writeChunk("static/chunks/list.js", 50)
    writeManifests({
      shared: ["static/chunks/shared.js"],
      routes: { "/(dashboard)/items/page": ["static/chunks/list.js"] },
    })
    writeBudgets({ shared: 350, routes: { default: 150 } })

    const r = run()
    expect(r.status, r.stderr || r.stdout).toBe(0)
    expect(r.stdout).toMatch(/Within budget/)
  })

  it("FAILS with route + size delta when a list page busts the default cap (xlsx scenario)", () => {
    // Default cap: 150 KB. Drop a 400 KB chunk to mimic adding `import "xlsx"`.
    writeChunk("static/chunks/shared.js", 100)
    writeChunk("static/chunks/heavy-list.js", 400)
    writeManifests({
      shared: ["static/chunks/shared.js"],
      routes: { "/(dashboard)/items/page": ["static/chunks/heavy-list.js"] },
    })
    writeBudgets({ shared: 350, routes: { default: 150 } })

    const r = run()
    expect(r.status).toBe(1)
    // Spec acceptance: error names the exact route and the delta.
    expect(r.stderr).toMatch(/\/\(dashboard\)\/items\/page/)
    expect(r.stderr).toMatch(/exceeds 150 KB cap by/)
    expect(r.stderr).toMatch(/routes\.default/)
  })

  it("FAILS when a route with an explicit budget exceeds it", () => {
    writeChunk("static/chunks/shared.js", 100)
    writeChunk("static/chunks/dash.js", 300)
    writeManifests({
      shared: ["static/chunks/shared.js"],
      routes: { "/(dashboard)/page": ["static/chunks/dash.js"] },
    })
    writeBudgets({
      shared: 350,
      routes: { "/(dashboard)/page": 220, default: 150 },
    })

    const r = run()
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/\/\(dashboard\)\/page/)
    expect(r.stderr).toMatch(/exceeds 220 KB cap/)
    expect(r.stderr).toMatch(/budget source: explicit/)
  })

  it("FAILS when shared exceeds its budget", () => {
    writeChunk("static/chunks/shared.js", 500)
    writeManifests({
      shared: ["static/chunks/shared.js"],
      routes: {},
    })
    writeBudgets({ shared: 350, routes: { default: 150 } })

    const r = run()
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/Shared bundle is/)
    expect(r.stderr).toMatch(/cap 350 KB/)
  })

  it("excludes shared chunks from per-route weight", () => {
    // The list route declares `shared.js` *and* `list.js`; only `list.js`
    // counts toward its budget because shared is already accounted for.
    writeChunk("static/chunks/shared.js", 200)
    writeChunk("static/chunks/list.js", 50)
    writeManifests({
      shared: ["static/chunks/shared.js"],
      routes: {
        "/(dashboard)/items/page": ["static/chunks/shared.js", "static/chunks/list.js"],
      },
    })
    writeBudgets({ shared: 350, routes: { default: 100 } })

    const r = run()
    expect(r.status, r.stderr || r.stdout).toBe(0)
  })

  it("falls back to walking .next/static/chunks/app/ when app-build-manifest.json is missing", () => {
    writeChunk("static/chunks/shared.js", 50)
    // Webpack-style layout: chunks under app/<route>/page-<hash>.js
    writeChunk("static/chunks/app/(dashboard)/items/page-abc123.js", 400)
    // Only build-manifest.json this time — no app-build-manifest.json.
    writeFileSync(
      join(sandbox, ".next", "build-manifest.json"),
      JSON.stringify({
        pages: { "/_app": [] },
        devFiles: [],
        polyfillFiles: [],
        lowPriorityFiles: [],
        rootMainFiles: ["static/chunks/shared.js"],
      }),
    )
    writeBudgets({ shared: 350, routes: { default: 150 } })

    const r = run()
    expect(r.status).toBe(1)
    // Walker synthesizes "<route>/page" keys; the route folder maps to it.
    expect(r.stderr).toMatch(/\(dashboard\)\/items\/page/)
    expect(r.stdout).toMatch(/manifest fallback/)
  })

  it("exits 1 when bundle-budgets.json is missing", () => {
    writeChunk("static/chunks/shared.js", 10)
    writeManifests({ shared: ["static/chunks/shared.js"], routes: {} })
    // No bundle-budgets.json written.

    const r = run()
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/bundle-budgets\.json not found/)
  })

  it("exits 1 when bundle-budgets.json lacks routes.default", () => {
    writeChunk("static/chunks/shared.js", 10)
    writeManifests({ shared: ["static/chunks/shared.js"], routes: {} })
    writeFileSync(
      join(sandbox, "bundle-budgets.json"),
      JSON.stringify({ shared: 350, routes: { "/(dashboard)/page": 220 } }),
    )

    const r = run()
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/routes\.default/)
  })
})
