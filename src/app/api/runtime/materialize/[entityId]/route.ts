/**
 * POST /api/runtime/materialize/<entityId>
 *
 * Promote a runtime entity (live JSON in messages/_overrides/runtime/) into
 * a real source-tree entity (generated .config.ts/.service.ts/.schema.ts/
 * .types.ts and the route pages under src/app/(dashboard)/<plural>/).
 *
 * Two phases, both gated by permission + the same env switch the
 * /api/admin/entity-builder pipeline already uses:
 *
 *   ?dryRun=true  → returns the planned diff. Read-only. No files written,
 *                   no audit row, no runtime entity removed.
 *   (no flag)     → typecheck → snapshot existing files → write → bump
 *                   registry → remove runtime entity → audit. Same pipeline
 *                   as /api/admin/entity-builder/generate uses; we just feed
 *                   it a schema derived from the runtime JSON.
 *
 * Permission: `Api.Admin.EntityBuilder` (the existing entity-builder gate;
 * matches Task A2's intent of `Api.EntityBuilder.Manage` — repo's actual
 * key wins).
 *
 * Env gate: APP_ALLOW_RUNTIME_CODEGEN=true. Without it, materialize is
 * refused — same posture as the entity-builder route.
 */

import { NextResponse, type NextRequest } from "next/server"
import { logger } from "@/shared/logger"
import { requirePermission } from "@/app/api/_lib/require-permission"
import { codegenAllowed } from "@/app/api/_lib/codegen-gate"
import { planGeneration, type CodeGenPlan } from "@/features/admin-tools/entity-builder/server/code-generator"
import {
  persistGeneration,
  rollbackFiles,
  WriteAborted,
} from "@/features/admin-tools/entity-builder/server/file-writer"
import { snapshotFiles } from "@/features/admin-tools/entity-builder/server/backup"
import { applyRegistryPatches } from "@/features/admin-tools/registry-updater/server/apply-registry-patches"
import { PERMISSION_KEYS_PATH } from "@/features/admin-tools/registry-updater/server/permission-keys-patcher"
import { NAVIGATION_PATH } from "@/features/admin-tools/registry-updater/server/navigation-patcher"
import { typecheckPlannedFiles } from "@/features/admin-tools/entity-builder/server/typecheck"
import { diffPlannedFiles } from "@/features/admin-tools/entity-builder/server/diff"
import { appendAudit, hashSchema } from "@/features/admin-tools/entity-builder/server/audit"
import {
  entityBuilderSchema,
  type EntityBuilderSchema,
} from "@/features/admin-tools/entity-builder/types/builder-schema"
import { toKebabCase } from "@/features/admin-tools/entity-builder/server/derivations"
import { mapRuntimeEntityToBuilderSchema } from "@/features/runtime-builder/materialize/runtime-to-builder-schema"
import type { RuntimeEntity } from "@/features/runtime-builder/types"
import { isValidEntityId } from "../../_lib/constants"
import { deleteEntityDataFile, readConfig, removeEntityFromConfig } from "../../_lib/storage"
import type { ExtendedSession } from "@/shared/types"
import { PERMISSIONS } from "@/shared/auth/permission-keys"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const MANAGE_PERMISSION = PERMISSIONS.ADMIN_ENTITY_BUILDER
const RUNTIME_GATE = "APP_ALLOW_RUNTIME_CODEGEN"

type RouteContext = { params: Promise<{ entityId: string }> }

interface PostBody {
  /** Folder under src/domains/ to write into. Defaults to "runtime". */
  domain?: string
  /** Honored to overwrite an existing entity of the same name. */
  force?: boolean
  /**
   * Registry-metadata overrides from the materialize summary card. When
   * absent the route falls back to `deriveRegistryInputs` defaults
   * (Part 3.1). When present the patcher receives these verbatim —
   * Zod-shape validation lives inside the patcher modules themselves.
   */
  navigation?: Parameters<typeof applyRegistryPatches>[0]["navigation"]
  permissionKey?: Parameters<typeof applyRegistryPatches>[0]["permissionKey"]
}

function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 })
}

function notFound(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 404 })
}

function actorOf(session: ExtendedSession): string | null {
  return session.user?.email ?? session.user?.name ?? null
}

