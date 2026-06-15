/**
 * Unified diff for a single allowlisted path, capped to prevent OOM.
 *
 * The cap exists because an admin can (a) commit a file that ends up
 * binary by mistake, then later (b) ask the UI to show the diff for it.
 * Without the cap, a multi-megabyte binary diff would balloon the API
 * response and the browser's memory.
 */

import { gitExec } from "./git-exec"
import { isAllowedPath } from "./paths"

/** Hard cap on returned diff bytes (200 KB per spec). */
export const DIFF_CAP_BYTES = 200 * 1024

export interface DiffResult {
  path: string
  /** Diff truncated to DIFF_CAP_BYTES if the original was larger. */
  diff: string
  truncated: boolean
  /** Empty diff (no working-tree changes for this path). */
  empty: boolean
}

export class DiffOutOfScopeError extends Error {
  constructor(public readonly received: string) {
    super(`Path "${received}" is outside the git-bridge allowlist`)
    this.name = "DiffOutOfScopeError"
  }
}

/**
 * Returns the working-tree diff for `path` (HEAD → working). Untracked
 * files report their full content as a synthetic "new file" diff so the
 * admin still sees what would be committed.
 */
export async function getFileDiff(filePath: string, cwd: string = process.cwd()): Promise<DiffResult> {
  if (!isAllowedPath(cwd, filePath)) {
    throw new DiffOutOfScopeError(filePath)
  }

  // `git diff` returns 0 with empty output if nothing to diff. We don't
  // use `--exit-code` because we want the empty-diff signal as data, not
  // as a non-zero exit.
  //
  // The leading `--` is critical: it prevents a hypothetical path
  // starting with `-` from being parsed as a flag. The allowlist already
  // rejects those, but defence-in-depth costs nothing.
  const { stdout } = await gitExec(["diff", "--no-color", "HEAD", "--", filePath], { cwd })
  let diff = stdout

  if (diff.length === 0) {
    // Either the path is unchanged, or it's untracked (HEAD doesn't know
    // about it). Probe with `ls-files --others` to distinguish.
    const { stdout: ls } = await gitExec(["ls-files", "--others", "--exclude-standard", "--", filePath], { cwd })
    if (ls.trim().length === 0) {
      return { path: filePath, diff: "", truncated: false, empty: true }
    }
    // Untracked — synthesise a "new file" diff by diffing against an empty blob.
    const { stdout: untrackedDiff } = await gitExec(["diff", "--no-color", "--no-index", "/dev/null", filePath], {
      cwd,
    }).catch(err => ({ stdout: (err as { stdout?: string }).stdout ?? "" }))
    diff = untrackedDiff
  }

  if (diff.length > DIFF_CAP_BYTES) {
    return {
      path: filePath,
      diff: diff.slice(0, DIFF_CAP_BYTES),
      truncated: true,
      empty: false,
    }
  }
  return { path: filePath, diff, truncated: false, empty: false }
}
