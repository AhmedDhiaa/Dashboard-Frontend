/**
 * Transactional applier for the two registry patchers.
 *
 *   applyRegistryPatches({ permissionKey?, navigation?, dryRun, actor })
 *
 * Combines `applyPermissionKeyPatch` (src/shared/auth/permission-keys.ts)
 * and `applyNavigationPatch` (src/shared/config/navigation.ts) under one
 * dry-run-or-apply contract with internal byte-level rollback.
 *
 * Why an internal rollback when the caller already snapshots?
 *
 * The materialize route's snapshot is a coarse second line of defence
 * — it captures everything the operation might touch, restored via
 * `restoreSnapshot(id)`. This module owns the FIRST line: read the
 * pre-call bytes for the two specific files we mutate, write them back
 * if either patcher fails. Two reasons:
 *
 *   1. Locality: the route handler doesn't have to know which files
 *      this module mutates. Adding a third registry file later is one
 *      change, here.
 *   2. Failure-mode signal: when the route sees `{ ok: false, … }` from
 *      us it KNOWS the registry files are byte-identical to before the
 *      call. The snapshot fallback only matters if THIS module's
 *      rollback itself fails — which only happens on a disk fault and
 *      is logged loudly.
 *
 * Idempotency: if both patches already match (no changes needed), we
 * return `{ ok: true, diffs: [], patchedFiles: [] }`. Callers don't
 * special-case it.
 */

import { promises as fs } from "node:fs"
import path from "node:path"
import { logger } from "@/shared/logger"
import { assertSafePath } from "@/shared/utils/safe-path"
import {
  applyPermissionKeyPatch,
  PERMISSION_KEYS_PATH,
  readPermissionKeysFile,
  writePermissionKeysFile,
} from "./permission-keys-patcher"
import type { PatchInput as PermissionPatchInput } from "./permission-keys-patcher"
import {
  applyNavigationPatch,
  NAVIGATION_PATH,
  readNavigationFile,
  writeNavigationFile,
  type NavPatchInput,
} from "./navigation-patcher"

// ─── Public surface ─────────────────────────────────────────────────────────

export interface ApplyRegistryPatchesInput {
  /** When provided, registers a PERMISSIONS entry. Skip for 2-segment keys. */
  permissionKey?: PermissionPatchInput
  /** When provided, registers a sidebar nav entry. */
  navigation?: NavPatchInput
  /** When true, compute diffs without writing. */
  dryRun: boolean
  /** Audit actor; passed through verbatim. */
  actor?: string | null
}

export interface RegistryDiff {
  /** Project-relative path of the file the diff applies to. */
  path: string
  /** Unified-style hint: a single-line snippet of what was/would-be inserted. */
  diff: string
}

export interface ApplyOk {
  ok: true
  /** Empty array when both patches no-op. */
  diffs: RegistryDiff[]
  /** Files actually written (dryRun → always empty). */
  patchedFiles: string[]
}

export interface ApplyFailure {
  ok: false
  reason: string
  /** Set when the failure is attributable to one specific patch target. */
  conflictingPath?: string
}

export type ApplyResult = ApplyOk | ApplyFailure

const AUDIT_FILE = path.join(".entity-builder-backups", "_audit.jsonl")

// ─── Entry point ────────────────────────────────────────────────────────────

