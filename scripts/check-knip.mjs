#!/usr/bin/env node
/**
 * CI guard: enforce a per-category cap on dead-code findings.
 *
 * Why caps, not zero:
 *   The first run had 84 unused files, 172 unused exports, 160 unused
 *   exported types — too much to fix in a single sprint. The pattern that
 *   does work is the same one `architecture-baseline.json` uses: snapshot
 *   today's counts as a ceiling, then apply natural pressure — every PR
 *   has to fix at least as much dead code as it introduces. As the team
 *   drains the backlog the caps drop, ratcheting downward toward zero.
 *
 * What this script does:
 *   1. Runs `knip --reporter json` and aggregates issues by category.
 *   2. Reads `scripts/knip-baseline.json` and compares per category.
 *   3. Fails (exit 1) on any category that exceeds its cap.
 *   4. Reports which categories shrank — drain candidates the team should
 *      lower the cap for in their PR (manual step; the script doesn't
 *      auto-edit the baseline because someone needs to confirm the drop
 *      reflects a real fix, not a misconfigured `entry`/`ignore` pattern).
 *
 * Categories tracked:
 *   files | exports | types | duplicates
 *   dependencies | devDependencies | unlisted | binaries
 *
 * Run this after a real `knip` install — `npm run check:dead-code`.
 */

import { execSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const BASELINE_PATH = resolve(__dirname, "knip-baseline.json")
const ROOT = resolve(__dirname, "..")

function aggregate(issues) {
  const counts = {
    files: 0,
    exports: 0,
    types: 0,
    duplicates: 0,
    dependencies: 0,
    devDependencies: 0,
    unlisted: 0,
    binaries: 0,
  }
  for (const issue of issues ?? []) {
    counts.files += (issue.files ?? []).length
    counts.exports += (issue.exports ?? []).length
    counts.types += (issue.types ?? []).length
    counts.duplicates += (issue.duplicates ?? []).length
    counts.dependencies += (issue.dependencies ?? []).length
    counts.devDependencies += (issue.devDependencies ?? []).length
    counts.unlisted += (issue.unlisted ?? []).length
    counts.binaries += (issue.binaries ?? []).length
  }
  return counts
}

function pad(s, n) {
  return String(s).padStart(n)
}

// ─── Run knip ────────────────────────────────────────────────────────────────

let raw
try {
  // Knip exits non-zero when issues exist — that's how it normally works,
  // we don't want it to abort our script.
  raw = execSync("npx knip --reporter json --no-progress", {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "ignore"],
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  })
} catch (err) {
  // Knip's exit code 1 = "issues found"; stdout still contains the report.
  if (err.stdout) raw = err.stdout
  else {
    console.error("✗ knip failed to run:", err.message)
    process.exit(1)
  }
}

let parsed
try {
  parsed = JSON.parse(raw)
} catch (e) {
  console.error("✗ Failed to parse knip JSON output:", e.message)
  console.error("First 500 chars of output:", raw.slice(0, 500))
  process.exit(1)
}

const current = aggregate(parsed.issues)

// ─── Read baseline ───────────────────────────────────────────────────────────

let baseline
try {
  const baselineRaw = JSON.parse(readFileSync(BASELINE_PATH, "utf8"))
  // Strip the _policy comment field
  baseline = { ...baselineRaw }
  delete baseline._policy
} catch (err) {
  console.error(`✗ Failed to read baseline at ${BASELINE_PATH}:`, err.message)
  process.exit(1)
}

// ─── Compare ─────────────────────────────────────────────────────────────────

const violations = []
const drainable = []
const categories = Object.keys(current).sort()

for (const cat of categories) {
  const cap = baseline[cat] ?? 0
  const actual = current[cat]
  if (actual > cap) violations.push({ cat, cap, actual })
  if (actual < cap) drainable.push({ cat, cap, actual })
}

// ─── Report ──────────────────────────────────────────────────────────────────

console.log("\nDead-code findings (knip):\n")
console.log(`  ${pad("Category", 16)} ${pad("Current", 8)} ${pad("Cap", 8)}  Status`)
console.log("  " + "-".repeat(48))
for (const cat of categories) {
  const cap = baseline[cat] ?? 0
  const actual = current[cat]
  const status =
    actual > cap ? "✗ OVER CAP" : actual < cap ? `↓ drain by ${cap - actual}` : "= match"
  console.log(`  ${pad(cat, 16)} ${pad(actual, 8)} ${pad(cap, 8)}  ${status}`)
}
console.log()

if (violations.length > 0) {
  console.error("✗ Dead-code budget exceeded:")
  for (const v of violations) {
    console.error(`    ${v.cat}: ${v.actual} > cap ${v.cap} (+${v.actual - v.cap})`)
  }
  console.error(
    "\n  This PR added new unused code. Either remove it, or — if it's a\n" +
      "  legitimate entry point knip can't infer (e.g., a new instrumentation\n" +
      "  hook) — extend `knip.json`'s `entry`/`ignore` config rather than\n" +
      "  raising the cap.\n",
  )
  process.exit(1)
}

if (drainable.length > 0) {
  console.log("↓ Cap headroom available — lower these in scripts/knip-baseline.json:")
  for (const d of drainable) {
    console.log(`    ${d.cat}: cap ${d.cap} → ${d.actual}`)
  }
  console.log()
}

console.log("✓ Within dead-code budget.")
