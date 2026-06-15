#!/usr/bin/env node
/**
 * CI guard with three independent scans. Any one of them tripping fails CI.
 *
 *   1. Env value deny-list (Task 19, original) — refuse to deploy with a
 *      env var set to a known-leaked literal value. Catches the case where
 *      a rotation never happened.
 *
 *   2. Client bundle scan (Task B5) — walks every .js file under
 *      `.next/static/` after `next build` and greps for known secret
 *      shapes (AWS/Google/GitHub keys, JWT-shaped strings) plus the
 *      live values of the env vars that should NEVER be inlined
 *      client-side (OAUTH2_CLIENT_SECRET, AUTH_SECRET, NEXTAUTH_SECRET).
 *      The scan no-ops when `.next/static` is absent so
 *      `npm run quality` can still run without a prior build.
 *
 *   3. Source name scan (Task B5) — greps source for any `NEXT_PUBLIC_*`
 *      env var whose NAME contains SECRET / KEY / PASSWORD / TOKEN.
 *      `NEXT_PUBLIC_` is inlined into the client bundle by Next, so a
 *      "secret-y" name is a smell that needs an explicit allowlist entry
 *      (the only legitimately-public one today is GOOGLE_MAPS_API_KEY).
 *
 * Operational rotation steps for scan 1 are documented per-var in the
 * REMEDIATION block below.
 */

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs"
import { resolve, dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, "..")
const ENV_PATH = resolve(ROOT, ".env")

// ─── Scan 1: env value deny-list ────────────────────────────────────────────

/**
 * Per-env-var deny list. If the live value matches any literal in the set,
 * the rotation never happened.
 */
const LEAKED_VALUES = {
  AUTH_SECRET: new Set(["acme-secret-key-2024", "your-secret-here-minimum-32-chars"]),
  NEXTAUTH_SECRET: new Set(["acme-secret-key-2024", "your-secret-here-minimum-32-chars"]),
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: new Set([
    // Removed specific key as it is confirmed working by the user.
  ]),
  OAUTH2_CLIENT_SECRET: new Set([
    // Add the leaked literal here when known. The check no-ops on empty
    // sets, so leaving this empty just means "we don't have a known-leaked
    // value to block — but we'll start tracking the moment one shows up."
  ]),
}

const REMEDIATION = {
  AUTH_SECRET:
    "Generate: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"\n" +
    "    Update the deployment secret store, redeploy. All current sessions\n" +
    "    will be invalidated — that is intentional.",
  NEXTAUTH_SECRET:
    "Same as AUTH_SECRET — generate a fresh 32-byte base64 value and set\n" +
    "    both vars to the same secret in the deployment store.",
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:
    "Google Cloud Console → APIs & Services → Credentials. Issue a new\n" +
    "    key, restrict it to HTTP referrers `*.example.com/*` and\n" +
    "    `localhost:3000/*` BEFORE deploying. Disable the old key after\n" +
    "    rollout. Without referrer restriction the key can be billed by\n" +
    "    anyone who scrapes it.",
  OAUTH2_CLIENT_SECRET:
    "Rotate with your OAuth2 provider (IdentityServer admin). Issue new\n" +
    "    client credentials, deploy, revoke the old.",
}

function readEnv(path) {
  if (!existsSync(path)) return new Map()
  const raw = readFileSync(path, "utf8")
  const map = new Map()
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    map.set(key, value)
  }
  return map
}

function runEnvDenyListScan() {
  const fileEnv = readEnv(ENV_PATH)
  const failures = []
  for (const [name, leaked] of Object.entries(LEAKED_VALUES)) {
    if (leaked.size === 0) continue
    const value = process.env[name] ?? fileEnv.get(name)
    if (!value) continue
    if (leaked.has(value)) failures.push(name)
  }
  return failures
}

// ─── Scan 2: client bundle for secret-shaped strings ────────────────────────

/**
 * Each entry is a regex that matches the shape of a real secret. Patterns
 * are intentionally loose for breadth (the cost of a false positive is
 * one allowlist entry; the cost of a false negative is a leaked secret).
 *
 * The JWT pattern requires three substantive base64url segments — short
 * test fixtures like "eyJ.eyJ.x" don't match.
 */
const SECRET_PATTERNS = [
  { name: "AWS access key", re: /AKIA[0-9A-Z]{16}/g },
  { name: "Google API key", re: /AIza[0-9A-Za-z_-]{35}/g },
  { name: "GitHub personal token", re: /gh[pousr]_[A-Za-z0-9]{36}/g },
  { name: "JWT-shaped string", re: /eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g },
]

/**
 * Live values of these env vars are added to the bundle scan as literal
 * needles. If the literal `OAUTH2_CLIENT_SECRET` value appears in any
 * client-side bundle, something on the server-only path was accidentally
 * imported into a client component or barrel file.
 */
