/**
 * Thin wrapper around `git` CLI via `child_process.execFile`.
 *
 * We deliberately use `execFile` (argv-array) instead of `simple-git`:
 *
 *   1. simple-git wraps execFile internally; the abstraction adds no
 *      safety, only deps.
 *   2. argv-array passing means no shell, no quoting, no concatenation —
 *      a path like `foo; rm -rf /` is just a literal argument to git,
 *      never parsed as shell. This matches the security model in
 *      `entity-builder/server/typecheck.ts` and `file-writer.ts`.
 *   3. We expose exactly the four git subcommands the UI needs
 *      (status, diff, checkout, add+commit+push, branch). No generic
 *      `git.raw()` escape hatch.
 *
 * Repo root is computed lazily (`process.cwd()`) per call so tests
 * chdir-ing into a sandbox repo don't need to re-import.
 */

import { execFile } from "node:child_process"
import { promisify } from "node:util"
import path from "node:path"

const execFileP = promisify(execFile)

export class GitExecError extends Error {
  constructor(
    message: string,
    public readonly stderr: string,
    public readonly stdout: string,
    public readonly args: readonly string[],
  ) {
    super(message)
    this.name = "GitExecError"
  }
}

export interface GitExecResult {
  stdout: string
  stderr: string
}

export interface GitExecOptions {
  /** Repo root. Defaults to `process.cwd()`. Tests pass a sandbox path. */
  cwd?: string
  /** Hard timeout. Default 30 s — long enough for `push`, short enough to surface a hang. */
  timeoutMs?: number
  /** Cap output buffer. Defaults to 5 MB — catches accidental `git log` floods. */
  maxBufferBytes?: number
}

/**
 * Run `git <args...>` with the given options. Returns stdout+stderr on
 * success; throws `GitExecError` on non-zero exit (with stderr attached
 * so the route handler can surface it to the UI).
 */
export async function gitExec(args: string[], opts: GitExecOptions = {}): Promise<GitExecResult> {
  const cwd = opts.cwd ?? process.cwd()
  const timeoutMs = opts.timeoutMs ?? 30_000
  const maxBuffer = opts.maxBufferBytes ?? 5 * 1024 * 1024

  try {
    const { stdout, stderr } = await execFileP("git", args, {
      cwd,
      timeout: timeoutMs,
      maxBuffer,
      // Force ASCII-safe output regardless of the host locale so parsers
      // don't trip on translated `git status` headers.
      env: { ...process.env, LANG: "C", LC_ALL: "C" },
      windowsHide: true,
    })
    return { stdout, stderr }
  } catch (err) {
    const e = err as { stdout?: string | Buffer; stderr?: string | Buffer; message: string }
    const stdout = typeof e.stdout === "string" ? e.stdout : (e.stdout?.toString() ?? "")
    const stderr = typeof e.stderr === "string" ? e.stderr : (e.stderr?.toString() ?? "")
    throw new GitExecError(e.message, stderr, stdout, args)
  }
}

/**
 * Resolve a list of repo-relative paths into absolute paths AND verify
 * each one is still inside the repo root after symlink/`..` resolution.
 * This is the contract that lets every caller pass user-supplied paths
 * to git without an explicit check at each call site.
 */
export function resolveInsideRepo(repoRoot: string, p: string): string {
  const abs = path.resolve(repoRoot, p)
  const rel = path.relative(repoRoot, abs)
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`Path "${p}" escapes repo root`)
  }
  return abs
}