export async function applyRegistryPatches(input: ApplyRegistryPatchesInput): Promise<ApplyResult> {
  // Read pre-call bytes via the patcher modules' own helpers. They resolve
  // each target's absolute path via a `resolveTarget` guard (string-equal
  // to the expected location) — keeping registry path resolution as the
  // patchers' single responsibility, and avoiding `assertSafePath` since
  // `src/shared/...` lives outside its ALLOWED_ROOTS.
  const original = await readBoth()
  if (!original.ok) return original.failure

  // Run the patchers in memory first. Both throw on collision / shape
  // failure — we catch and translate to `{ ok: false }`.
  const planned = computePatches(original.permSource, original.navSource, input)
  if (!planned.ok) {
    await appendAudit(input.actor, "refused", [], planned.reason, planned.conflictingPath)
    return planned
  }

  if (input.dryRun) {
    return { ok: true, diffs: planned.diffs, patchedFiles: [] }
  }

  // Real write. If the second write fails, restore the first from its
  // pre-call bytes. Even if there's nothing to write (idempotent no-op),
  // we still return the same shape.
  const patchedFiles: string[] = []
  try {
    if (planned.permChanged) {
      await writePermissionKeysFile(planned.permContent)
      patchedFiles.push(PERMISSION_KEYS_PATH)
    }
    if (planned.navChanged) {
      await writeNavigationFile(planned.navContent)
      patchedFiles.push(NAVIGATION_PATH)
    }
    await appendAudit(input.actor, "applied", patchedFiles, null)
    return { ok: true, diffs: planned.diffs, patchedFiles }
  } catch (err) {
    const reason = (err as Error).message
    await restoreOriginalBytes(original.permSource, original.navSource)
    await appendAudit(input.actor, "rolled-back", patchedFiles, reason)
    return { ok: false, reason: `Patch write failed: ${reason}` }
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function readBoth(): Promise<
  { ok: true; permSource: string; navSource: string } | { ok: false; failure: ApplyFailure }
> {
  try {
    const [permSource, navSource] = await Promise.all([readPermissionKeysFile(), readNavigationFile()])
    return { ok: true, permSource, navSource }
  } catch (err) {
    return {
      ok: false,
      failure: { ok: false, reason: `Failed to read registry source: ${(err as Error).message}` },
    }
  }
}

interface PlannedPatches {
  ok: true
  permContent: string
  permChanged: boolean
  navContent: string
  navChanged: boolean
  diffs: RegistryDiff[]
}

function computePatches(
  permSource: string,
  navSource: string,
  input: ApplyRegistryPatchesInput,
): PlannedPatches | ApplyFailure {
  const diffs: RegistryDiff[] = []
  let permContent = permSource
  let permChanged = false
  let navContent = navSource
  let navChanged = false

  if (input.permissionKey) {
    try {
      const r = applyPermissionKeyPatch(permSource, input.permissionKey)
      permContent = r.content
      permChanged = r.changed
      if (r.changed && r.insertionSnippet) diffs.push({ path: PERMISSION_KEYS_PATH, diff: r.insertionSnippet })
    } catch (err) {
      return { ok: false, reason: `permission-keys: ${(err as Error).message}`, conflictingPath: PERMISSION_KEYS_PATH }
    }
  }

  if (input.navigation) {
    try {
      const r = applyNavigationPatch(navSource, input.navigation)
      navContent = r.content
      navChanged = r.changed
      if (r.changed && r.insertionSnippet) diffs.push({ path: NAVIGATION_PATH, diff: r.insertionSnippet })
    } catch (err) {
      return { ok: false, reason: `navigation: ${(err as Error).message}`, conflictingPath: NAVIGATION_PATH }
    }
  }

  return { ok: true, permContent, permChanged, navContent, navChanged, diffs }
}

async function restoreOriginalBytes(permOriginal: string, navOriginal: string): Promise<void> {
  // We don't know which of the two writes succeeded before the throw,
  // so write BOTH back. The patchers are byte-preservation safe, so the
  // restored content equals the pre-call source even at the byte level.
  try {
    await writePermissionKeysFile(permOriginal)
    await writeNavigationFile(navOriginal)
  } catch (err) {
    // Restoration failure is the worst case — the source tree is left
    // half-mutated. Log loudly so the admin can hand-restore from the
    // route-level snapshot. We swallow the error so the caller still
    // sees the ORIGINAL failure reason from applyRegistryPatches.
    logger.error("[apply-registry-patches] restoration failed; admin should restore from snapshot", err)
  }
}

interface AuditEntry {
  ts: string
  actor: string | null
  kind: "registry-patch"
  outcome: "applied" | "refused" | "rolled-back"
  paths: string[]
  error: string | null
  conflictingPath?: string
}

async function appendAudit(
  actor: string | null | undefined,
  outcome: AuditEntry["outcome"],
  paths: string[],
  error: string | null,
  conflictingPath?: string,
): Promise<void> {
  const entry: AuditEntry = {
    ts: new Date().toISOString(),
    actor: actor ?? null,
    kind: "registry-patch",
    outcome,
    paths,
    error,
    ...(conflictingPath ? { conflictingPath } : {}),
  }
  try {
    const safe = assertSafePath(AUDIT_FILE)
    await fs.mkdir(path.dirname(safe), { recursive: true })
    await fs.appendFile(safe, JSON.stringify(entry) + "\n", "utf8")
  } catch (err) {
    // Audit is best-effort. The patch itself succeeded — refusing the
    // whole operation because an audit log line couldn't write would
    // be a poor trade.
    logger.warn("[apply-registry-patches] audit append failed", err)
  }
}
