#!/usr/bin/env node
/**
 * CI guard: refuse a PR that arms the runtime-codegen flag in any env
 * file checked into the repo.
 *
 * The flag `APP_ALLOW_RUNTIME_CODEGEN=true` lets every admin overwrite
 * source files at runtime. The instrumentation safeguard already refuses
 * to start a production process with this combo, but a tracked env file
 * is the wrong place to set it AT ALL — secrets belong in the deploy
 * platform's secret store. This script catches an accidental commit
 * before it lands.
 *
 * Specifically blocks the dangerous combo:
 *   APP_ALLOW_RUNTIME_CODEGEN=true
 *   APP_ALLOW_RUNTIME_CODEGEN_PROD_OVERRIDE=i-understand-the-risks
 *
 * If both appear together in the same checked-in env file, the CI fails.
 * Either var on its own also fails, with a clearer message — the spec
 * calls out the combo specifically because that defeats the production
 * safeguard, but a checked-in single-var is still a smell worth blocking.
 *
 * Scope: every `.env*` file tracked by git (not local-only `.env`s, which
 * are gitignored and never reach a PR). Run as part of `npm run quality`.
 *
 * Deploy-server behavior: atomic-release pipelines deliver the build as a
 * tar/rsync artifact into a directory with NO `.git`. The "is anything
 * tracked?" question is meaningless there — nothing can be committed from
 * a detached artifact — so this guard is purely a PR/CI concern. When run
 * outside a git work tree we print a skip line and exit 0, mirroring the
 * "skipped" convention in scripts/check-leaked-secrets.mjs (which no-ops
 * when `.next/static` is absent). git not being installed at all is
 * treated the same way: same "no git ⇒ nothing to check" semantics.
 */

import { readFileSync, existsSync } from "node:fs"
import { execSync } from "node:child_process"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, "..")

const FLAG = "APP_ALLOW_RUNTIME_CODEGEN"
const OVERRIDE = "APP_ALLOW_RUNTIME_CODEGEN_PROD_OVERRIDE"
const OVERRIDE_TOKEN = "i-understand-the-risks"

function isInsideGitWorkTree() {
  try {
    const stdout = execSync("git rev-parse --is-inside-work-tree", {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
    return stdout.trim() === "true"
  } catch {
    // Two collapsed cases: git is not installed (ENOENT), or git is
    // installed but ROOT is not a work tree (non-zero exit). Either way
    // there is nothing tracked to inspect.
    return false
  }
}

function listTrackedEnvFiles() {
  // Use `git ls-files` so we only inspect files that would actually land
  // in a PR. Local untracked .env files are out of scope (they can't
  // reach CI through a commit).
  let stdout
  try {
    stdout = execSync("git ls-files", { cwd: ROOT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 })
  } catch (err) {
    console.error("✗ check-codegen-flag: failed to enumerate tracked files via `git ls-files`:", err.message)
    process.exit(1)
  }
  return stdout
    .split(/\r?\n/)
    .filter(line => /(^|\/)\.env(\..+)?$/.test(line))
    .map(rel => resolve(ROOT, rel))
}

function parseEnv(filePath) {
  if (!existsSync(filePath)) return new Map()
  const map = new Map()
  const raw = readFileSync(filePath, "utf8")
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    map.set(key, value)
  }
  return map
}

function inspect(filePath) {
  const env = parseEnv(filePath)
  const flagSet = env.get(FLAG) === "true"
  const overrideSet = env.get(OVERRIDE) === OVERRIDE_TOKEN
  return { flagSet, overrideSet }
}

if (!isInsideGitWorkTree()) {
  console.log(
    "✓ check-codegen-flag: skipped (not a git repository — atomic-release " +
      "artifact has no .git; this guard runs at PR/CI time).",
  )
  process.exit(0)
}

const tracked = listTrackedEnvFiles()
const violations = []

for (const file of tracked) {
  const { flagSet, overrideSet } = inspect(file)
  const rel = file.slice(ROOT.length + 1).replace(/\\/g, "/")

  if (flagSet && overrideSet) {
    violations.push({
      file: rel,
      level: "fatal",
      message:
        `Arms the runtime-codegen flag AND its production override. ` +
        `This combination defeats the startup safeguard — admins gain ` +
        `arbitrary file-write inside the safe-path allowlist.`,
    })
  } else if (flagSet) {
    violations.push({
      file: rel,
      level: "fatal",
      message:
        `Sets ${FLAG}=true. Tracked env files MUST NOT enable runtime ` +
        `codegen — set the var via the deploy platform's secret store ` +
        `(local-only) when needed for development.`,
    })
  } else if (overrideSet) {
    violations.push({
      file: rel,
      level: "fatal",
      message:
        `Sets the production override token. Tracked env files MUST NOT ` +
        `pre-arm the override — it exists only as a deliberate, ` +
        `out-of-band signal at deploy time.`,
    })
  }
}

if (violations.length > 0) {
  console.error("✗ Runtime-codegen flag check failed:\n")
  for (const v of violations) {
    console.error(`  ${v.file}`)
    console.error(`    ${v.message}\n`)
  }
  console.error("Remove the offending lines (or move the var to the deploy platform's secret store) and re-commit.\n")
  process.exit(1)
}

console.log(`✓ No tracked env file arms ${FLAG} or ${OVERRIDE} (${tracked.length} file(s) scanned).`)
