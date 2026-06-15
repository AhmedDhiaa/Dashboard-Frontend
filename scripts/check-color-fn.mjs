#!/usr/bin/env node
/**
 * Color-function-over-OKLCH-token guardrail.
 *
 * The design tokens in globals.css hold full OKLCH color values
 * (e.g. `--primary: oklch(0.52 0.14 220)`). Wrapping one in a legacy color
 * function — `hsl(var(--primary))`, `rgba(var(--border) / 0.5)`, etc. — is
 * INVALID CSS: `hsl(oklch(...))` does not parse and silently resolves to
 * transparent / the initial value. The whole sticky-table-column,
 * map-controls, and chart color bugs were exactly this mistake.
 *
 * Correct forms:
 *   - opaque:      var(--primary)
 *   - with alpha:  color-mix(in oklch, var(--primary) 50%, transparent)
 *                  oklch(from var(--primary) l c h / 0.5)
 *
 * This check fails `npm run quality` if any `hsl|hsla|rgb|rgba(... var(--...`
 * appears in src/. Scans .css/.ts/.tsx/.js/.mjs.
 */

import { readFileSync, readdirSync, statSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const SRC = join(ROOT, "src")
const EXTS = new Set([".css", ".ts", ".tsx", ".js", ".mjs", ".jsx"])
// hsl/hsla/rgb/rgba ( ... var(-- ...  — any legacy color fn wrapping a token var
const FORBIDDEN = /\b(hsl|hsla|rgb|rgba)\(\s*var\(\s*--/i

/** @param {string} dir @param {string[]} out */
function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, out)
    else if (EXTS.has(name.slice(name.lastIndexOf(".")))) out.push(full)
  }
}

const files = []
walk(SRC, files)

const hits = []
for (const file of files) {
  const lines = readFileSync(file, "utf8").split(/\r?\n/)
  lines.forEach((line, i) => {
    if (FORBIDDEN.test(line)) hits.push(`${relative(ROOT, file)}:${i + 1}  ${line.trim().slice(0, 100)}`)
  })
}

if (hits.length > 0) {
  console.error(`✗ color-fn check: ${hits.length} legacy color-function wrapping an OKLCH token var (invalid → transparent):`)
  for (const h of hits) console.error(`  ${h}`)
  console.error("\n  Fix: use `var(--token)` (opaque) or `color-mix(in oklch, var(--token) N%, transparent)` (alpha).")
  process.exit(1)
}

console.log(`✓ color-fn check: ${files.length} file(s) scanned, no hsl/rgb()-wrapped OKLCH token vars.`)
