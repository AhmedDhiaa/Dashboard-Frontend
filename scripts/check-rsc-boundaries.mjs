#!/usr/bin/env node
/**
 * CI guard: catch files that USE a client-only API (React hooks, custom
 * "use client" hooks, or known client-only npm packages) but are MISSING
 * the `"use client"` directive themselves.
 *
 * The bug class this prevents: a Server Component (or shared-agnostic file
 * imported by one) calls `useTheme()` or `useState()` and crashes at render
 * with "useTheme called from server" or similar. Caught manually in commit
 * 18b2d1b across 12 design-system primitives; this scanner makes the rule
 * structural so the next regression fails CI instead of the dev console.
 *
 * What this flags as a hard FAIL (exit 1):
 *   A file in the inclusion list that calls any built-in React hook, calls
 *   any indexed CLIENT_HOOK (a `useFoo` exported from a "use client" file
 *   elsewhere in src/), or imports a curated client-only package — WITHOUT
 *   the `"use client"` directive.
 *
 * Non-goals (kept narrow so the scanner doesn't over-reach):
 *   - One level of indirection only. A → B is checked; A → B → client-hook
 *     is not. Catches the common bug; passes on legitimately-server-safe
 *     compositions that only fail at runtime under deeper trees.
 *   - No browser-global detection (window, document, navigator). Those
 *     crash differently and are tracked elsewhere if at all.
 *   - No node_modules hook detection beyond the curated client-only-package
 *     list. New third-party client libs need to be added by hand.
 *   - Not a replacement for Next.js's own RSC checker. This is a fast
 *     pre-build static guard.
 *
 * Edge cases handled:
 *   - Leading UTF-8 BOM is stripped before the "use client" detection.
 *   - Both `"use client"` and `'use client'` accepted, with or without `;`.
 *   - Leading line/block comments + JSDoc allowed before the directive.
 *   - Type-only imports (`import type {`) are skipped — no runtime effect.
 *   - Re-exports (`export * from`, `export { useFoo } from`) are NOT flagged.
 *     The re-exporter is plumbing; the actual consumer is where the rule
 *     should apply. This avoids forcing barrel files into Client-only.
 *
 * Wired into `npm run quality` after check:i18n-usage.
 * Standalone: `npm run check:rsc-boundaries` or
 *   `node scripts/check-rsc-boundaries.mjs`.
 */

import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.join(here, "..")
const SRC = path.join(projectRoot, "src")

// ─── Constants ──────────────────────────────────────────────────────────────

const REACT_HOOKS = [
  "useState",
  "useEffect",
  "useContext",
  "useMemo",
  "useCallback",
  "useRef",
  "useReducer",
  "useLayoutEffect",
  "useImperativeHandle",
  "useDeferredValue",
  "useTransition",
  "useSyncExternalStore",
  "useId",
  "useInsertionEffect",
]

// Packages whose runtime exports require a client context. Type-only
// imports from these packages are still OK (caller handles that below).
const CLIENT_ONLY_PACKAGES = new Set([
  "cmdk",
  "framer-motion",
  "recharts",
  "next-themes",
  "next-intl/client",
])

// Files Next.js treats as routing — they have their own client/server rules
// (page.tsx and layout.tsx are server by default but freely opt in to "use
// client" at the top of the file).
const NEXT_ROUTING_FILENAMES = new Set([
  "page.tsx",
  "page.ts",
  "page.jsx",
  "page.js",
  "layout.tsx",
  "layout.ts",
  "layout.jsx",
  "layout.js",
  "error.tsx",
  "error.ts",
  "loading.tsx",
  "loading.ts",
  "not-found.tsx",
  "not-found.ts",
  "template.tsx",
  "template.ts",
  "default.tsx",
  "default.ts",
  "global-error.tsx",
  "global-error.ts",
  "route.ts",
  "route.tsx",
])

// ─── Helpers ────────────────────────────────────────────────────────────────

function stripBom(src) {
  return src.charCodeAt(0) === 0xfeff ? src.slice(1) : src
}

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
}

