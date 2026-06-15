/**
 * Branch management for the git-bridge.
 *
 *   - list:       enumerate local branches (no remotes — the UI only lets
 *                 admins commit to local refs; pushing is a separate op).
 *   - create:     `git checkout -b <name> [<from>]` after a strict name check.
 *   - switch:     `git checkout <name>` (only if local branch exists).
 *
 * Branch names go through a kebab/snake regex so a malicious payload
 * like `--upload-pack=evil` can't reach the `git checkout` argv as a flag.
 */

import { gitExec } from "./git-exec"

/**
 * Tight branch-name regex: lowercase letters, digits, `/` for namespaces,
 * `-` and `_` for separators. Min 1 char, max 80. Slashes intentionally
 * allowed so admins can use `feature/x-y-z` style namespacing.
 */
const BRANCH_NAME_PATTERN = /^[a-z0-9][a-z0-9/_-]{0,79}$/

export class InvalidBranchNameError extends Error {
  constructor(public readonly received: string) {
    super(`Branch name "${received}" must be 1–80 chars of [a-z0-9/_-]`)
    this.name = "InvalidBranchNameError"
  }
}

export function assertBranchName(name: string): string {
  if (typeof name !== "string" || !BRANCH_NAME_PATTERN.test(name)) {
    throw new InvalidBranchNameError(String(name))
  }
  return name
}

export interface BranchListEntry {
  name: string
  /** True if this branch is currently checked out. */
  current: boolean
}

export async function listBranches(cwd: string = process.cwd()): Promise<BranchListEntry[]> {
  // `--list` constrains output to local refs (no remotes). The format
  // string gives us machine-readable rows without parsing the "* " prefix.
  const { stdout } = await gitExec(["branch", "--list", "--format=%(refname:short)\t%(HEAD)"], { cwd })
  const entries: BranchListEntry[] = []
  for (const line of stdout.split("\n")) {
    if (!line) continue
    const [name, head] = line.split("\t")
    if (!name) continue
    entries.push({ name, current: head === "*" })
  }
  return entries
}

export async function createBranch(name: string, from?: string, cwd: string = process.cwd()): Promise<void> {
  assertBranchName(name)
  if (from !== undefined) assertBranchName(from)
  const args = ["checkout", "-b", name]
  if (from) args.push(from)
  await gitExec(args, { cwd })
}

export async function switchBranch(name: string, cwd: string = process.cwd()): Promise<void> {
  assertBranchName(name)
  // Use `switch` (not `checkout`) so the command refuses if there are
  // uncommitted changes that would be overwritten — `checkout` would
  // happily lose them.
  await gitExec(["switch", name], { cwd })
}
