/**
 * Idempotent, byte-preserving patcher for src/shared/auth/permission-keys.ts.
 *
 * **Why text-surgical and not ts-morph**: Prompt 6's round-trip
 * experiment proved `ts.printer` (and therefore ts-morph) cannot
 * byte-identically round-trip this repo's source style — semicolons get
 * inserted, blank lines collapsed, indentation normalised. The patcher's
 * contract is "no change to any byte outside the insertion site", which
 * is impossible with a print-the-whole-AST tool but trivial with
 * regex-find-the-insertion-boundary + splice.
 *
 * The PERMISSIONS map is intentionally simple enough for text patching:
 * one-line entries, kebab-by-section, terminated by `} as const`. Any
 * future shape change that breaks the regex anchors will surface as a
 * `PatchFailedError` from `findInsertionSite` — not a silent miswrite.
 */

import { promises as fs } from "node:fs"
import path from "node:path"

export class PatchFailedError extends Error {
  constructor(
    message: string,
    public readonly received: Record<string, unknown> = {},
  ) {
    super(message)
    this.name = "PatchFailedError"
  }
}

export class PermissionKeyCollisionError extends Error {
  constructor(
    public readonly identifier: string,
    public readonly existingValue: string,
    public readonly proposedValue: string,
  ) {
    super(
      `PERMISSIONS.${identifier} already exists with value "${existingValue}"; refusing to overwrite with "${proposedValue}"`,
    )
    this.name = "PermissionKeyCollisionError"
  }
}

const PERMISSION_KEYS_FILE = path.join("src", "shared", "auth", "permission-keys.ts")

/** Repo-root identifier shape (matches `ADMIN_ENTITY_BUILDER` etc.). */
const IDENTIFIER_PATTERN = /^[A-Z][A-Z0-9_]{0,60}$/
/** ABP-style fully-qualified permission key (3+ segments, e.g. "Api.Brand.Approve"). */
const FULLY_QUALIFIED_VALUE_PATTERN = /^Api\.[A-Z][A-Za-z0-9]*(?:\.[A-Z][A-Za-z0-9]*){1,5}$/

export interface PatchInput {
  /** UPPER_SNAKE_CASE identifier added as a key on PERMISSIONS. */
  identifier: string
  /** Fully-qualified `Api.Module.Action` string the value resolves to. */
  value: string
}

export interface PatchResult {
  /** Updated file content. Identical to original when the entry already existed. */
  content: string
  /** True if the file content changed (a new entry was inserted). */
  changed: boolean
  /** Snippet showing what was inserted, for the audit log + UI preview. */
  insertionSnippet?: string
}

function validateInput(input: PatchInput): void {
  if (!IDENTIFIER_PATTERN.test(input.identifier)) {
    throw new PatchFailedError(`Identifier "${input.identifier}" must be UPPER_SNAKE_CASE (≤60 chars)`)
  }
  if (!FULLY_QUALIFIED_VALUE_PATTERN.test(input.value)) {
    throw new PatchFailedError(
      `Value "${input.value}" must be a fully-qualified permission key like "Api.Brand.Approve" — 2-segment prefixes (Api.Brand) belong on the entity config, not in PERMISSIONS`,
    )
  }
}

/**
 * Parse the existing entries by matching individual lines. We're not
 * walking the AST — that would defeat the byte-preservation goal — so the
 * parser is deliberately literal: each entry must be one line of shape
 *   `<indent>IDENT: "VALUE",` (with optional trailing comment / blank lines).
 */
function existingEntries(source: string): Map<string, { value: string; lineIndex: number; line: string }> {
  const lines = source.split("\n")
  const entries = new Map<string, { value: string; lineIndex: number; line: string }>()
  const entryRe = /^\s+([A-Z][A-Z0-9_]*): "([^"]+)",\s*$/
  for (let i = 0; i < lines.length; i++) {
    const m = entryRe.exec(lines[i]!)
    if (m) entries.set(m[1]!, { value: m[2]!, lineIndex: i, line: lines[i]! })
  }
  return entries
}

/**
 * Decide where to insert the new line. Strategy: append to the LAST entry
 * of the file (just before `} as const`). The PERMISSIONS map is grouped
 * by section comments, but the patcher refuses to guess the right
 * section — it's safer to append at the bottom and let the dev re-arrange
 * later than to silently dump entries into the wrong section.
 */
function findInsertionSite(source: string): { afterLineIndex: number; indent: string } {
  const lines = source.split("\n")
  // `} as const` is the deterministic anchor.
  const closingIdx = lines.findIndex(l => /^\s*}\s+as\s+const\b/.test(l))
  if (closingIdx < 0) {
    throw new PatchFailedError("permission-keys.ts is missing the `} as const` anchor")
  }

  // Walk backwards from the closing line to find the last `IDENT: "...",`
  // entry. That tells us both where to insert AND the canonical indent.
  for (let i = closingIdx - 1; i >= 0; i--) {
    const m = /^(\s+)[A-Z][A-Z0-9_]*: "[^"]+",\s*$/.exec(lines[i]!)
    if (m) return { afterLineIndex: i, indent: m[1]! }
  }
  // Fallback: insert just before `} as const` with two-space indent.
  return { afterLineIndex: closingIdx - 1, indent: "  " }
}

export function applyPermissionKeyPatch(source: string, input: PatchInput): PatchResult {
  validateInput(input)
  const existing = existingEntries(source)
  const found = existing.get(input.identifier)

  // Idempotent: if the entry already exists with the same value, no-op.
  if (found && found.value === input.value) {
    return { content: source, changed: false }
  }
  // Collision: same identifier, different value. Refuse explicitly so the
  // admin sees the conflict and decides how to reconcile.
  if (found) {
    throw new PermissionKeyCollisionError(input.identifier, found.value, input.value)
  }

  const { afterLineIndex, indent } = findInsertionSite(source)
  const newLine = `${indent}${input.identifier}: "${input.value}",`
  const lines = source.split("\n")
  lines.splice(afterLineIndex + 1, 0, newLine)
  const content = lines.join("\n")
  return { content, changed: true, insertionSnippet: newLine.trim() }
}

/**
 * Resolve the target file under `repoRoot` and verify the resolved path
 * is exactly what we expect. The patcher's path is a module-level
 * constant with no user-controllable input, so this is a defence-in-
 * depth check rather than a per-call security gate.
 */
function resolveTarget(repoRoot: string): string {
  const abs = path.resolve(repoRoot, PERMISSION_KEYS_FILE)
  const expected = path.resolve(repoRoot, "src", "shared", "auth", "permission-keys.ts")
  if (abs !== expected) {
    throw new PatchFailedError(`resolved path ${abs} does not match expected ${expected}`)
  }
  return abs
}

export async function readPermissionKeysFile(repoRoot: string = process.cwd()): Promise<string> {
  return await fs.readFile(resolveTarget(repoRoot), "utf8")
}

export async function writePermissionKeysFile(content: string, repoRoot: string = process.cwd()): Promise<void> {
  await fs.writeFile(resolveTarget(repoRoot), content, "utf8")
}

export const PERMISSION_KEYS_PATH = PERMISSION_KEYS_FILE