/**
 * Return true if the file has `"use client"` as the first non-comment,
 * non-blank line (BOM-tolerant). Both quote styles + optional `;` accepted.
 */
function hasUseClient(raw) {
  const noBom = stripBom(raw)
  const stripped = stripComments(noBom)
  // First non-blank line of the comment-stripped source.
  const firstLine = stripped.split("\n").map(l => l.trim()).find(l => l.length > 0)
  if (!firstLine) return false
  return /^["']use client["'];?\s*$/.test(firstLine)
}

function relPath(file) {
  return file.replace(/\\/g, "/").split("/src/")[1] || file
}

function isRoutingFile(file) {
  const base = path.basename(file)
  return NEXT_ROUTING_FILENAMES.has(base)
}

function isHookDefinitionFile(file) {
  // Hook-definition files: their callers fail, not the definitions
  // themselves. Three conventions exist in this codebase:
  //   - `useFoo.ts` / `useFoo.tsx` (single hook per file)
  //   - `*.hooks.ts` / `*.hooks.tsx` (multiple co-located hooks)
  //   - anything inside a `hooks/` directory
  const n = file.replace(/\\/g, "/")
  return (
    /\/use[A-Z][A-Za-z0-9]+\.tsx?$/.test(n) ||
    /\.hooks\.tsx?$/.test(n) ||
    /\/hooks\/[^/]+\.tsx?$/.test(n)
  )
}

function isTestFile(file) {
  const n = file.replace(/\\/g, "/")
  return n.includes("/__tests__/") || /\.(test|spec)\.(t|j)sx?$/.test(n)
}

/**
 * The inclusion list: src/ui|core|shared|features|domains|infra/**. Anything
 * under src/app/ is intentionally NOT scanned — Next.js routing files have
 * their own rules, and non-routing helpers under src/app/ are vanishingly
 * rare in this codebase.
 */
function isIncluded(file) {
  const n = file.replace(/\\/g, "/")
  return /\/src\/(ui|core|shared|features|domains|infra)\//.test(n)
}

function walk(dir, out = []) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === "node_modules" || ent.name === ".next") continue
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) {
      walk(full, out)
      continue
    }
    if (!/\.(tsx?|jsx?)$/.test(ent.name)) continue
    out.push(full)
  }
  return out
}

// ─── Phase 1: build the CLIENT_HOOKS index ──────────────────────────────────
//
// Walk every src/ file. For each one that starts with "use client", record
// every named export whose identifier matches /^use[A-Z]/. These are the
// codebase's own custom client-only hooks (useTheme, useT, etc.).

const allFiles = walk(SRC)
const clientHooks = new Map() // hookName → relative source path

const EXPORT_FN_RE = /\bexport\s+(?:default\s+)?(?:async\s+)?function\s+(use[A-Z][A-Za-z0-9]*)\b/g
const EXPORT_CONST_RE = /\bexport\s+(?:const|let|var)\s+(use[A-Z][A-Za-z0-9]*)\b/g
const EXPORT_NAMED_RE = /\bexport\s*\{([^}]+)\}/g

function indexClientHooks(file, raw) {
  const stripped = stripComments(stripBom(raw))
  const short = relPath(file)
  let m
  while ((m = EXPORT_FN_RE.exec(stripped)) !== null) {
    if (!clientHooks.has(m[1])) clientHooks.set(m[1], short)
  }
  while ((m = EXPORT_CONST_RE.exec(stripped)) !== null) {
    if (!clientHooks.has(m[1])) clientHooks.set(m[1], short)
  }
  while ((m = EXPORT_NAMED_RE.exec(stripped)) !== null) {
    // Inside `export { a, b as c }` — pick the LHS names that match the
    // hook shape. Skip the `as alias` half.
    for (const part of m[1].split(",")) {
      const name = part.trim().split(/\s+as\s+/)[0].trim()
      if (/^use[A-Z][A-Za-z0-9]*$/.test(name) && !clientHooks.has(name)) {
        clientHooks.set(name, short)
      }
    }
  }
}

