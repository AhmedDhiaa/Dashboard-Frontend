#!/usr/bin/env node
/**
 * CI guard: fails if next-auth has drifted from the locked beta revision.
 *
 * Why we pin (and why this guard exists):
 *
 *   next-auth v5 is in beta — there is no `latest` tag and no LTS commitment
 *   from the maintainers. Beta releases ship breaking changes between `.x`
 *   revisions (the auth surface area, JWT/session callback signatures, and
 *   provider configs have all moved between betas in the past). A silent bump
 *   via `npm install next-auth` (caret range) can therefore break auth in
 *   production with no review. We pin the exact revision and force any
 *   upgrade to be a deliberate PR that updates `EXPECTED` in lockstep.
 *
 *   This is the minimum viable defense until v5 ships stable. When `latest`
 *   on npm advances to a non-beta v5 release, replace this script with a
 *   normal caret range and delete the guard step from the CI workflow.
 *
 * To upgrade intentionally:
 *
 *   1. Read the next-auth release notes between the current pin and the
 *      target version: https://github.com/nextauthjs/next-auth/releases
 *   2. Update `EXPECTED` below to the target version.
 *   3. Update package.json (exact, no caret) and run `npm install` to
 *      refresh package-lock.json.
 *   4. Run the affected paths locally: login, logout, session refresh,
 *      cross-tab sync, the axios interceptor's 401 handling.
 *   5. Reference the changelog summary in the PR description.
 */

import { readFileSync } from "node:fs"

const EXPECTED = "5.0.0-beta.30"

const pkg = JSON.parse(readFileSync("package.json", "utf8"))
const lock = JSON.parse(readFileSync("package-lock.json", "utf8"))

const declared = pkg.dependencies?.["next-auth"]
const installed = lock.packages?.["node_modules/next-auth"]?.version

const errors = []
if (declared !== EXPECTED) {
  errors.push(`package.json declares next-auth=${JSON.stringify(declared)}, expected exact ${JSON.stringify(EXPECTED)}`)
}
if (installed !== EXPECTED) {
  errors.push(`package-lock.json resolves next-auth=${JSON.stringify(installed)}, expected ${JSON.stringify(EXPECTED)}`)
}

if (errors.length) {
  console.error("\n✗ next-auth pin guard failed:")
  for (const e of errors) console.error(`    - ${e}`)
  console.error(
    "\nIf this bump is intentional, update EXPECTED in scripts/check-next-auth-pin.mjs",
  )
  console.error("and reference the upgrade rationale in the PR description.\n")
  process.exit(1)
}

console.log(`✓ next-auth pinned to ${EXPECTED} (package.json + lockfile match)`)
