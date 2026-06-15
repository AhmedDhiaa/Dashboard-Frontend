/**
 * Round-trip experiment for the proposed static-entity-editor feature.
 *
 * Hypothesis: parsing each .config.tsx / .schema.ts / .types.ts with
 * `ts.createSourceFile` and re-emitting with `ts.createPrinter` produces
 * byte-identical output. If true, ts-morph (which wraps the same printer)
 * can safely be used for AST-driven edits and the round-trip CI gate is
 * achievable. If false, we need recast / babel-preserve or a different
 * tool.
 *
 * Standalone script — no test runner, no new dep. Writes a markdown
 * report to stdout summarising each file as PASS / FAIL with the first
 * divergence position for the failing ones.
 *
 * Usage: npx tsx scripts/static-entity-roundtrip-experiment.mts
 */

import { promises as fs } from "node:fs"
import path from "node:path"
import ts from "typescript"

const DOMAINS_ROOT = path.resolve(process.cwd(), "src", "domains")
const PATTERN = /\.(config\.tsx|config\.ts|schema\.ts|types\.ts)$/

interface FileResult {
  relPath: string
  kind: "config" | "schema" | "types"
  status: "PASS" | "FAIL"
  reason?: string
  /** Character offset of first divergence between original + re-emitted, if any. */
  firstDiffAt?: number
  /** First 80 chars of divergence on each side, for the report's "what changed". */
  originalSnippet?: string
  reEmittedSnippet?: string
}

async function walk(dir: string, out: string[] = []): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) await walk(full, out)
    else if (PATTERN.test(entry.name)) out.push(full)
  }
  return out
}

function classify(p: string): FileResult["kind"] {
  if (p.endsWith(".config.tsx") || p.endsWith(".config.ts")) return "config"
  if (p.endsWith(".schema.ts")) return "schema"
  return "types"
}

function scriptKind(p: string): ts.ScriptKind {
  return p.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
}

/** First index where two strings differ (-1 if identical). */
function firstDiff(a: string, b: string): number {
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i
  return a.length === b.length ? -1 : n
}

function snippet(s: string, at: number): string {
  // ±40 chars around the divergence, with \n / \t made visible so the
  // report shows whitespace-only diffs.
  const lo = Math.max(0, at - 20)
  const hi = Math.min(s.length, at + 60)
  return s.slice(lo, hi).replace(/\n/g, "↵").replace(/\t/g, "→")
}

async function roundtripFile(abs: string): Promise<FileResult> {
  const rel = path.relative(process.cwd(), abs).replace(/\\/g, "/")
  const kind = classify(abs)
  const original = await fs.readFile(abs, "utf8")
  try {
    const source = ts.createSourceFile(abs, original, ts.ScriptTarget.Latest, /*setParentNodes*/ true, scriptKind(abs))
    const printer = ts.createPrinter({
      newLine: ts.NewLineKind.LineFeed,
      removeComments: false,
    })
    const reEmitted = printer.printFile(source)

    if (original === reEmitted) return { relPath: rel, kind, status: "PASS" }
    const at = firstDiff(original, reEmitted)
    return {
      relPath: rel,
      kind,
      status: "FAIL",
      reason: "ts.printer output diverged from source",
      firstDiffAt: at,
      originalSnippet: snippet(original, at),
      reEmittedSnippet: snippet(reEmitted, at),
    }
  } catch (err) {
    return {
      relPath: rel,
      kind,
      status: "FAIL",
      reason: `parse/print threw: ${(err as Error).message}`,
    }
  }
}

function summary(results: FileResult[]): string {
  const total = results.length
  const passed = results.filter(r => r.status === "PASS").length
  const failed = total - passed
  const perKind = (k: FileResult["kind"]) => {
    const ofKind = results.filter(r => r.kind === k)
    const ok = ofKind.filter(r => r.status === "PASS").length
    return `${k}: ${ok}/${ofKind.length}`
  }
  return [
    `# Round-trip report — TypeScript compiler API printer`,
    ``,
    `Files scanned: **${total}** (${perKind("config")}, ${perKind("schema")}, ${perKind("types")})`,
    `Byte-identical round-trip: **${passed} / ${total}** (${failed} FAIL)`,
    ``,
  ].join("\n")
}

function table(results: FileResult[]): string {
  const sorted = [...results].sort((a, b) => a.relPath.localeCompare(b.relPath))
  const lines = ["| File | Kind | Status | First-divergence (char) | Reason |", "|------|------|--------|------------------------|--------|"]
  for (const r of sorted) {
    const where = r.firstDiffAt != null ? String(r.firstDiffAt) : "—"
    const reason = r.reason ? `\`${r.reason.slice(0, 60)}\`` : "—"
    lines.push(`| \`${r.relPath}\` | ${r.kind} | ${r.status === "PASS" ? "✅ PASS" : "❌ FAIL"} | ${where} | ${reason} |`)
  }
  return lines.join("\n")
}

function firstFailureDetail(results: FileResult[]): string {
  const failures = results.filter(r => r.status === "FAIL").slice(0, 5)
  if (failures.length === 0) return ""
  const sections = failures.map(f => {
    const orig = (f.originalSnippet ?? "").replace(/`/g, "\\`")
    const reEm = (f.reEmittedSnippet ?? "").replace(/`/g, "\\`")
    return `### ${f.relPath} @ char ${f.firstDiffAt}\n\nOriginal:\n\n    ${orig}\n\nRe-emitted:\n\n    ${reEm}\n`
  })
  return `\n## First few divergence sites (max 5)\n\n${sections.join("\n")}`
}

async function main(): Promise<void> {
  const files = await walk(DOMAINS_ROOT)
  const results = await Promise.all(files.map(roundtripFile))
  process.stdout.write(summary(results))
  process.stdout.write("\n")
  process.stdout.write(table(results))
  process.stdout.write("\n")
  process.stdout.write(firstFailureDetail(results))
  // Exit non-zero if any failed — would let CI block bad round-trip behaviour
  // once this becomes a real gate. For the experiment we just report.
  const anyFailed = results.some(r => r.status === "FAIL")
  if (anyFailed) process.exit(2)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
