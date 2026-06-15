#!/usr/bin/env node
/**
 * CI guard: enforce gzipped budgets on the shared and per-route JS bundles.
 *
 * Budgets live in ./bundle-budgets.json so PRs that change a cap show up in
 * the diff and force a reviewer conversation. Schema:
 *
 *   {
 *     "shared": 350,                           // first-load shared JS (KB, gzip)
 *     "routes": {
 *       "/(dashboard)/page": 220,              // per-route incremental weight (KB, gzip)
 *       "default": 150                         // fallback for unlisted routes
 *     }
 *   }
 *
 * Route keys mirror what Next emits in `.next/app-build-manifest.json` —
 * the App-Router file-system path including parens groups and `[id]`
 * placeholders. The `shared` and `routes.default` keys are required.
 *
 * What we measure
 *   1. Shared first-load JS — chunks in build-manifest.json's
 *      `rootMainFiles` + `polyfillFiles`. Loaded by every page.
 *   2. Per-route incremental — chunks the App-Router manifest lists for
 *      a route, minus anything already in the shared set.
 *
 * If `.next/app-build-manifest.json` is missing (Turbopack builds don't
 * emit it yet) we fall back to walking `.next/static/chunks/app/` and
 * deriving the route → chunks mapping from directory layout. Either source
 * yields the same comparison: route weight vs. its budget.
 *
 * On failure each over-budget route is reported with route key, actual
 * route-only first-load weight, the cap that applied, and the delta.
 */

import { readFileSync, existsSync, statSync, readdirSync } from "node:fs"
import path from "node:path"
import zlib from "node:zlib"

const NEXT_DIR = ".next"
const BUILD_MANIFEST = path.join(NEXT_DIR, "build-manifest.json")
const APP_MANIFEST = path.join(NEXT_DIR, "app-build-manifest.json")
const APP_CHUNKS_DIR = path.join(NEXT_DIR, "static", "chunks", "app")
const BUDGETS_FILE = "bundle-budgets.json"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function gzipSize(filePath) {
  return zlib.gzipSync(readFileSync(filePath), { level: 9 }).length
}

