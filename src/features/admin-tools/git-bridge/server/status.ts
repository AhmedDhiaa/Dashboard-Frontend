/**
 * Scoped `git status` for the admin UI.
 *
 * Returns only paths under the allowlist (see `paths.ts`). Anything else
 * — node_modules, dotfiles, parent project state — is filtered out before
 * the API response, so the UI literally cannot show or commit it.
 *
 * Categorisation buckets match the four edit surfaces:
 *   - translations  → messages/{en,ar}/<ns>.json
 *   - entities      → src/domains/**
 *   - pages         → src/app/(dashboard)/pages/**  (page-builder targets)
 *   - other         → everything else inside the allowlist (e.g. backups)
 */

import path from "node:path"
import { gitExec } from "./git-exec"
import { ALLOWED_PREFIXES, isAllowedPath } from "./paths"

export type GitStatusCategory = "translations" | "entities" | "pages" | "other"
export type GitStatusChangeKind = "added" | "modified" | "deleted" | "untracked" | "renamed"

export interface GitStatusEntry {
  path: string
  /** Same path, classified into one of the four buckets the UI groups by. */
  category: GitStatusCategory
  kind: GitStatusChangeKind
}

export interface GitStatusReport {
  branch: string
  entries: GitStatusEntry[]
  /** Counts kept separate so the panel header doesn't have to re-scan. */
  counts: Record<GitStatusChangeKind, number>
}

function classify(p: string): GitStatusCategory {
  if (p.startsWith("messages/")) return "translations"
  if (p.startsWith("src/domains/")) return "entities"
  if (p.startsWith("src/app/(dashboard)/pages/")) return "pages"
  return "other"
}

/**
 * Parse one porcelain-v1 line: "XY <path>" where X = index status,
 * Y = working-tree status. Renames are reported as "XY <new> -> <old>";
 * we keep the new path.
 */
function parsePorcelainLine(line: string): { path: string; kind: GitStatusChangeKind } | null {
  if (line.length < 4) return null
  const x = line[0]
  const y = line[1]
  let rest = line.slice(3)
  // Strip git's "<new> -> <old>" rename syntax — we only care about the new path.
  const arrowIdx = rest.indexOf(" -> ")
  if (arrowIdx >= 0) rest = rest.slice(arrowIdx + 4)

  // Quoted paths (those containing special chars) come back wrapped in
  // double quotes; strip them. We don't fully un-escape because every
  // path that reaches this point must already be inside the allowlist,
  // which forbids the special chars anyway.
  if (rest.startsWith('"') && rest.endsWith('"')) rest = rest.slice(1, -1)

  if (x === "?" && y === "?") return { path: rest, kind: "untracked" }
  if (x === "A" || y === "A") return { path: rest, kind: "added" }
  if (x === "D" || y === "D") return { path: rest, kind: "deleted" }
  if (x === "R" || y === "R") return { path: rest, kind: "renamed" }
  if (x === "M" || y === "M") return { path: rest, kind: "modified" }
  return null
}

async function currentBranch(cwd: string): Promise<string> {
  // `--show-current` returns empty in detached-HEAD state. The fallback
  // surfaces detached HEAD to the UI as "(detached)" rather than an error.
  const { stdout } = await gitExec(["rev-parse", "--abbrev-ref", "HEAD"], { cwd })
  const trimmed = stdout.trim()
  return trimmed === "HEAD" ? "(detached)" : trimmed
}

export async function getScopedStatus(cwd: string = process.cwd()): Promise<GitStatusReport> {
  const [branch, statusOut] = await Promise.all([
    currentBranch(cwd),
    gitExec(
      [
        "status",
        "--porcelain=v1",
        "--untracked-files=all",
        "--",
        ...ALLOWED_PREFIXES.map(p => p.replace(/\/$/, "") || "."),
      ],
      { cwd },
    ),
  ])

  const entries: GitStatusEntry[] = []
  const counts: Record<GitStatusChangeKind, number> = {
    added: 0,
    modified: 0,
    deleted: 0,
    untracked: 0,
    renamed: 0,
  }

  for (const rawLine of statusOut.stdout.split("\n")) {
    if (rawLine.length === 0) continue
    const parsed = parsePorcelainLine(rawLine)
    if (!parsed) continue

    // Defence in depth: we already scoped with `-- <allowlist>`, but a
    // pathspec match can let through e.g. a file `messages/en/.env` that
    // happens to be under the prefix. Re-verify via the lexical check.
    const normalised = parsed.path.split(path.sep).join("/")
    if (!isAllowedPath(cwd, normalised)) continue

    entries.push({
      path: normalised,
      category: classify(normalised),
      kind: parsed.kind,
    })
    counts[parsed.kind] += 1
  }

  // Sort by category, then alphabetically — keeps the UI stable across reloads.
  const order: Record<GitStatusCategory, number> = { translations: 0, entities: 1, pages: 2, other: 3 }
  entries.sort((a, b) => order[a.category] - order[b.category] || a.path.localeCompare(b.path))

  return { branch, entries, counts }
}
