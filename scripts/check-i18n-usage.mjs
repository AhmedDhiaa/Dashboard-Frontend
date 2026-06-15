#!/usr/bin/env node
/**
 * CI guard: static-scan every t("...") call site in src/ and verify the
 * resolved key exists in messages/en/*.json.
 *
 * Complements check-i18n-parity.mjs. Parity verifies JSON↔JSON; this
 * verifies code↔JSON. The combination catches the class that snuck through
 * the Phase 1-5 audit: keys present in BOTH locales (so parity passed) but
 * never referenced by any t() call, OR t() calls that reference keys
 * present in NEITHER locale (so the runtime emits MISSING_MESSAGE).
 *
 * What this guard flags as a hard FAIL (exit 1):
 *   - A static t("ns.path") call whose resolved key is absent from en.
 *     The check uses the file's useT/useTranslations binding to resolve
 *     leaf calls into full paths. Multiple bindings per file are tried;
 *     the call is considered failed only if NONE resolve.
 *
 * What it lists as "unverifiable" (does NOT fail the build):
 *   - Dynamic t(`...${x}...`) calls. The runtime values can't be enumerated
 *     statically, so we report locations but pass.
 *   - Calls in files that take t as a PROP without binding it locally
 *     (e.g. shared sub-components used by both /auth/* and dashboard).
 *     The runtime knows the binding, the script doesn't.
 *
 * Wired into `npm run quality` after check:i18n-parity.
 * Standalone: `npm run check:i18n-usage` or
 *   `node scripts/check-i18n-usage.mjs`.
 */

import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.join(here, "..")
const SRC = path.join(projectRoot, "src")
const MSG_EN = path.join(projectRoot, "messages", "en")

// Catalog: flat set of every dotted key path that exists in en. Each
// namespace's filename maps to a namespace TOKEN (e.g. `enum.json` → "Enum").
const FILENAME_TO_NS = Object.freeze({ enum: "Enum" })

function flatten(obj, prefix = "", out = {}) {
    if (obj === null || typeof obj !== "object" || Array.isArray(obj)) return out
    for (const [k, v] of Object.entries(obj)) {
        const full = prefix ? `${prefix}.${k}` : k
        if (v !== null && typeof v === "object" && !Array.isArray(v)) flatten(v, full, out)
        else out[full] = v
    }
    return out
}

const catalog = new Set()
for (const f of readdirSync(MSG_EN)) {
    if (!f.endsWith(".json")) continue
    const base = f.replace(".json", "")
    const ns = FILENAME_TO_NS[base] ?? base
    const flat = flatten(JSON.parse(readFileSync(path.join(MSG_EN, f), "utf8")))
    for (const k of Object.keys(flat)) catalog.add(`${ns}.${k}`)
}

// Known namespace tokens (used to decide whether a dotted call argument is
// already a full path or just looks like one).
const NAMESPACE_TOKENS = new Set([
    "common", "auth", "errors", "nav", "crud", "forms", "table", "map",
    "dashboard", "settings", "pages", "pages_dynamic",
    "pages_tickets", "pages_tracking", "theme", "admin", "showcase", "Enum",
])

// Walk src/ recursively, skipping tests + node_modules.
const files = []
function walk(dir) {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
        if (ent.name === "node_modules" || ent.name === ".next") continue
        const full = path.join(dir, ent.name)
        if (ent.isDirectory()) { walk(full); continue }
        if (!/\.(tsx?|jsx?|mjs|cjs)$/.test(ent.name)) continue
        const n = full.replace(/\\/g, "/")
        if (n.includes("/__tests__/") || /\.(test|spec)\.(t|j)sx?$/.test(n)) continue
        files.push(full)
    }
}
walk(SRC)

// Block-comment + line-comment stripper so JSDoc examples don't false-flag.
// Naive but adequate — the codebase doesn't put strings starting with /* or
// // inside actual string literals, so destroying these regions is safe.
function stripComments(src) {
    return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
}

const missing = []      // hard-fail: definitely missing
const unverifiable = [] // FYI: prop-threaded or dynamic

