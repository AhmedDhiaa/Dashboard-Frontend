/**
 * Commit + optional push, gated by every safety check that exists.
 *
 * Order matters — cheap checks first, expensive last:
 *
 *   1. Allowlist     — every path in the request must be inside the
 *                      ALLOWED_PREFIXES set (paths.ts).
 *   2. Binary        — any file with a NUL in the first 8 KB is refused
 *                      so we never accidentally commit a build artifact
 *                      or a corrupted JSON.
 *   3. Protected     — current branch must not match GIT_PROTECTED_BRANCHES
 *                      (defaults to "main,master,production"). The UI
 *                      surfaces a "create feature branch" shortcut when
 *                      this fires.
 *   4. Branch create — if `targetBranch` differs from current, switch /
 *                      create it.
 *   5. Stage         — `git add -- <files>` for the exact path list.
 *   6. Commit        — `git commit -m <message>`. Trims to 1000 chars
 *                      (any longer is almost certainly a paste accident).
 *   7. Push          — only when `push: true`. Errors surface stderr.
 *
 * Every error throws `CommitRefusedError` with a `reason` discriminator
 * so the route handler can choose the right HTTP code:
 *   - "out-of-scope-paths"   → 400
 *   - "binary-file"          → 400
 *   - "protected-branch"     → 409
 *   - "empty-message"        → 400
 *   - "nothing-to-commit"    → 409
 *   - "git-error"            → 500
 */

import { gitExec, GitExecError, resolveInsideRepo } from "./git-exec"
import { assertBranchName, createBranch, listBranches, switchBranch } from "./branch"
import { isAllowedPath, isLikelyBinary, normaliseRepoPath, protectedBranches } from "./paths"

export type CommitRefusalReason =
  | "out-of-scope-paths"
  | "binary-file"
  | "protected-branch"
  | "empty-message"
  | "nothing-to-commit"
  | "git-error"

export class CommitRefusedError extends Error {
  constructor(
    public readonly reason: CommitRefusalReason,
    message: string,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message)
    this.name = "CommitRefusedError"
  }
}

export interface CommitRequest {
  message: string
  files: string[]
  /** When provided, switch/create this branch before committing. */
  branch?: string
  /** When true, also run `git push --set-upstream origin <branch>`. */
  push?: boolean
  /**
   * The "preview" mode: validate everything and return what WOULD be
   * committed without actually staging anything. The UI uses this for
   * its confirmation step.
   */
  dryRun?: boolean
}

export interface CommitPreview {
  /** Branch the commit will land on (after switch/create, if requested). */
  targetBranch: string
  /** Paths accepted after the allowlist + binary filter. */
  files: string[]
  /** Per-file binary verdict — surfaces a clearer error in the UI than "refused". */
  binaryFiles: string[]
  /** True if the current branch is in GIT_PROTECTED_BRANCHES. */
  protectedBranch: boolean
}

export interface CommitResult extends CommitPreview {
  commitHash: string
  pushed: boolean
  /** Captured for the UI banner when `push` failed but commit succeeded. */
  pushError: string | null
}

const MESSAGE_MAX = 1000

async function currentBranch(cwd: string): Promise<string> {
  const { stdout } = await gitExec(["rev-parse", "--abbrev-ref", "HEAD"], { cwd })
  return stdout.trim()
}

/**
 * Run the pre-flight checks: allowlist, binary, protected-branch. Throws
 * `CommitRefusedError` on the first failure that the admin can't override.
 */
