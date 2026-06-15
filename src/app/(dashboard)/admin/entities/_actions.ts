/**
 * Server Actions for /admin/entities.
 *
 * Server Actions are RPC endpoints exposed over the same network surface
 * as routes — the "use server" pragma is the only thing that flags them
 * as remotely callable. That means every gate the route handler enforces
 * (env, NODE_ENV, permission, input shape) MUST be re-checked here.
 * Trusting the client is never safe; the client can craft an arbitrary
 * POST to the action's hidden endpoint.
 *
 * Failure shape: we DELIBERATELY return `{ ok: false, ... }` rather than
 * throw. A thrown error in a Server Action surfaces as an opaque "Server
 * Error" in the React error boundary — bad UX for refusals that should
 * be shown as a user message ("brand uses external renderers"). Throwing
 * is reserved for unexpected failures (network, programmer error).
 */

"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/infra/auth/server"
import { PERMISSIONS } from "@/shared/auth/permission-keys"
import { convertStaticEntity } from "@/app/api/admin/entities/[entityName]/convert/_lib/convert"
import { restoreStaticEntity } from "@/app/api/admin/entities/[entityName]/restore/_lib/restore"
import { logger } from "@/shared/logger"
import type { ExtendedSession } from "@/shared/types"

const ENTITY_NAME_PATTERN = /^[a-z][a-z0-9-]{0,40}$/
const BACKUP_ID_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/
const RUNTIME_GATE = "APP_ALLOW_RUNTIME_CODEGEN"

// Result type mirrors the convert route's HTTP responses: success carries
// the redirect target, the two failure modes are distinct so the client
// can render the right message.
export interface ActionSuccess {
  ok: true
  runtimeEntityId: string
  backupId: string
  redirectTo: string
  migratedI18nKeyCount: number
  /** Source files unlinked by the convert flow — surfaces in the
   *  post-save toast count on the client. */
  deletedFiles: readonly string[]
}

export interface ActionRefusal {
  ok: false
  reason: string
  filePath?: string
}

export type ActionResult = ActionSuccess | ActionRefusal

function refusal(reason: string, filePath?: string): ActionRefusal {
  return filePath ? { ok: false, reason, filePath } : { ok: false, reason }
}

async function isAdmin(): Promise<{ ok: true; actor: string | null } | { ok: false }> {
  const session = (await auth()) as ExtendedSession | null
  if (!session?.user) return { ok: false }
  const roles = session.user.roles ?? []
  if (!roles.includes("admin")) return { ok: false }
  // We don't fetch ABP-granted permissions here (the route handler does
  // that for non-admin paths). Server Actions are admin-only by design
  // — broaden if a use case emerges.
  return { ok: true, actor: session.user.email ?? session.user.name ?? null }
}

export async function convertEntityAction(entityName: string): Promise<ActionResult> {
  // Defence-in-depth: re-check the env gate FIRST so a leaked action ID
  // can't ever trigger a write outside opt-in environments.
  if (process.env.NODE_ENV === "production") {
    return refusal("This action is disabled in production builds.")
  }
  if (process.env[RUNTIME_GATE] !== "true") {
    return refusal(`This action is disabled (set ${RUNTIME_GATE}=true to enable).`)
  }

  if (typeof entityName !== "string" || !ENTITY_NAME_PATTERN.test(entityName)) {
    return refusal("Invalid entityName")
  }

  const guard = await isAdmin()
  if (!guard.ok) return refusal("You don't have permission to perform this action.")

  const used = PERMISSIONS.ADMIN_ENTITY_BUILDER
  // Reference PERMISSIONS so the import isn't tree-shaken — keeps the
  // permission-keys source in scope for future ABP-grant checks here.
  if (!used) return refusal("Permission registry missing entity-builder key.")

  const result = await convertStaticEntity(entityName, { actor: guard.actor })

  if (!result.ok) {
    if (result.status === 422) return refusal(result.reason, result.filePath)
    logger.error("[convertEntityAction] failed", { entityName, error: result.error })
    return refusal(result.error)
  }

  // Refresh the SSR snapshot so the table immediately reflects the new
  // runtime entity (and the now-deleted static entry) without a hard nav.
  revalidatePath("/admin/entities")

  return {
    ok: true,
    runtimeEntityId: result.runtimeEntityId,
    backupId: result.backupId,
    redirectTo: result.redirectTo,
    migratedI18nKeyCount: result.migratedI18nKeyCount,
    deletedFiles: result.deletedFiles,
  }
}

// ─── Restore (inverse of convert) ──────────────────────────────────────────

export interface RestoreActionSuccess {
  ok: true
  restoredFiles: readonly string[]
  removedRuntimeId: string
  migratedI18nKeyCount: number
  safetyBackupId: string
}

export type RestoreActionResult = RestoreActionSuccess | ActionRefusal

export async function restoreConvertAction(entityName: string, backupId: string): Promise<RestoreActionResult> {
  if (process.env.NODE_ENV === "production") {
    return refusal("This action is disabled in production builds.")
  }
  if (process.env[RUNTIME_GATE] !== "true") {
    return refusal(`This action is disabled (set ${RUNTIME_GATE}=true to enable).`)
  }

  if (typeof entityName !== "string" || !ENTITY_NAME_PATTERN.test(entityName)) {
    return refusal("Invalid entityName")
  }
  if (typeof backupId !== "string" || !BACKUP_ID_PATTERN.test(backupId)) {
    return refusal("Invalid backupId")
  }

  const guard = await isAdmin()
  if (!guard.ok) return refusal("You don't have permission to perform this action.")

  const result = await restoreStaticEntity(entityName, { backupId, dryRun: false, actor: guard.actor })

  if (!result.ok) {
    if (result.status === 422) return refusal(result.reason)
    logger.error("[restoreConvertAction] failed", { entityName, backupId, error: result.error })
    return refusal(
      result.partialState === "half-restored"
        ? `Restore failed AND rollback failed — hand-recover from snapshots. ${result.error}`
        : result.error,
    )
  }

  revalidatePath("/admin/entities")

  return {
    ok: true,
    restoredFiles: result.restoredFiles,
    removedRuntimeId: result.removedRuntimeId,
    migratedI18nKeyCount: result.migratedI18nKeyCount,
    safetyBackupId: result.safetyBackupId,
  }
}