for (const file of allFiles) {
  const raw = readFileSync(file, "utf8")
  if (!hasUseClient(raw)) continue
  indexClientHooks(file, raw)
}

// ─── Known-pending files (acknowledged, awaiting per-file decision) ────────
//
// Currently EMPTY — every violation the initial scan surfaced has been
// resolved. The map
// is intentionally kept (as `new Map([])`) so future deferrals can be
// added in one line without re-scaffolding the mechanism around it.
//
// Each entry shape: ["relative/path/from/src.tsx", "one-line reason"].
// Files listed here are reported as INFO (not a hard fail) so CI stays
// green while the user decides per-file. Two failure modes the script
// catches automatically:
//   - A non-listed file has violations → hard fail (the normal case).
//   - A listed file no longer has any violations → report and fail so
//     the obsolete entry gets removed (prevents the list from rotting).
const KNOWN_PENDING = new Map([])

// ─── Phase 2: scan candidate files for violations ───────────────────────────

const violations = []

const REACT_HOOK_CALL_RE = new RegExp(
  // Match either `useState(` or `React.useState(`.
  `(?:\\bReact\\.)?\\b(${REACT_HOOKS.join("|")})\\s*\\(`,
  "g",
)

function findImports(stripped) {
  // Capture every static import statement and return [{ pkg, isTypeOnly }].
  // The static-import grammar is narrow enough for a single regex; dynamic
  // imports (`import("...")`) are NOT considered — those are explicitly
  // client-runtime by their nature and don't trigger the bug class.
  const out = []
  const IMPORT_RE = /^\s*import\s+(.*?)\s+from\s+["']([^"']+)["']/gm
  let m
  while ((m = IMPORT_RE.exec(stripped)) !== null) {
    const clause = m[1]
    const pkg = m[2]
    const isTypeOnly = /^\s*type\b/.test(clause)
    out.push({ pkg, isTypeOnly })
  }
  return out
}

function isNpmPackageSpecifier(spec) {
  // NPM package specifiers start with a letter (`react`, `next-intl`) or
  // with `@scope/letter` (`@radix-ui/react-select`). Anything starting with
  // `.`, `/`, or `@/` is a relative or aliased path — not an npm package.
  if (spec.startsWith(".") || spec.startsWith("/") || spec.startsWith("@/")) return false
  return /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*(?:\/.*)?$/i.test(spec)
}

function findClientPackageImports(imports) {
  // Match exact entries from CLIENT_ONLY_PACKAGES OR any npm-package path
  // ending in `/client` (e.g. `@scope/x/client`). Relative / aliased paths
  // (`@/infra/api/client`) are excluded — `/client` is a common internal
  // folder name and doesn't imply client-only runtime.
  const hits = []
  for (const imp of imports) {
    if (imp.isTypeOnly) continue
    if (!isNpmPackageSpecifier(imp.pkg)) continue
    if (CLIENT_ONLY_PACKAGES.has(imp.pkg) || /\/client$/.test(imp.pkg)) {
      hits.push(imp.pkg)
    }
  }
  return hits
}

function findHookCalls(stripped) {
  // React built-in hooks: regex over the joined name list.
  const calls = new Set()
  let m
  REACT_HOOK_CALL_RE.lastIndex = 0
  while ((m = REACT_HOOK_CALL_RE.exec(stripped)) !== null) {
    calls.add({ name: m[1], index: m.index, source: "react" })
  }
  // Custom indexed hooks: one regex per hook (cheap, the set is bounded).
  for (const [hookName, sourceFile] of clientHooks) {
    const re = new RegExp(`\\b${hookName}\\s*\\(`, "g")
    let mm
    while ((mm = re.exec(stripped)) !== null) {
      calls.add({ name: hookName, index: mm.index, source: sourceFile })
    }
  }
  return calls
}

function lineOf(content, index) {
  return content.slice(0, index).split("\n").length
}