async function preflight(req: CommitRequest, cwd: string): Promise<CommitPreview> {
  if (typeof req.message !== "string" || req.message.trim().length === 0) {
    throw new CommitRefusedError("empty-message", "Commit message is required")
  }

  // Allowlist. Surface ALL out-of-scope paths in one error so the admin
  // gets the full picture instead of having to re-submit per offender.
  const outOfScope = req.files.filter(p => !isAllowedPath(cwd, p))
  if (outOfScope.length > 0) {
    throw new CommitRefusedError("out-of-scope-paths", `Refusing to commit paths outside the git-bridge allowlist`, {
      paths: outOfScope,
    })
  }

  // Binary check. Skip files that don't exist on disk (deleted) — the
  // binary check would always pass for them anyway.
  const binaryFiles: string[] = []
  for (const p of req.files) {
    const abs = resolveInsideRepo(cwd, p)
    try {
      const binary = await isLikelyBinary(abs)
      if (binary) binaryFiles.push(p)
    } catch {
      // ENOENT — file is deleted in working tree. Git will record the
      // deletion just fine; no binary risk.
    }
  }
  if (binaryFiles.length > 0) {
    throw new CommitRefusedError("binary-file", "Refusing to commit binary files", { paths: binaryFiles })
  }

  // Protected-branch check happens BEFORE any branch switching so the
  // admin sees the right "you're on main — create a feature branch"
  // message regardless of what they passed in `branch`.
  const here = await currentBranch(cwd)
  const isProtected = protectedBranches().some(p => p === here || p === "*")
  const targetBranch = req.branch ?? here
  if (isProtected && targetBranch === here) {
    throw new CommitRefusedError(
      "protected-branch",
      `Branch "${here}" is in GIT_PROTECTED_BRANCHES. Switch to a feature branch first.`,
      { current: here, protected: protectedBranches() },
    )
  }

  return {
    targetBranch,
    files: req.files.map(p => normaliseRepoPath(cwd, p)),
    binaryFiles: [],
    protectedBranch: isProtected,
  }
}

/**
 * Ensure we're on the right branch, creating it (off the current branch)
 * if it doesn't exist locally yet. No-op when the request didn't specify
 * a branch.
 */
async function ensureBranch(targetBranch: string | undefined, cwd: string): Promise<void> {
  if (targetBranch === undefined) return
  assertBranchName(targetBranch)
  const branches = await listBranches(cwd)
  const exists = branches.some(b => b.name === targetBranch)
  const current = branches.find(b => b.current)?.name
  if (current === targetBranch) return
  if (exists) await switchBranch(targetBranch, cwd)
  else await createBranch(targetBranch, undefined, cwd)
}

export async function preview(req: CommitRequest, cwd: string = process.cwd()): Promise<CommitPreview> {
  return preflight(req, cwd)
}

export async function commit(req: CommitRequest, cwd: string = process.cwd()): Promise<CommitResult> {
  const previewResult = await preflight(req, cwd)
  if (req.dryRun) {
    return { ...previewResult, commitHash: "", pushed: false, pushError: null }
  }

  await ensureBranch(req.branch, cwd)

  // Stage. We pass the file list explicitly — never `add -A` or `add .`,
  // which would also stage any accidental working-tree noise outside
  // the allowlist.
  await gitExec(["add", "--", ...previewResult.files], { cwd })

  // Commit. `--allow-empty-message` is deliberately NOT passed — the
  // message length is already checked in preflight.
  const message = req.message.trim().slice(0, MESSAGE_MAX)
  try {
    await gitExec(["commit", "-m", message], { cwd })
  } catch (err) {
    const e = err as GitExecError
    // "nothing to commit" is a benign case worth a separate signal so
    // the UI can show "no changes" instead of a generic 500.
    if (/nothing to commit/.test(e.stderr + e.stdout)) {
      throw new CommitRefusedError("nothing-to-commit", "No changes to commit", {})
    }
    throw new CommitRefusedError("git-error", "git commit failed", { stderr: e.stderr.slice(0, 800) })
  }

  const { stdout: hashOut } = await gitExec(["rev-parse", "HEAD"], { cwd })
  const commitHash = hashOut.trim()

  let pushed = false
  let pushError: string | null = null
  if (req.push) {
    const finalBranch = req.branch ?? (await currentBranch(cwd))
    try {
      await gitExec(["push", "--set-upstream", "origin", finalBranch], { cwd, timeoutMs: 60_000 })
      pushed = true
    } catch (err) {
      const e = err as GitExecError
      // Keep the commit. Surface push failure separately so the admin
      // can re-push from the terminal or fix the remote and retry.
      pushError = e.stderr.slice(0, 800) || e.message
    }
  }

  return { ...previewResult, commitHash, pushed, pushError }
}

// Re-export the allowlist helper so the route module can call it for its own
// audit-log entry without depending on `paths.ts` directly.
export { isAllowedPath }