function fmtKB(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`
}

function gzipMaybe(file) {
  // Manifests reference paths relative to `.next/`. Skip non-JS or removed entries.
  if (!file.endsWith(".js")) return 0
  const abs = path.join(NEXT_DIR, file)
  if (!existsSync(abs)) return 0
  return gzipSize(abs)
}

function loadBudgets() {
  if (!existsSync(BUDGETS_FILE)) {
    console.error(`\n✗ ${BUDGETS_FILE} not found at project root.\n`)
    process.exit(1)
  }
  const raw = JSON.parse(readFileSync(BUDGETS_FILE, "utf8"))
  if (typeof raw.shared !== "number") {
    console.error(`\n✗ ${BUDGETS_FILE}: missing required "shared" (number, KB).\n`)
    process.exit(1)
  }
  if (!raw.routes || typeof raw.routes !== "object") {
    console.error(`\n✗ ${BUDGETS_FILE}: missing required "routes" object.\n`)
    process.exit(1)
  }
  if (typeof raw.routes.default !== "number") {
    console.error(`\n✗ ${BUDGETS_FILE}: missing required "routes.default" (number, KB).\n`)
    process.exit(1)
  }
  return raw
}

function budgetForRoute(budgets, route) {
  const explicit = budgets.routes[route]
  if (typeof explicit === "number") return { kb: explicit, override: true }
  return { kb: budgets.routes.default, override: false }
}

// Walk `.next/static/chunks/app/<route>/...` and return a Map<route, chunks[]>
// matching the shape of `app-build-manifest.json#pages`. Used as a fallback
// when the build doesn't emit the manifest (Turbopack today).
function walkAppChunks(dir, prefix = "") {
  if (!existsSync(dir)) return new Map()
  const out = new Map()
  function visit(absDir, route) {
    const entries = readdirSync(absDir, { withFileTypes: true })
    const localChunks = []
    for (const e of entries) {
      const abs = path.join(absDir, e.name)
      if (e.isDirectory()) {
        // Next encodes parens groups and [id] segments verbatim as folders.
        visit(abs, route ? `${route}/${e.name}` : `/${e.name}`)
      } else if (e.isFile() && e.name.endsWith(".js")) {
        // Path stored relative to `.next/` so gzipMaybe can resolve it the
        // same way it does manifest entries.
        localChunks.push(path.relative(NEXT_DIR, abs).replaceAll("\\", "/"))
      }
    }
    if (localChunks.length > 0) {
      // Synthesize a route key. Files like `page-<hash>.js` and
      // `layout-<hash>.js` live in the route folder; we attribute all of
      // them to `<route>/page` so the report aligns with the manifest.
      const routeKey = `${route || ""}/page`
      out.set(routeKey, localChunks)
    }
  }
  visit(dir, prefix)
  return out
}

// ─── Entry guard ─────────────────────────────────────────────────────────────

if (!statSync(BUILD_MANIFEST, { throwIfNoEntry: false })?.isFile()) {
  console.error(
    `\n✗ ${BUILD_MANIFEST} not found.\n` +
      `   Run \`next build\` (or \`npm run build\`) before this script.\n`,
  )
  process.exit(1)
}

const budgets = loadBudgets()
const buildManifest = JSON.parse(readFileSync(BUILD_MANIFEST, "utf8"))

// ─── Shared budget ───────────────────────────────────────────────────────────

const sharedFiles = [
  ...(buildManifest.rootMainFiles ?? []),
  ...(buildManifest.polyfillFiles ?? []),
]
const sharedSet = new Set(sharedFiles)
const sharedMeasurements = sharedFiles
  .map(f => ({ file: f, gzip: gzipMaybe(f) }))
  .sort((a, b) => b.gzip - a.gzip)
const sharedTotal = sharedMeasurements.reduce((s, m) => s + m.gzip, 0)
const sharedBudgetBytes = budgets.shared * 1024
const sharedOk = sharedTotal <= sharedBudgetBytes

console.log("\nShared first-load JS chunks (gzipped, level 9):")
for (const m of sharedMeasurements) {
  console.log(`  ${fmtKB(m.gzip).padStart(10)}   ${path.basename(m.file)}`)
}
console.log(`  ${"-".repeat(10)}`)
console.log(`  ${fmtKB(sharedTotal).padStart(10)}   total (${sharedMeasurements.length} files)`)
console.log()
console.log(`Shared budget: ${budgets.shared} KB`)
console.log(`Shared actual: ${(sharedTotal / 1024).toFixed(1)} KB`)
console.log(
  `Headroom:      ${
    sharedOk
      ? `+${fmtKB(sharedBudgetBytes - sharedTotal)} (${(((sharedBudgetBytes - sharedTotal) / sharedBudgetBytes) * 100).toFixed(1)}%)`
      : `−${fmtKB(sharedTotal - sharedBudgetBytes)} (over budget)`
  }`,
)

// ─── Per-route budgets ───────────────────────────────────────────────────────

const SKIP_ROUTES = new Set(["/_app", "/_error", "/_document", "/_not-found"])
let routeSource = null
let routePages = null

if (existsSync(APP_MANIFEST)) {
  routeSource = "app-build-manifest.json"
  const app = JSON.parse(readFileSync(APP_MANIFEST, "utf8"))
  routePages = new Map(Object.entries(app.pages ?? {}))
} else if (existsSync(APP_CHUNKS_DIR)) {
  routeSource = ".next/static/chunks/app/ (manifest fallback)"
  routePages = walkAppChunks(APP_CHUNKS_DIR)
}

const routeReports = []
if (routePages) {
  for (const [route, chunks] of routePages) {
    if (SKIP_ROUTES.has(route)) continue
    if (!Array.isArray(chunks)) continue
    const routeOnly = chunks.filter(c => c.endsWith(".js") && !sharedSet.has(c))
    const routeGzip = routeOnly.reduce((s, f) => s + gzipMaybe(f), 0)
    const { kb: capKB, override } = budgetForRoute(budgets, route)
    const cap = capKB * 1024
    routeReports.push({
      route,
      routeGzip,
      firstLoad: routeGzip + sharedTotal,
      cap,
      capKB,
      ok: routeGzip <= cap,
      override,
    })
  }
  routeReports.sort((a, b) => b.routeGzip - a.routeGzip)

  console.log(`\nPer-route JS (gzipped, source: ${routeSource}):`)
  console.log(
    `  ${"route".padEnd(50)}  ${"route-only".padStart(10)}  ${"first-load".padStart(10)}  ${"cap".padStart(8)}  status`,
  )
  for (const r of routeReports) {
    const status = r.ok ? "ok" : "OVER"
    const tag = r.override ? " *" : ""
    console.log(
      `  ${r.route.padEnd(50)}  ${fmtKB(r.routeGzip).padStart(10)}  ${fmtKB(r.firstLoad).padStart(10)}  ${r.capKB.toString().padStart(6)} KB  ${status}${tag}`,
    )
  }
  console.log("\n  (* = explicit per-route budget; otherwise routes.default applies)")
} else {
  console.warn(
    "\n! No App-Router manifest or chunks directory found.\n" +
      "  Per-route checks were skipped. Shared budget is still enforced.",
  )
}

// ─── Verdict ─────────────────────────────────────────────────────────────────

const overRoutes = routeReports.filter(r => !r.ok)
const ok = sharedOk && overRoutes.length === 0

if (!ok) {
  console.error("\n✗ Bundle budget exceeded.")
  if (!sharedOk) {
    const delta = sharedTotal - sharedBudgetBytes
    console.error(
      `   Shared bundle is ${fmtKB(sharedTotal)} (cap ${budgets.shared} KB, over by ${fmtKB(delta)}).\n` +
        `   Either remove weight (run \`npm run analyze\` to see what landed) or, if\n` +
        `   the bump is justified, raise "shared" in ${BUDGETS_FILE} and reference\n` +
        `   the rationale in the PR description.`,
    )
  }
  for (const r of overRoutes) {
    const delta = r.routeGzip - r.cap
    console.error(
      `   Route ${r.route}: route-only ${fmtKB(r.routeGzip)} exceeds ${r.capKB} KB cap by ${fmtKB(delta)} ` +
        `(first-load ${fmtKB(r.firstLoad)}, budget source: ${r.override ? "explicit" : "routes.default"}).`,
    )
  }
  console.error()
  process.exit(1)
}

if (routePages) {
  console.log("\n✓ Within budget (shared + per-route).")
} else {
  console.log("\n✓ Within budget (shared only; per-route unchecked).")
}