function findImportLine(content, pkg) {
  // Return the 1-based line number of the import statement that pulls `pkg`.
  // Used only for error reporting; first match is fine.
  const re = new RegExp(`^\\s*import\\b[^"']*["']${pkg.replace(/[.*+?^${}()|[\\\]\\\\]/g, "\\\\$&")}["']`, "m")
  const m = re.exec(content)
  if (!m) return 1
  return lineOf(content, m.index)
}

let scannedCount = 0

for (const file of allFiles) {
  if (!isIncluded(file)) continue
  if (isRoutingFile(file)) continue
  if (isTestFile(file)) continue
  if (isHookDefinitionFile(file)) continue
  const raw = readFileSync(file, "utf8")
  if (hasUseClient(raw)) continue
  scannedCount++

  const stripped = stripComments(stripBom(raw))
  const short = relPath(file)

  // Imports of client-only packages
  const imports = findImports(stripped)
  const pkgHits = findClientPackageImports(imports)
  for (const pkg of pkgHits) {
    violations.push({
      file: short,
      line: findImportLine(stripped, pkg),
      reason: `Imports ${pkg} — client-only package`,
    })
  }

  // Hook calls (React built-ins + custom indexed)
  const calls = findHookCalls(stripped)
  for (const call of calls) {
    const ln = lineOf(stripped, call.index)
    const why = call.source === "react"
      ? `Calls ${call.name}() — React hook requires a Client Component`
      : `Calls ${call.name}() — client-only hook exported from ${call.source}`
    violations.push({ file: short, line: ln, reason: why })
  }
}

// ─── Partition violations into hard-fail vs known-pending ──────────────────

const hardFail = []
const pending = []
const pendingFiles = new Set()
for (const v of violations) {
  if (KNOWN_PENDING.has(v.file)) {
    pending.push(v)
    pendingFiles.add(v.file)
  } else {
    hardFail.push(v)
  }
}

// Stale-entry check: a listed file with zero current violations means the
// entry is obsolete and the list has rotted. Fail so the next reader removes
// the entry instead of inheriting a wrong belief about pending work.
const staleEntries = [...KNOWN_PENDING.keys()].filter(f => !pendingFiles.has(f))

// ─── Output ─────────────────────────────────────────────────────────────────

const SLICE = process.env.RSC_FULL_REPORT === "1" ? Infinity : 50

if (hardFail.length > 0 || staleEntries.length > 0) {
  if (hardFail.length > 0) {
    console.error(`✗ rsc-boundaries check FAILED: ${hardFail.length} violation(s).`)
    console.error(`  ${scannedCount} candidate files scanned, ${clientHooks.size} client-only hooks indexed.\n`)
    hardFail.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)
    for (const v of hardFail.slice(0, SLICE)) {
      console.error(`  ${v.file}:${v.line}  ${v.reason}`)
    }
    if (hardFail.length > SLICE) {
      console.error(`  ... (${hardFail.length - SLICE} more — set RSC_FULL_REPORT=1 for the full list)`)
    }
    console.error(`\nFix: add \`"use client"\` as the first line of each flagged file.`)
  }
  if (staleEntries.length > 0) {
    console.error(
      `\n✗ KNOWN_PENDING has ${staleEntries.length} obsolete entr${staleEntries.length === 1 ? "y" : "ies"} (file fixed but still listed):`,
    )
    for (const f of staleEntries) console.error(`  ${f}`)
    console.error(`\nRemove the entr${staleEntries.length === 1 ? "y" : "ies"} from KNOWN_PENDING in scripts/check-rsc-boundaries.mjs.`)
  }
  process.exit(1)
}

if (pending.length > 0) {
  console.log(
    `✓ rsc-boundaries OK: ${scannedCount} files scanned, ${clientHooks.size} client-only hooks indexed, 0 new violations (${pending.length} known-pending across ${pendingFiles.size} file(s) — see KNOWN_PENDING in scripts/check-rsc-boundaries.mjs).`,
  )
} else {
  console.log(
    `✓ rsc-boundaries OK: ${scannedCount} files scanned, ${clientHooks.size} client-only hooks indexed, 0 violations.`,
  )
}
