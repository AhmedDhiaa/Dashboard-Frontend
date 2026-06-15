/**
 * Path allowlist + safety helpers for the dev-only git-bridge.
 *
 * Single source of truth for "which paths the admin UI is allowed to
 * touch via git." Every other module (status / diff / commit / revert)
 * routes through `isAllowedPath`. If a future caller bypasses this
 * helper, the audit grep is one regex: `git\.(add|commit|checkout).*\b\.\.`.
 *
 * Rules:
 *   - Paths must be repo-relative POSIX strings (forward slashes).
 *   - Paths must start with one of ALLOWED_PREFIXES.
 *   - Paths must NOT escape repo root via `..` after resolve.
 *
 * Why a tight allowlist: the UI surface is dev-only but the env flag
 * could be misconfigured. Even if the surface is exposed in production
 * (which is also guarded by NODE_ENV !== "production"), this layer
 * means the worst an attacker can do is commit translation / entity /
 * page-builder files — never `.env`, `node_modules/`, or arbitrary
 * source outside the codegen targets.
 */

import path from "node:path"

/**
 * Repo-relative prefixes the admin git surface may operate on. Paths
 * outside this list are excluded from status output AND refused at
 * commit/revert/diff time.
 *
 * The list mirrors the materialize pipeline's write targets:
 *
 *   - messages/{en,ar}/                              (translation sources)
 *   - messages/_overrides/.version                   (override version stamp — readable but in .gitignore)
 *   - src/domains/                                   (entity configs / schemas / types)
 *   - src/app/(dashboard)/                           (materialized pages)
 *   - .entity-builder-backups/                       (backup snapshots — explicit so admins can inspect)
 *
 * Note: `messages/_overrides/` itself is in `.gitignore`, so it can't be
 * committed anyway — but we leave it OUT of the allowlist for defence in
 * depth, since a future gitignore change could otherwise leak override
 * state into commits.
 */
export const ALLOWED_PREFIXES: readonly string[] = [
  "messages/en/",
  "messages/ar/",
  "src/domains/",
  "src/app/(dashboard)/",
  ".entity-builder-backups/",
] as const

/**
 * Branch-name patterns the commit endpoint refuses to commit to. Comma-
 * separated env var; first match wins. Designed so that an admin who
 * accidentally runs the UI while checked out on main can't push commits
 * directly to it.
 */
export function protectedBranches(): readonly string[] {
  const raw = process.env.GIT_PROTECTED_BRANCHES ?? "main,master,production"
  return raw
    .split(",")
    .map(s => s.trim())
    .filter(s => s.length > 0)
}

/** Normalise to repo-relative POSIX with no leading slash and no `..`. */
export function normaliseRepoPath(repoRoot: string, p: string): string {
  // Always treat the input as a path — never a shell argument. We pass
  // these through execFile's argv (not a string command), so even a
  // path like "foo; rm -rf /" is safe at the process boundary; this
  // helper exists for the allowlist check, not for shell escaping.
  const abs = path.resolve(repoRoot, p)
  const rel = path.relative(repoRoot, abs).split(path.sep).join("/")
  return rel
}

export function isAllowedPath(repoRoot: string, p: string): boolean {
  if (typeof p !== "string" || p.length === 0) return false
  const rel = normaliseRepoPath(repoRoot, p)
  if (rel.startsWith("..") || path.isAbsolute(rel)) return false
  return ALLOWED_PREFIXES.some(prefix => rel.startsWith(prefix))
}

/**
 * Heuristic binary detector. Reads the first 8 KB of the file and reports
 * "binary" if it contains a null byte. This is the same heuristic git's
 * own `core.autocrlf` / `diff.algorithm` uses for "is this a binary file"
 * decisions. False positives on UTF-16 files are acceptable for this
 * dev-only surface — the admin can revert and edit by hand.
 */
import { promises as fs } from "node:fs"

export async function isLikelyBinary(absPath: string): Promise<boolean> {
  let fh: fs.FileHandle | null = null
  try {
    fh = await fs.open(absPath, "r")
    const buf = Buffer.alloc(8 * 1024)
    const { bytesRead } = await fh.read(buf, 0, buf.length, 0)
    for (let i = 0; i < bytesRead; i++) if (buf[i] === 0x00) return true
    return false
  } catch {
    // Unreadable file → not committable by definition; report as binary
    // so the caller refuses rather than tries to commit anyway.
    return true
  } finally {
    await fh?.close().catch(() => undefined)
  }
}