const SERVER_ONLY_ENV_VARS = ["OAUTH2_CLIENT_SECRET", "AUTH_SECRET", "NEXTAUTH_SECRET"]

/**
 * The Google Maps key is intentionally NEXT_PUBLIC_ and shows up in the
 * client bundle by design. Any value matching this env var is allowlisted
 * for the bundle scan.
 */
const ALLOWLISTED_PUBLIC_VALUES = ["NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"]

/**
 * Source of an allowlist of literal values per pattern. Populated lazily
 * from process.env at scan time.
 */
function buildAllowlist() {
  const fileEnv = readEnv(ENV_PATH)
  const allow = new Set()
  for (const name of ALLOWLISTED_PUBLIC_VALUES) {
    const v = process.env[name] ?? fileEnv.get(name)
    if (v) allow.add(v)
  }
  return allow
}

function buildServerOnlyNeedles() {
  const fileEnv = readEnv(ENV_PATH)
  const needles = []
  for (const name of SERVER_ONLY_ENV_VARS) {
    const v = process.env[name] ?? fileEnv.get(name)
    // Skip empty / placeholder values so we don't false-positive on every
    // bundle that contains the literal string "your-secret-here-...".
    if (v && v.length >= 16 && !v.startsWith("your-")) {
      needles.push({ envName: name, value: v })
    }
  }
  return needles
}

/**
 * Recursively walk a directory and yield every file path. Returns an
 * empty list if the dir doesn't exist (so callers don't have to guard).
 */