async function resolveRuntimeEntity(
  context: RouteContext,
): Promise<{ entityId: string; entity: RuntimeEntity } | { error: NextResponse }> {
  const { entityId } = await context.params
  if (!isValidEntityId(entityId)) return { error: badRequest("Invalid entityId") }
  const config = await readConfig()
  const entities = Array.isArray(config.entities) ? (config.entities as RuntimeEntity[]) : []
  const entity = entities.find(e => e.id === entityId)
  if (!entity) return { error: notFound(`Runtime entity "${entityId}" not found`) }
  return { entityId, entity }
}

/**
 * Default-everything-then-override derivation of the two registry-patcher
 * inputs from a materialized EntityBuilderSchema. Returns the SAME shape
 * applyRegistryPatches accepts (both keys optional). Defaults follow the
 * spec's "opt-in for permissionKey, auto for navigation" stance:
 *
 *   - permissionKey: undefined. Most generated entities use 2-segment
 *     "Api.<Pascal>" prefixes (e.g. "Api.Brand") that don't need a
 *     PERMISSIONS map entry; the lint rule for nav configs accepts the
 *     prefix directly. Setting this requires a fully-qualified key —
 *     three or more segments like "Api.Brand.Approve".
 *   - navigation: { group: "nav.operations", titleKey: "pages.<plural>.title",
 *     href: "/<plural>", icon: "Box", order: 99 }. Generated entities
 *     land under the operations sidebar group; the admin can move them
 *     by hand later.
 */
function deriveRegistryInputs(
  schema: EntityBuilderSchema,
  overrides: { navigation?: PostBody["navigation"]; permissionKey?: PostBody["permissionKey"] } = {},
): {
  permissionKey?: Parameters<typeof applyRegistryPatches>[0]["permissionKey"]
  navigation?: Parameters<typeof applyRegistryPatches>[0]["navigation"]
} {
  // Body-supplied values WIN over schema-derived defaults. The summary
  // card always sends a complete navigation block, so when it's present
  // we use it as-is. permissionKey is opt-in either way.
  return {
    navigation: overrides.navigation ?? {
      group: "nav.operations",
      titleKey: `pages.${schema.entityName}.title`,
      href: `/${schema.entityNamePlural}`,
      icon: "Box",
      requiredPermission: schema.permissionKey,
    },
    permissionKey: overrides.permissionKey,
  }
}

function deriveSchema(
  entity: RuntimeEntity,
  body: PostBody,
): { ok: true; schema: EntityBuilderSchema } | { ok: false; response: NextResponse } {
  const candidate = mapRuntimeEntityToBuilderSchema(entity, { domain: body.domain })
  const parsed = entityBuilderSchema.safeParse(candidate)
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Mapped schema failed validation", issues: parsed.error.issues },
        { status: 422 },
      ),
    }
  }
  return { ok: true, schema: parsed.data }
}

async function readBody(request: NextRequest): Promise<PostBody> {
  try {
    const body = (await request.json()) as PostBody
    return body && typeof body === "object" ? body : {}
  } catch {
    return {}
  }
}

