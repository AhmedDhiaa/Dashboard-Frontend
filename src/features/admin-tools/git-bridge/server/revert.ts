/**
 * Discard working-tree changes for one or more allowlisted paths.
 *
 * Equivalent to `git checkout -- <paths>`, scoped to the allowlist. Files
 * outside the allowlist are silently filtered (NOT an error) so a UI that
 * sends a mixed list — one good, one stale — does the safe thing instead
 * of failing the whole batch.
 *
 * Untracked files are removed entirely (the working-tree change for an
 * untracked file IS its existence). Tracked files are restored to HEAD.
 */

import { gitExec } from "./git-exec"
import { isAllowedPath } from "./paths"

export interface RevertResult {
  /** Paths actually reverted (allowlist-filtered). */
  reverted: string[]
  /** Paths the caller asked for but were dropped because they're outside the allowlist. */
  refused: string[]
}

export async function revertFiles(filePaths: string[], cwd: string = process.cwd()): Promise<RevertResult> {
  const reverted: string[] = []
  const refused: string[] = []
  for (const p of filePaths) {
    if (isAllowedPath(cwd, p)) reverted.push(p)
    else refused.push(p)
  }

  if (reverted.length === 0) {
    return { reverted: [], refused }
  }

  // Separate tracked vs untracked. `restore` works on tracked files;
  // untracked files need explicit removal via `clean -fd` (scoped to
  // the exact paths) or `rm`. Easier: ask git which are untracked.
  const { stdout: untrackedOut } = await gitExec(["ls-files", "--others", "--exclude-standard", "--", ...reverted], {
    cwd,
  })
  const untracked = new Set(untrackedOut.split("\n").filter(s => s.length > 0))
  const tracked = reverted.filter(p => !untracked.has(p))

  if (tracked.length > 0) {
    // `restore --staged --worktree` undoes both staged and unstaged changes
    // in one call. The leading `--` defends against a path starting with `-`.
    await gitExec(["restore", "--staged", "--worktree", "--", ...tracked], { cwd })
  }

  if (untracked.size > 0) {
    // `clean -fd` only removes paths we explicitly list (no globbing).
    // Allowlist check ran above; these are all inside the allowed prefixes.
    await gitExec(["clean", "-fd", "--", ...untracked], { cwd })
  }

  return { reverted, refused }
}