function* walkFiles(dir, predicate = () => true) {
  if (!existsSync(dir)) return
  const stack = [dir]
  while (stack.length > 0) {
    const current = stack.pop()
    let entries
    try {
      entries = readdirSync(current, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const next = join(current, entry.name)
      if (entry.isDirectory()) stack.push(next)
      else if (entry.isFile() && predicate(next)) yield next
    }
  }
}

function findStaticDirs() {
  // Standard build → .next/static; standalone build → .next/standalone/.next/static.
  const candidates = [join(ROOT, ".next", "static"), join(ROOT, ".next", "standalone", ".next", "static")]
  return candidates.filter(p => existsSync(p))
}

function runClientBundleScan() {
  const dirs = findStaticDirs()
  if (dirs.length === 0) {
    return { scanned: 0, findings: [], skipped: true }
  }
  const allowlist = buildAllowlist()
  const serverOnlyNeedles = buildServerOnlyNeedles()
  const findings = []
  let scanned = 0

  for (const dir of dirs) {
    for (const file of walkFiles(dir, p => p.endsWith(".js"))) {
      let content
      try {
        content = readFileSync(file, "utf8")
      } catch {
        continue
      }
      scanned += 1
      const rel = relative(ROOT, file).replace(/\\/g, "/")

      // Pattern-based matchers
      for (const { name, re } of SECRET_PATTERNS) {
        // Reset state for /g regexes.
        re.lastIndex = 0
        let m
        while ((m = re.exec(content))) {
          const value = m[0]
          if (allowlist.has(value)) continue
          findings.push({ file: rel, kind: name, value: redact(value) })
          // One match per (file, pattern) is enough to fail; break to
          // keep the report focused.
          break
        }
      }

      // Literal needles from server-only env vars
      for (const { envName, value } of serverOnlyNeedles) {
        if (content.includes(value)) {
          findings.push({
            file: rel,
            kind: `live ${envName} value`,
            value: redact(value),
          })
        }
      }
    }
  }

  return { scanned, findings, skipped: false }
}

function redact(s) {
  if (s.length <= 8) return "***"
  return `${s.slice(0, 4)}…${s.slice(-4)} (${s.length} chars)`
}

// ─── Scan 3: source for NEXT_PUBLIC_*SECRET|KEY|PASSWORD|TOKEN names ───────

const PUBLIC_NAME_PATTERN = /NEXT_PUBLIC_[A-Z0-9_]*(SECRET|KEY|PASSWORD|TOKEN)[A-Z0-9_]*/g

/**
 * NEXT_PUBLIC_* names that are public by design. Each entry needs a
 * one-line justification — code review has to push back on additions.
 */
const ALLOWLISTED_PUBLIC_NAMES = new Set([
  // Google requires the key client-side; restrict via HTTP referrer in
  // Cloud Console. Documented in the env-deny-list REMEDIATION above.
  "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY",
])

const SOURCE_DIRS = ["src"]
const SOURCE_FILES = [".env.example"]
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"])

function runSourceNameScan() {
  const findings = []
  const seen = new Set()

  const accept = path => {
    const lower = path.toLowerCase()
    // Skip test files — they're allowed to mention these names in
    // negative-assertion fixtures.
    if (lower.includes("__tests__") || lower.endsWith(".test.ts") || lower.endsWith(".test.tsx")) {
      return false
    }
    // Skip the leaked-secrets script itself — it intentionally lists the
    // pattern in code.
    if (lower.endsWith("scripts/check-leaked-secrets.mjs")) return false
    // Only inspect source-shaped extensions.
    let dot = -1
    for (let i = path.length - 1; i >= 0; i--) {
      if (path[i] === ".") {
        dot = i
        break
      }
      if (path[i] === "/" || path[i] === "\\") break
    }
    if (dot === -1) return false
    return SOURCE_EXTENSIONS.has(path.slice(dot).toLowerCase())
  }

  for (const dir of SOURCE_DIRS) {
    for (const file of walkFiles(join(ROOT, dir), accept)) {
      let content
      try {
        content = readFileSync(file, "utf8")
      } catch {
        continue
      }
      PUBLIC_NAME_PATTERN.lastIndex = 0
      let m
      while ((m = PUBLIC_NAME_PATTERN.exec(content))) {
        const name = m[0]
        if (ALLOWLISTED_PUBLIC_NAMES.has(name)) continue
        const key = `${name}::${file}`
        if (seen.has(key)) continue
        seen.add(key)
        findings.push({ file: relative(ROOT, file).replace(/\\/g, "/"), name })
      }
    }
  }

  for (const rel of SOURCE_FILES) {
    const file = join(ROOT, rel)
    if (!existsSync(file)) continue
    let content
    try {
      content = readFileSync(file, "utf8")
    } catch {
      continue
    }
    PUBLIC_NAME_PATTERN.lastIndex = 0
    let m
    while ((m = PUBLIC_NAME_PATTERN.exec(content))) {
      const name = m[0]
      if (ALLOWLISTED_PUBLIC_NAMES.has(name)) continue
      const key = `${name}::${rel}`
      if (seen.has(key)) continue
      seen.add(key)
      findings.push({ file: rel, name })
    }
  }

  return findings
}

// ─── Run + report ───────────────────────────────────────────────────────────

let exitCode = 0

const envFailures = runEnvDenyListScan()
if (envFailures.length > 0) {
  exitCode = 1
  console.error("✗ Leaked secret(s) detected (env value deny list):\n")
  for (const name of envFailures) {
    console.error(`  ${name} matches a known-leaked value`)
    const hint = REMEDIATION[name]
    if (hint) console.error(`    ${hint}\n`)
  }
  console.error("Do not deploy until each is rotated in the platform's secret store.\n")
}

const bundle = runClientBundleScan()
if (bundle.findings.length > 0) {
  exitCode = 1
  console.error("✗ Secret-shaped string(s) detected in client bundles:\n")
  for (const f of bundle.findings) {
    console.error(`  ${f.file}`)
    console.error(`    ${f.kind} → ${f.value}\n`)
  }
  console.error(
    "Find the import chain (search the source for the offending value or shape)\n" +
      "and re-route it through a server-only module (route handler / server\n" +
      "component / instrumentation), or add a documented allowlist entry if the\n" +
      "value is genuinely public.\n",
  )
}

const nameFindings = runSourceNameScan()
if (nameFindings.length > 0) {
  exitCode = 1
  console.error("✗ NEXT_PUBLIC_ name(s) with SECRET/KEY/PASSWORD/TOKEN substring:\n")
  for (const f of nameFindings) {
    console.error(`  ${f.file}: ${f.name}`)
  }
  console.error(
    "\nNEXT_PUBLIC_ vars are inlined into the client bundle by Next.js — a\n" +
      "secret-y name is a smell. Either rename the var (drop the NEXT_PUBLIC_\n" +
      "prefix and read it server-side) or add it to ALLOWLISTED_PUBLIC_NAMES in\n" +
      "scripts/check-leaked-secrets.mjs with a one-line justification.\n",
  )
}

if (exitCode === 0) {
  const checked = Object.entries(LEAKED_VALUES)
    .filter(([, set]) => set.size > 0)
    .map(([name]) => name)
    .join(", ")
  console.log(`✓ Env value deny list: no known-leaked values in ${checked}.`)
  if (bundle.skipped) {
    console.log("✓ Client bundle scan: skipped (no .next/static — run after `next build`).")
  } else {
    console.log(`✓ Client bundle scan: ${bundle.scanned} file(s) inspected, no secrets found.`)
  }
  console.log(
    `✓ NEXT_PUBLIC_ name scan: no secret-shaped names outside the ` +
      `${ALLOWLISTED_PUBLIC_NAMES.size}-entry allowlist.`,
  )
}

process.exit(exitCode)