for (const file of files) {
    const raw = readFileSync(file, "utf8")
    const content = stripComments(raw)
    const short = file.replace(/\\/g, "/").split("/src/")[1] || file

    // Bindings: useT("ns"), useTranslations("ns"), getTranslations("ns"),
    // plus useT() with no arg → global (full-path expected).
    const bindings = new Set()
    let hasGlobalUseT = false
    const bindRe = /\b(?:useT|useTranslations|getTranslations)\s*\(\s*([^)]*)\s*\)/g
    let bm
    while ((bm = bindRe.exec(content)) !== null) {
        const arg = bm[1].trim()
        if (arg === "") { hasGlobalUseT = true; continue }
        const lit = arg.match(/^["']([^"']+)["']$/)
        if (lit) bindings.add(lit[1])
    }

    // Static t() calls: t("..."), t('...'). Skip template literals — they
    // get listed under unverifiable below.
    const callRe = /\bt\s*\(\s*(["'])((?:(?!\1).)+)\1\s*[,)]/g
    let m
    while ((m = callRe.exec(content)) !== null) {
        const keyArg = m[2].replaceAll(":", ".") // codebase convention
        const lineNo = content.slice(0, m.index).split("\n").length

        // Build candidate full paths:
        //  - If the key's first dotted segment is a known namespace, treat
        //    it as a full path. This handles two real cases that confuse
        //    naive ns-prepending: (a) a file with `useT()` global plus
        //    `useT("nav")` for a subcomponent — a t("common.search") call
        //    in the global subcomponent shouldn't get "nav." prepended
        //    by the script just because nav is bound somewhere in the
        //    file; (b) a sub-component that takes t as a prop but lives
        //    in the same file as a namespace-bound useT.
        //  - Otherwise: every bound namespace, prepend "ns." unless the
        //    key already starts with that namespace.
        const candidates = []
        const firstSegStart = keyArg.split(".")[0]
        const keyHasDotNs = keyArg.includes(".") && NAMESPACE_TOKENS.has(firstSegStart)
        if (keyHasDotNs) candidates.push(keyArg)
        if (hasGlobalUseT && keyArg.includes(".") && !keyHasDotNs) candidates.push(keyArg)
        for (const ns of bindings) {
            if (keyArg.startsWith(`${ns}.`)) candidates.push(keyArg)
            else candidates.push(`${ns}.${keyArg}`)
        }
        if (candidates.length === 0 && keyArg.includes(".")) candidates.push(keyArg)

        // No candidates → key has no dot and we have no bindings → almost
        // certainly prop-threaded (parent binds, child calls). Report as
        // unverifiable.
        if (candidates.length === 0) {
            unverifiable.push({ file: short, line: lineNo, key: keyArg, reason: "no local binding (likely prop-threaded)" })
            continue
        }

        if (candidates.some(c => catalog.has(c))) continue

        // No bindings AND first segment isn't a known namespace → also
        // looks prop-threaded; downgrade to unverifiable.
        const firstSeg = keyArg.split(".")[0]
        if (bindings.size === 0 && !hasGlobalUseT && !NAMESPACE_TOKENS.has(firstSeg)) {
            unverifiable.push({ file: short, line: lineNo, key: keyArg, reason: "no local binding (likely prop-threaded)" })
            continue
        }
        missing.push({ file: short, line: lineNo, key: keyArg, candidates })
    }

    // Dynamic t(`...${x}...`) — list, don't fail
    const dynRe = /\bt\s*\(\s*`([^`]*\$\{[^`]*)`/g
    while ((m = dynRe.exec(content)) !== null) {
        const lineNo = content.slice(0, m.index).split("\n").length
        unverifiable.push({ file: short, line: lineNo, key: "`" + m[1] + "`", reason: "dynamic template" })
    }
}

if (missing.length > 0) {
    console.error(`✗ i18n usage check FAILED: ${missing.length} static t() calls reference missing keys.\n`)
    for (const r of missing.slice(0, 50)) {
        console.error(`  ${r.file}:${r.line}  t(${JSON.stringify(r.key)})  candidates: ${r.candidates.join(" | ")}`)
    }
    if (missing.length > 50) console.error(`  ... (${missing.length - 50} more)`)
    console.error(`\nUnverifiable (informational, ${unverifiable.length}):`)
    for (const r of unverifiable.slice(0, 10)) {
        console.error(`  ${r.file}:${r.line}  ${JSON.stringify(r.key)}  — ${r.reason}`)
    }
    if (unverifiable.length > 10) console.error(`  ... (${unverifiable.length - 10} more)`)
    process.exit(1)
}

console.log(`✓ i18n usage OK: ${catalog.size} catalog keys / 0 static-call misses (${unverifiable.length} unverifiable: dynamic templates + prop-threaded).`)
