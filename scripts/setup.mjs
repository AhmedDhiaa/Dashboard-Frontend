#!/usr/bin/env node
/**
 * Project initializer — `npm run setup`.
 *
 * Turns a fresh clone into a runnable, rebranded app in one command:
 *   1. Copies `.env.example` → `.env` (never clobbers an existing `.env`).
 *   2. Generates cryptographically-strong `AUTH_SECRET` / `NEXTAUTH_SECRET`
 *      (the thing everyone forgets / does insecurely — works on Windows too,
 *      no `openssl` needed).
 *   3. Applies any branding / backend overrides passed as flags.
 *   4. Picks mock-mode automatically: ON if you gave no API URL (standalone
 *      demo), OFF the moment you point it at a real backend.
 *   5. (optional) Regenerates the swagger-drift snapshot from the new backend's
 *      spec, so the API guardrail matches the backend you're wiring up.
 *
 * Zero dependencies — Node built-ins only. Cross-platform.
 *
 * Usage:
 *   npm run setup
 *   npm run setup -- --name "Peace Bird" --domain peacebird.iq \
 *                    --api-url https://api.peacebird.iq --client-id Api_App \
 *                    --swagger-url https://api.peacebird.iq/swagger/v1/swagger.json
 *   npm run setup -- --force        # overwrite an existing .env
 *
 * Flags (all optional):
 *   --name <str>         NEXT_PUBLIC_APP_NAME       (UI/title/email display name)
 *   --domain <str>       NEXT_PUBLIC_BRAND_DOMAIN   (emails, image allow-list)
 *   --api-url <url>      NEXT_PUBLIC_API_URL + API_URL (real backend → mock off)
 *   --socket-url <url>   NEXT_PUBLIC_SOCKET_URL
 *   --client-id <str>    NEXT_PUBLIC_CLIENT_ID      (ABP OAuth2 public client)
 *   --swagger-url <url>  Fetch the backend's OpenAPI/Swagger and rewrite the
 *                        drift snapshot (scripts/swagger-paths.json).
 *   --swagger-json <path> Same, from a local swagger JSON file.
 *   --mock <true|false>  force standalone mock mode on/off
 *   --force              overwrite an existing .env
 */

import { readFileSync, writeFileSync, existsSync, copyFileSync } from "node:fs"
import { randomBytes } from "node:crypto"
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const ENV = join(ROOT, ".env")
const EXAMPLE = join(ROOT, ".env.example")

// ─── parse flags ──────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith("--")) continue
    const key = a.slice(2)
    if (key === "force") {
      out.force = true
      continue
    }
    out[key] = argv[++i]
  }
  return out
}
const args = parseArgs(process.argv.slice(2))

// ─── guard ──────────────────────────────────────────────────────────────────
if (!existsSync(EXAMPLE)) {
  console.error("✖ .env.example not found — run this from the project root.")
  process.exit(1)
}
if (existsSync(ENV) && !args.force) {
  console.error("✖ .env already exists. Re-run with `--force` to overwrite, or edit it by hand.")
  process.exit(1)
}

// ─── build the value map ──────────────────────────────────────────────────────
const secret = randomBytes(32).toString("base64")
const hasRealBackend = Boolean(args["api-url"])
// mock: explicit flag wins; otherwise off when a backend URL is supplied, on for a standalone demo.
const mock = args.mock != null ? String(args.mock) : hasRealBackend ? "false" : "true"

const overrides = {
  AUTH_SECRET: secret,
  NEXTAUTH_SECRET: secret,
  NEXT_PUBLIC_USE_MOCK_API: mock,
}
if (args.name) overrides.NEXT_PUBLIC_APP_NAME = args.name
if (args.domain) overrides.NEXT_PUBLIC_BRAND_DOMAIN = args.domain
if (args["api-url"]) {
  overrides.NEXT_PUBLIC_API_URL = args["api-url"]
  overrides.API_URL = args["api-url"]
}
if (args["socket-url"]) overrides.NEXT_PUBLIC_SOCKET_URL = args["socket-url"]
if (args["client-id"]) overrides.NEXT_PUBLIC_CLIENT_ID = args["client-id"]

// ─── apply overrides line-by-line (preserves comments/structure) ───────────────
copyFileSync(EXAMPLE, ENV)
const lines = readFileSync(ENV, "utf8").split(/\r?\n/)
const applied = new Set()
const next = lines.map(line => {
  const m = line.match(/^([A-Z0-9_]+)=/)
  if (m && overrides[m[1]] !== undefined) {
    applied.add(m[1])
    return `${m[1]}=${overrides[m[1]]}`
  }
  return line
})
// Append any override whose key wasn't present in .env.example.
const missing = Object.keys(overrides).filter(k => !applied.has(k))
if (missing.length) {
  next.push("", "# ── added by setup ──")
  for (const k of missing) next.push(`${k}=${overrides[k]}`)
}
writeFileSync(ENV, next.join("\n"))

// ─── report ───────────────────────────────────────────────────────────────────
console.log("✓ Wrote .env")
console.log(`  • AUTH_SECRET / NEXTAUTH_SECRET  generated (32 bytes)`)
console.log(`  • NEXT_PUBLIC_USE_MOCK_API       ${mock}${hasRealBackend ? "  (real backend configured)" : "  (standalone demo)"}`)
if (args.name) console.log(`  • NEXT_PUBLIC_APP_NAME           ${args.name}`)
if (args.domain) console.log(`  • NEXT_PUBLIC_BRAND_DOMAIN       ${args.domain}`)
if (args["api-url"]) console.log(`  • NEXT_PUBLIC_API_URL / API_URL  ${args["api-url"]}`)
if (args["client-id"]) console.log(`  • NEXT_PUBLIC_CLIENT_ID          ${args["client-id"]}`)

// ─── optionally refresh the swagger snapshot for the new backend ───────────────
const swaggerUrl = args["swagger-url"]
const swaggerJson = args["swagger-json"]
if (swaggerUrl || swaggerJson) {
  try {
    const childEnv = { ...process.env }
    if (swaggerJson) childEnv.APP_SWAGGER_JSON = swaggerJson
    else childEnv.APP_SWAGGER_URL = swaggerUrl
    execFileSync(process.execPath, [join(ROOT, "scripts", "check-swagger-drift.mjs"), "--update"], {
      cwd: ROOT,
      env: childEnv,
      stdio: "inherit",
    })
    console.log(`  • swagger snapshot               refreshed from ${swaggerJson || swaggerUrl}`)
  } catch {
    const src = swaggerJson ? `APP_SWAGGER_JSON=${swaggerJson}` : `APP_SWAGGER_URL=${swaggerUrl}`
    console.warn(`  ⚠ swagger snapshot refresh failed — run it manually:`)
    console.warn(`    ${src} node scripts/check-swagger-drift.mjs --update`)
  }
}

console.log("")
if (mock === "true") {
  console.log("Next:  npm install && npm run dev   →  sign in with  demo / demo123")
} else {
  console.log("Next:  fill OAUTH2_CLIENT_SECRET + OAUTH2_ISSUER in .env, then  npm install && npm run dev")
}
console.log("Docs:  README.md  ·  docs/runbooks/production-deploy-checklist.md")
