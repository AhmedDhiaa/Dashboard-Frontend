/**
 * Path-traversal guards for every server-side file write.
 *
 * The runtime contract: any path string that ends up in a `fs.write*`,
 * `fs.unlink`, `fs.mkdir`, `fs.rename`, `fs.rm`, `fs.copyFile`, or
 * `fs.appendFile` call MUST first round-trip through one of these helpers.
 * If a future call-site writes to disk without going through here, the
 * code review checklist + the audit grep in CI should catch it.
 *
 * Two flavours:
 *
 *   • assertSafePath(p)            — sync, lexical-only check. Catches
 *                                    `..`, absolute escape, and any path
 *                                    that lands outside `ALLOWED_ROOTS`.
 *                                    Use this for the common case.
 *
 *   • assertSafePathResolved(p)   — async, also follows `realpath` on the
 *                                    deepest existing ancestor. Catches the
 *                                    "attacker pre-planted a symlink inside
 *                                    an allowed root" attack. Use this for
 *                                    paths that may flow through directories
 *                                    where attacker-writable symlinks could
 *                                    have been created (e.g. restoring from
 *                                    backups, copying into existing dirs).
 *
 * On success the helpers return the absolute path so callers can pass it
 * straight to fs. On failure they throw `PathTraversalError` with the
 * received path attached for the audit log.
 */

import { promises as fs } from "node:fs"
import path from "node:path"

/**
 * Project-relative roots that ANY server-side file write is allowed to
 * touch. Tightening this list is the single biggest lever for shrinking
 * the file-write blast radius.
 *
 * Each entry is a project-relative path; `assertSafePath` matches both
 * exact equality (`messages`) AND prefix-with-separator (`messages/...`).
 */
export const ALLOWED_ROOTS = [
  "src/domains",
  "src/app/(dashboard)",
  "src/features/dashboard/widgets",
  "messages",
  ".entity-builder-backups",
  // Working directory for the codegen typecheck sandbox. Lives inside the
  // project so the same volume-mount story covers it; gets fully wiped at
  // the end of every typecheck run.
  ".entity-builder-cache",
] as const

const ROOT = process.cwd()
const SEP = path.sep

export class PathTraversalError extends Error {
  constructor(
    message: string,
    public readonly received: string,
  ) {
    super(message)
    this.name = "PathTraversalError"
  }
}

/**
 * Sync lexical guard. Resolves the input against `process.cwd()`, refuses
 * any path that escapes the project root, and refuses any path that
 * doesn't fall under one of the `ALLOWED_ROOTS`.
 *
 * Returns the canonical absolute path on success.
 */
export function assertSafePath(p: string): string {
  if (typeof p !== "string" || p === "") {
    throw new PathTraversalError(`Expected a non-empty path string, got ${typeof p}`, String(p))
  }

  // path.resolve with two args: if `p` is absolute, the result IS p
  // (resolved + normalised); if relative, it's joined onto cwd. Either
  // way, .. segments collapse and casing is preserved.
  const abs = path.resolve(ROOT, p)
  const rel = path.relative(ROOT, abs)

  // `rel` starting with `..` means the resolved path sits outside cwd.
  // `path.isAbsolute(rel)` triggers on Windows when the input was a
  // different drive letter (D:\foo when cwd is C:\bar) — `rel` then comes
  // back as the absolute target.
  if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new PathTraversalError(`Path "${p}" escapes project root`, p)
  }

  if (!isInsideAllowedRoot(rel)) {
    throw new PathTraversalError(`Path "${rel}" is not inside any allowed root (${ALLOWED_ROOTS.join(", ")})`, p)
  }

  return abs
}

/**
 * Async variant that, after the lexical check, additionally resolves
 * symlinks on the deepest existing ancestor of the target path. Defends
 * against a pre-planted symlink inside an allowed root that points at
 * an arbitrary location outside it.
 *
 * Why "deepest existing ancestor": the target file usually doesn't exist
 * yet (we're about to write it). `fs.realpath` on a missing path throws,
 * so we walk up until we find one that exists, resolve THAT, then
 * re-check the resolved prefix.
 */
export async function assertSafePathResolved(p: string): Promise<string> {
  const abs = assertSafePath(p)

  // Canonicalise the project root the SAME way `fs.realpath` canonicalises the
  // target below. Without this, a `process.cwd()` that is an 8.3 short name
  // (e.g. Windows CI temp dirs: `C:\Users\RUNNER~1\…` → `…\runneradmin\…`) makes
  // every resolved path look like it escapes — a false positive. Comparing
  // realpath-to-realpath keeps the symlink-escape defence while tolerating
  // short-name / case aliases of the root itself.
  const realRoot = await realpathOrSelf(ROOT)

  // Find the deepest existing ancestor. The whole chain may not exist
  // (typical for fs.mkdir { recursive: true } with new dirs), so walk up.
  let probe = abs
  while (probe !== path.dirname(probe)) {
    try {
      const real = await fs.realpath(probe)
      if (real !== probe) {
        // Symlink (or short-name alias) encountered. Re-validate the resolved
        // path against ALLOWED_ROOTS relative to the canonicalised root.
        const realRel = path.relative(realRoot, real)
        if (realRel.startsWith("..") || path.isAbsolute(realRel) || !isInsideAllowedRoot(realRel)) {
          throw new PathTraversalError(
            `Path "${p}" resolves through a symlink to "${real}" which is outside the allowed roots`,
            p,
          )
        }
      }
      break
    } catch (err) {
      if (err instanceof PathTraversalError) throw err
      // ENOENT — climb one level
      probe = path.dirname(probe)
    }
  }

  return abs
}

/** `fs.realpath`, falling back to the input if the path doesn't exist. */
async function realpathOrSelf(target: string): Promise<string> {
  try {
    return await fs.realpath(target)
  } catch {
    return target
  }
}

function isInsideAllowedRoot(rel: string): boolean {
  // Normalise to forward slashes for the prefix check. We keep the
  // separator-suffixed compare so `messages-evil/x` doesn't slip through
  // as a prefix of `messages`.
  const normalised = rel.split(/[\\/]/).join(SEP)
  return ALLOWED_ROOTS.some(root => {
    const r = root.split(/[\\/]/).join(SEP)
    return normalised === r || normalised.startsWith(r + SEP)
  })
}
