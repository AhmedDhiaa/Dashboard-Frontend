#!/usr/bin/env node
/**
 * CI guard: fail if package.json declares a prerelease dependency that
 * isn't on the explicit allowlist.
 *
 * Background:
 *
 *   `next-auth: 5.0.0-beta.30` slipped into the codebase without scrutiny
 *   and shipped to production for months. Beta releases ship breaking
 *   changes between revisions; a silent caret-range bump can rewire auth
 *   internals overnight. Once was a lesson, twice would be negligence.
 *
 *   The default policy is no prereleases. Exceptions exist (e.g. a v2 RC
 *   we want early access to) but require sign-off — adding an entry to
 *   scripts/prerelease-deps-allowlist.json with a real reason and approver,
 *   reviewed in the PR diff.
 *
 * What counts as "prerelease":
 *
 *   Semver appends `-{tag}.{n}` for prereleases. We catch the common tags:
 *   alpha, beta, rc, pre, canary, next, experimental, insiders, nightly.
 *   The match is anchored at `-` to avoid false positives on package names
 *   that contain those substrings (e.g. version `1.0.0` of a package named
 *   `react-beta-helper` is fine).
 *
 * What doesn't count:
 *
 *   Non-semver version specifiers (`git+https://…`, `file:…`, `link:…`,
 *   `*`, `latest`, GitHub shorthand, workspace protocols) are skipped.
 *   They're a separate concern handled by other tooling if needed.
 */

import { readFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, "..")
const PKG_PATH = resolve(ROOT, "package.json")
const ALLOWLIST_PATH = resolve(__dirname, "prerelease-deps-allowlist.json")

const PRERELEASE_TAGS = ["alpha", "beta", "rc", "pre", "canary", "next", "experimental", "insiders", "nightly"]
const PRERELEASE_RE = new RegExp(`-(${PRERELEASE_TAGS.join("|")})(?:\\b|\\.)`, "i")

// Strip caret/tilde/operator prefix so we compare the bare version.
const VERSION_RE = /^[\^~>=<]*\s*([0-9]+\.[0-9]+\.[0-9]+\S*)/

function loadJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"))
  } catch (err) {
    console.error(`✗ Failed to read ${path}:`, err.message)
    process.exit(1)
  }
}

const pkg = loadJson(PKG_PATH)
const allowlistFile = loadJson(ALLOWLIST_PATH)
const approved = new Map()
for (const entry of allowlistFile.approved ?? []) {
  approved.set(entry.package, entry)
}

function checkSection(sectionName, deps) {
  const violations = []
  for (const [name, range] of Object.entries(deps ?? {})) {
    const m = range.match(VERSION_RE)
    if (!m) continue // non-semver specifier — out of scope

    const version = m[1]
    if (!PRERELEASE_RE.test(version)) continue

    const approval = approved.get(name)
    if (!approval) {
      violations.push({ section: sectionName, name, version, range, reason: "not in allowlist" })
      continue
    }
    if (approval.version !== version) {
      violations.push({
        section: sectionName,
        name,
        version,
        range,
        reason: `allowlist approves ${approval.version}, package.json has ${version}`,
      })
    }
  }
  return violations
}

const violations = [
  ...checkSection("dependencies", pkg.dependencies),
  ...checkSection("devDependencies", pkg.devDependencies),
]

// ─── Drain check: allowlist entries that no longer match a real prerelease ──

const drainable = []
for (const entry of allowlistFile.approved ?? []) {
  const range = pkg.dependencies?.[entry.package] ?? pkg.devDependencies?.[entry.package]
  if (!range) {
    drainable.push({ entry, why: "not in package.json" })
    continue
  }
  const m = range.match(VERSION_RE)
  if (!m || !PRERELEASE_RE.test(m[1])) {
    drainable.push({ entry, why: `${entry.package} is now ${m?.[1] ?? range} (stable)` })
  }
}

// ─── Report ─────────────────────────────────────────────────────────────────

if (violations.length === 0 && drainable.length === 0) {
  console.log("✓ No unapproved prerelease dependencies.")
  process.exit(0)
}

if (violations.length > 0) {
  console.error("✗ Prerelease dependencies missing or stale on the allowlist:\n")
  for (const v of violations) {
    console.error(`    ${v.section}: ${v.name}@${v.version}  (${v.reason})`)
  }
  console.error(
    "\n  Either remove the prerelease (preferred) or add a justified entry to\n" +
      "  scripts/prerelease-deps-allowlist.json. Sign-off = the PR diff. The\n" +
      "  reason field should explain why a stable release isn't acceptable\n" +
      "  AND name a rollback path.\n",
  )
}

if (drainable.length > 0) {
  console.log("↓ Allowlist entries to remove (the package is no longer a prerelease):\n")
  for (const d of drainable) {
    console.log(`    ${d.entry.package}@${d.entry.version}  — ${d.why}`)
  }
  console.log()
}

process.exit(violations.length > 0 ? 1 : 0)