// ─── POST ───────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const guard = await requirePermission(MANAGE_PERMISSION)
  if (!guard.ok) return guard.response

  const dryRun = request.nextUrl.searchParams.get("dryRun") === "true"
  // Writing source is dev-only (false in production even with the flag set).
  // dryRun previews stay available everywhere — they touch no files.
  const runtimeMode = codegenAllowed()

  if (!dryRun && !runtimeMode) {
    return NextResponse.json({ error: `Materialize is disabled (set ${RUNTIME_GATE}=true).` }, { status: 409 })
  }

  const resolved = await resolveRuntimeEntity(context)
  if ("error" in resolved) return resolved.error

  const body = await readBody(request)

  const derived = deriveSchema(resolved.entity, body)
  if (!derived.ok) return derived.response

  const plan: CodeGenPlan = planGeneration(derived.schema)

  // Diff is cheap and useful in both modes — admins see the same preview
  // whether they hit ?dryRun=true first or just run the materialize and
  // get the diff alongside the success response.
  const diff = await diffPlannedFiles(plan.files)

  // Registry-patch inputs: body overrides win over schema-derived
  // defaults. The summary card always sends a complete navigation block;
  // permissionKey is opt-in (only 3+ ABP segments get registered).
  const registryInputs = deriveRegistryInputs(derived.schema, {
    navigation: body.navigation,
    permissionKey: body.permissionKey,
  })

  if (dryRun) {
    const registryPreview = await applyRegistryPatches({ ...registryInputs, dryRun: true })
    return NextResponse.json({
      mode: "preview",
      schema: derived.schema,
      plan: {
        entityName: plan.entityName,
        files: plan.files.map(f => ({ path: f.path })),
      },
      diff,
      registryDiffs: registryPreview.ok ? registryPreview.diffs : [],
      registryDiffsError: registryPreview.ok ? null : registryPreview.reason,
    })
  }

  // Real write. Mirror the safety gates the entity-builder route uses.
  const schemaHashed = hashSchema(derived.schema)
  const actor = actorOf(guard.session)

  const typecheck = await typecheckPlannedFiles(plan.files)
  if (!typecheck.ok) {
    await appendAudit({
      timestamp: new Date().toISOString(),
      actor,
      entityName: derived.schema.entityName,
      schemaHash: schemaHashed,
      outcome: "refused",
      filesWritten: 0,
      warnings: 0,
      error: "typecheck failed",
      backupId: null,
    })
    return NextResponse.json(
      { error: "Typecheck failed for planned files", typecheckErrors: typecheck.errors },
      { status: 422 },
    )
  }

  let snapshotId: string | null = null
  try {
    // Snapshot the entity files AND the two registry files. Adding the
    // registry paths here means a future "restore from snapshot" UX
    // rolls back navigation.ts / permission-keys.ts in addition to the
    // entity source.
    const snap = await snapshotFiles([...plan.files.map(f => f.path), PERMISSION_KEYS_PATH, NAVIGATION_PATH])
    snapshotId = snap.id
  } catch (err) {
    logger.warn("[runtime-materialize] backup snapshot failed:", err)
  }

  return runMaterializeWrite({
    plan,
    schema: derived.schema,
    body,
    registryInputs,
    snapshotId,
    schemaHashed,
    actor,
    diff,
    runtimeEntityId: resolved.entityId,
  })
}

interface MaterializeWriteCtx {
  plan: CodeGenPlan
  schema: EntityBuilderSchema
  body: PostBody
  registryInputs: ReturnType<typeof deriveRegistryInputs>
  snapshotId: string | null
  schemaHashed: string
  actor: string | null
  diff: Awaited<ReturnType<typeof diffPlannedFiles>>
  runtimeEntityId: string
}

async function runMaterializeWrite(ctx: MaterializeWriteCtx): Promise<NextResponse> {
  try {
    const result = await persistGeneration(ctx.plan, { force: !!ctx.body.force })

    // After entity files land, patch the two registry files. The patcher
    // owns its own byte-level rollback for permission-keys/navigation;
    // we own the entity-file unlink if it refuses.
    const patch = await applyRegistryPatches({ ...ctx.registryInputs, dryRun: false, actor: ctx.actor })
    if (!patch.ok) {
      await rollbackFiles(result.filesWritten)
      await auditOutcome(ctx, "failure", 0, `registry-patch refused: ${patch.reason}`)
      return NextResponse.json(
        {
          error: patch.reason,
          conflictingPath: patch.conflictingPath ?? null,
          rolledBack: true,
          backupId: ctx.snapshotId,
        },
        { status: 409 },
      )
    }

    await removeEntityFromConfig(ctx.runtimeEntityId)
    await deleteEntityDataFile(ctx.runtimeEntityId)

    await auditOutcome(ctx, "success", result.filesWritten.length + patch.patchedFiles.length, null)

    return NextResponse.json({
      success: true,
      mode: "materialize",
      route: `/${toKebabCase(ctx.schema.entityNamePlural)}`,
      files: [...result.filesWritten, ...patch.patchedFiles],
      warnings: result.warnings,
      backupId: ctx.snapshotId,
      diff: ctx.diff,
      registryDiffs: patch.diffs,
    })
  } catch (err) {
    const detail =
      err instanceof WriteAborted ? `${err.message}: ${(err.cause as Error)?.message ?? ""}` : (err as Error).message
    logger.error("[runtime-materialize] write failed:", err)
    await auditOutcome(ctx, "failure", 0, detail)
    const status = detail.includes("already exists") ? 409 : 500
    return NextResponse.json({ error: detail }, { status })
  }
}

async function auditOutcome(
  ctx: MaterializeWriteCtx,
  outcome: "success" | "failure",
  filesWritten: number,
  error: string | null,
): Promise<void> {
  await appendAudit({
    timestamp: new Date().toISOString(),
    actor: ctx.actor,
    entityName: ctx.schema.entityName,
    schemaHash: ctx.schemaHashed,
    outcome,
    filesWritten,
    warnings: 0,
    error,
    backupId: ctx.snapshotId,
  })
}
