#!/usr/bin/env node
/**
 * CI guard: assert every namespace under messages/{en,ar}/*.json holds the
 * IDENTICAL set of dotted key paths.
 *
 * The runtime catalog assumes en and ar have the same shape — a key missing
 * in one locale surfaces as a `MISSING_MESSAGE` warning at render time, and
 * the next-intl fallback renders the key path itself (e.g. "common.save")
 * instead of the translation. The bug is usually invisible in development
 * (the dev locale is English) and only shows when a customer ships in
 * Arabic. This guard catches the drift before it leaves CI.
 *
 * Equality is strict on the dotted-key SET — same paths in both locales,
 * not just same counts. Values are not compared (a value mismatch is a
 * different problem; this guard only checks shape).
 *
 * Exit codes:
 *   0  every namespace is in parity
 *   1  at least one namespace has an en/ar key-set mismatch
 *
 * Output on failure: a per-namespace diff listing keys only-in-en and
 * only-in-ar. Capped at the first 20 keys per side per file to keep CI
 * logs readable; the count of the remaining drift is shown when truncated.
 *
 * Wired into `npm run quality` alongside the other check:* scripts.
 * Run standalone with `npm run check:i18n-parity` or
 * `node scripts/check-i18n-parity.mjs`.
 */

import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const messagesRoot = path.join(here, "..", "messages")
const enDir = path.join(messagesRoot, "en")
const arDir = path.join(messagesRoot, "ar")

const MAX_DIFF_KEYS_PER_SIDE = 20

/** Flatten a nested JSON object into { "a.b.c": leafValue }. */
function flatten(obj, prefix = "", out = {}) {
    if (obj === null || typeof obj !== "object" || Array.isArray(obj)) return out
    for (const [k, v] of Object.entries(obj)) {
        const full = prefix ? `${prefix}.${k}` : k
        if (v !== null && typeof v === "object" && !Array.isArray(v)) flatten(v, full, out)
        else out[full] = v
    }
    return out
}

function loadKeys(dir, filename) {
    const raw = readFileSync(path.join(dir, filename), "utf8")
    return new Set(Object.keys(flatten(JSON.parse(raw))))
}

const enFiles = readdirSync(enDir).filter(f => f.endsWith(".json"))
const arFiles = readdirSync(arDir).filter(f => f.endsWith(".json"))

let failed = false
const fileOnlyEn = enFiles.filter(f => !arFiles.includes(f))
const fileOnlyAr = arFiles.filter(f => !enFiles.includes(f))
if (fileOnlyEn.length || fileOnlyAr.length) {
    failed = true
    console.error("✗ Namespace file lists differ between en and ar.")
    if (fileOnlyEn.length) console.error("  only in en:", fileOnlyEn.join(", "))
    if (fileOnlyAr.length) console.error("  only in ar:", fileOnlyAr.join(", "))
}

const sharedFiles = enFiles.filter(f => arFiles.includes(f)).sort()
for (const f of sharedFiles) {
    const en = loadKeys(enDir, f)
    const ar = loadKeys(arDir, f)
    const onlyEn = [...en].filter(k => !ar.has(k))
    const onlyAr = [...ar].filter(k => !en.has(k))
    if (onlyEn.length === 0 && onlyAr.length === 0) continue

    failed = true
    console.error(`\n✗ ${f}: ${onlyEn.length} only-en + ${onlyAr.length} only-ar`)
    if (onlyEn.length) {
        const slice = onlyEn.slice(0, MAX_DIFF_KEYS_PER_SIDE)
        for (const k of slice) console.error(`    en only: ${k}`)
        if (onlyEn.length > MAX_DIFF_KEYS_PER_SIDE) {
            console.error(`    ... (${onlyEn.length - MAX_DIFF_KEYS_PER_SIDE} more en-only keys)`)
        }
    }
    if (onlyAr.length) {
        const slice = onlyAr.slice(0, MAX_DIFF_KEYS_PER_SIDE)
        for (const k of slice) console.error(`    ar only: ${k}`)
        if (onlyAr.length > MAX_DIFF_KEYS_PER_SIDE) {
            console.error(`    ... (${onlyAr.length - MAX_DIFF_KEYS_PER_SIDE} more ar-only keys)`)
        }
    }
}

if (failed) {
    console.error("\n✗ i18n parity check FAILED.")
    process.exit(1)
}

// Single concise success line, matching the style of check-codegen-flag.mjs
let totalKeys = 0
for (const f of sharedFiles) totalKeys += loadKeys(enDir, f).size
console.log(`✓ i18n parity OK: ${sharedFiles.length} namespaces × ${totalKeys} keys (en === ar set).`)
