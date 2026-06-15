#!/usr/bin/env node
/**
 * Swagger-drift guardrail.
 *
 * The systemic fix for the Phase-0 drift bugs (a service pointed at a path the
 * ABP backend doesn't expose — e.g. `/report/stock-quantity`, which 404s on
 * every load). This check extracts every hand-written resource path from the
 * `*.service.ts` files under src/domains and fails if it is absent from the spec.
 *
 * Spec source (in priority order):
 *   1. `--update` flag → fetch live (APP_SWAGGER_URL, default
 *      https://api.example.com/swagger/v1/swagger.json) OR read a local full
 *      swagger json (APP_SWAGGER_JSON=path), then rewrite the committed
 *      snapshot and exit. Use this to refresh after the backend ships new ops.
 *   2. Default run → read the committed snapshot `scripts/swagger-paths.json`.
 *      This keeps CI deterministic and offline.
 *
 * COVERAGE / LIMITS: this verifies BaseCRUDService endpoints + pure-string
 * `apiClient`/`this.client` calls. Method paths built with template literals
 * (e.g. `${this.endpoint}/by-ref/${id}`) are NOT statically extractable and
 * are out of scope — the resource-root check is the systemic guard.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs"
import { resolve, dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, "..")
const DOMAINS_DIR = join(ROOT, "src", "domains")
const SNAPSHOT_PATH = join(ROOT, "scripts", "swagger-paths.json")
const DEFAULT_SWAGGER_URL = "https://api.example.com/swagger/v1/swagger.json"

// ─── Spec snapshot ──────────────────────────────────────────────────────────

async function loadSpecPaths() {
  if (process.argv.includes("--update")) return updateSnapshot()

  if (!existsSync(SNAPSHOT_PATH)) {
    console.error(
      `✗ Missing spec snapshot ${relative(ROOT, SNAPSHOT_PATH)}.\n` +
        `  Generate it with: node scripts/check-swagger-drift.mjs --update\n` +
        `  (set APP_SWAGGER_JSON=<path> or APP_SWAGGER_URL=<url> to source the spec).`,
    )
    process.exit(1)
  }
  const snap = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8"))
  return new Set(snap.paths)
}

async function updateSnapshot() {
  const localFile = process.env.APP_SWAGGER_JSON
  const url = process.env.APP_SWAGGER_URL || DEFAULT_SWAGGER_URL
  let spec
  if (localFile) {
    spec = JSON.parse(readFileSync(localFile, "utf8"))
    console.log(`Read spec from ${localFile}`)
  } else {
    console.log(`Fetching spec from ${url} …`)
    const res = await fetch(url)
    if (!res.ok) {
      console.error(`✗ Failed to fetch spec: ${res.status} ${res.statusText}`)
      process.exit(1)
    }
    spec = await res.json()
  }
  const paths = Object.keys(spec.paths ?? {}).sort()
  if (paths.length === 0) {
    console.error("✗ Spec contained no paths — refusing to overwrite snapshot.")
    process.exit(1)
  }
  writeFileSync(
    SNAPSHOT_PATH,
    JSON.stringify({ source: localFile || url, count: paths.length, paths }, null, 2) + "\n",
  )
  console.log(`✓ Wrote ${paths.length} paths to ${relative(ROOT, SNAPSHOT_PATH)}`)
  process.exit(0)
}

// ─── Extract service paths ──────────────────────────────────────────────────

function* walkServiceFiles(dir) {
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) yield* walkServiceFiles(full)
    else if (/\.service\.(ts|tsx)$/.test(entry.name)) yield full
  }
}

// Mirror crud-service.ts normalization: a path not starting with /api becomes
// /api/app/<path>. Strip query/hash + trailing slash for matching.
function normalize(raw) {
  let p = raw.split(/[?#]/)[0].trim()
  if (!p.startsWith("/")) p = "/" + p
  if (!p.startsWith("/api")) p = "/api/app" + p
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1)
  return p
}

const CONSTRUCTOR_RE = /(?:super|new\s+BaseCRUDService\s*(?:<[^>]*>)?)\s*\(\s*"([^"]+)"/g
const ENDPOINT_RE = /endpoint\s*:\s*"([^"]+)"/g
const CLIENT_CALL_RE = /(?:apiClient|this\.client)\s*\.\s*(?:get|post|put|patch|delete)\s*(?:<[^>]*>)?\(\s*"([^"]+)"\s*[,)]/g

function extractEndpoints() {
  const found = [] // { raw, normalized, file }
  for (const file of walkServiceFiles(DOMAINS_DIR)) {
    const content = readFileSync(file, "utf8")
    const isCrud = content.includes("BaseCRUDService")
    const rel = relative(ROOT, file).replace(/\\/g, "/")
    const add = raw => found.push({ raw, normalized: normalize(raw), file: rel })

    for (const m of content.matchAll(CONSTRUCTOR_RE)) add(m[1])
    if (isCrud) for (const m of content.matchAll(ENDPOINT_RE)) add(m[1])
    for (const m of content.matchAll(CLIENT_CALL_RE)) add(m[1])
  }
  return found
}

// ─── Match ──────────────────────────────────────────────────────────────────

function isPresent(p, specPaths) {
  if (specPaths.has(p)) return true
  // Resource root: present if any spec path is nested under it (e.g. service
  // base `/api/app/order` matches the spec's `/api/app/order/{id}`).
  for (const sp of specPaths) {
    if (sp === p || sp.startsWith(p + "/")) return true
  }
  return false
}

// ─── Run ──────────────────────────────────────────────────────────────────

const specPaths = await loadSpecPaths()
const endpoints = extractEndpoints()

// Dedupe by normalized path (keep first file for the report).
const seen = new Map()
for (const e of endpoints) if (!seen.has(e.normalized)) seen.set(e.normalized, e)
const unique = [...seen.values()]

const missing = unique.filter(e => !isPresent(e.normalized, specPaths))

if (missing.length > 0) {
  console.error(`✗ Swagger drift: ${missing.length} service path(s) absent from the spec:\n`)
  for (const e of missing) {
    console.error(`  ${e.normalized}   (from "${e.raw}" in ${e.file})`)
  }
  console.error(
    `\nEither the path is wrong (fix the service to match swagger) or the backend\n` +
      `added/renamed the op (refresh the snapshot: node scripts/check-swagger-drift.mjs --update).\n` +
      `Snapshot: ${relative(ROOT, SNAPSHOT_PATH)} (${specPaths.size} spec paths).`,
  )
  process.exit(1)
}

console.log(
  `✓ Swagger drift: ${unique.length} service path(s) checked against ${specPaths.size} spec paths — all present.`,
)
process.exit(0)
