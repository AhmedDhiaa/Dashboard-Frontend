/**
 * POST /api/admin/entity-builder/generate
 *
 * Two operating modes, picked by the env var
 * `APP_ALLOW_RUNTIME_CODEGEN`:
 *
 * • "true"  — runtime codegen mode. Writes the generated source files,
 *             merges i18n keys into messages/{en,ar}/pages.json, runs
 *             `npm run init-entities`, and (best-effort) `eslint --fix`.
 *             Every multi-file write is wrapped in a transactional
 *             rollback — any failure unlinks every file already written.
 *
 * • else    — draft-only mode (the default; what production uses).
 *             Persists the validated schema to
 *             `messages/_overrides/entity-builder/<entityName>.json` and
 *             returns. The runtime never mutates `src/` in this mode.
 *
 * Every attempt — accepted, refused, succeeded, failed — appends a JSONL
 * audit row to `messages/_overrides/entity-builder/_audit.jsonl` with
 * actor, schema hash, file count, outcome.
 */

import { promises as fs } from "node:fs"
import path from "node:path"
import { NextResponse, type NextRequest } from "next/server"
import { logger } from "@/shared/logger"
import {
  entityBuilderSchema,
  type EntityBuilderSchema,
} from "@/features/admin-tools/entity-builder/types/builder-schema"
import { requirePermission } from "@/app/api/_lib/require-permission"
import { codegenAllowed } from "@/app/api/_lib/codegen-gate"
import { assertSafePath } from "@/shared/utils/safe-path"
import { planGeneration } from "@/features/admin-tools/entity-builder/server/code-generator"
import {
  persistGeneration,
  deleteGeneration,
  WriteAborted,
} from "@/features/admin-tools/entity-builder/server/file-writer"
import { appendAudit, hashSchema, type AuditOutcome } from "@/features/admin-tools/entity-builder/server/audit"
import { snapshotFiles } from "@/features/admin-tools/entity-builder/server/backup"
import { typecheckPlannedFiles } from "@/features/admin-tools/entity-builder/server/typecheck"
import { toKebabCase } from "@/features/admin-tools/entity-builder/server/derivations"
import type { ExtendedSession } from "@/shared/types"
import { PERMISSIONS } from "@/shared/auth/permission-keys"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// Tightened in Task 25 — only super-admins should hold the EntityBuilder
// permission. The earlier `Api.EntityBuilder.Manage` key remains usable in
// the backend permission catalog but the gate now demands the stronger key.
const MANAGE_PERMISSION = PERMISSIONS.ADMIN_ENTITY_BUILDER
const DRAFT_DIR = path.join(process.cwd(), "messages", "_overrides", "entity-builder")
const RUNTIME_GATE = "APP_ALLOW_RUNTIME_CODEGEN"

type GenerateMode = "create" | "update" | "delete"

interface PostBody {
  /** Defaults to 'create' when omitted (back-compat with earlier clients). */
  mode?: GenerateMode
  schema?: unknown
  /** Honored on mode='create' to overwrite (becomes implicit on 'update'). */
  force?: boolean
}

function actorOf(session: ExtendedSession): string | null {
  return session.user?.email ?? session.user?.name ?? null
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const guard = await requirePermission(MANAGE_PERMISSION)
  if (!guard.ok) return guard.response

  const body = await parseBody(request)
  if ("error" in body) return body.error

  const parsed = entityBuilderSchema.safeParse(body.payload.schema ?? body.payload)
  if (!parsed.success) {
    return NextResponse.json({ error: "Schema invalid", issues: parsed.error.issues }, { status: 400 })
  }

  const schema = parsed.data
  const actor = actorOf(guard.session)
  const schemaHashed = hashSchema(schema)
  // Source-write codegen is dev-only: in production (even with the flag set)
  // this is false, so the route falls back to the safe draft path below.
  const runtimeMode = codegenAllowed()
  const mode: GenerateMode = body.payload.mode ?? "create"

  if (mode === "delete") {
    if (!runtimeMode) {
      return NextResponse.json(
        { error: `Delete only runs in runtime mode (set ${RUNTIME_GATE}=true).` },
        { status: 409 },
      )
    }
    return handleDelete(schema, schemaHashed, actor)
  }

  if (runtimeMode) {
    // 'update' is just 'create' with force=true — admins editing an
    // existing entity are intentionally overwriting their own work.
    const force = mode === "update" || !!body.payload.force
    return handleRuntimeWrite(schema, schemaHashed, actor, force)
  }
  return handleDraftSave(schema, schemaHashed, actor)
}

async function handleDelete(
  schema: EntityBuilderSchema,
  schemaHashed: string,
  actor: string | null,
): Promise<NextResponse> {
  try {
    const plan = planGeneration(schema)
    const result = await deleteGeneration(plan)
    // Best-effort: clean the saved draft JSON so the dashboard list
    // doesn't keep showing a now-deleted entity.
    // schema.entityName is regex-validated by entityBuilderSchema before
    // we ever reach this point; assertSafePath enforces the contract
    // regardless.
    const draftPath = assertSafePath(path.join(DRAFT_DIR, `${schema.entityName}.json`))
    try {
      await fs.unlink(draftPath)
    } catch {
      /* draft may not exist if entity was created before drafts were a thing */
    }
    await audit(
      actor,
      schema.entityName,
      schemaHashed,
      "success",
      result.filesRemoved.length,
      result.warnings.length,
      null,
    )
    return NextResponse.json({
      success: true,
      mode: "delete",
      filesRemoved: result.filesRemoved,
      warnings: result.warnings,
    })
  } catch (err) {
    logger.error("[entity-builder] delete failed:", err)
    await audit(actor, schema.entityName, schemaHashed, "failure", 0, 0, (err as Error).message)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

async function parseBody(request: NextRequest): Promise<{ payload: PostBody } | { error: NextResponse }> {
  try {
    return { payload: (await request.json()) as PostBody }
  } catch {
    return { error: NextResponse.json({ error: "Body must be JSON" }, { status: 400 }) }
  }
}

async function handleRuntimeWrite(
  schema: EntityBuilderSchema,
  schemaHashed: string,
  actor: string | null,
  force: boolean,
): Promise<NextResponse> {
  const plan = planGeneration(schema)

  // Safety gate 1: typecheck the planned files in a sandboxed tsconfig.
  // Refuses to write source the compiler will reject.
  const typecheck = await typecheckPlannedFiles(plan.files)
  if (!typecheck.ok) {
    await audit(actor, schema.entityName, schemaHashed, "refused", 0, 0, "typecheck failed")
    return NextResponse.json(
      { error: "Typecheck failed for planned files", typecheckErrors: typecheck.errors },
      { status: 422 },
    )
  }

  // Safety gate 2: snapshot every existing target file so a botched write
  // is reversible from the dashboard. Snapshot id is surfaced in the
  // response and recorded in the audit row.
  let snapshotId: string | null = null
  try {
    const snap = await snapshotFiles(plan.files.map(f => f.path))
    snapshotId = snap.id
  } catch (err) {
    logger.warn("[entity-builder] backup snapshot failed:", err)
  }

  try {
    const result = await persistGeneration(plan, { force })
    await audit(
      actor,
      schema.entityName,
      schemaHashed,
      "success",
      result.filesWritten.length,
      result.warnings.length,
      null,
      snapshotId,
    )
    // Returned to the wizard so it can router.push() the admin straight to
    // the freshly-written list page. Next.js dev's file watcher already
    // picked up the new page.tsx + the regenerated entity-init module that
    // `npm run init-entities` produced inside persistGeneration, so the
    // navigation resolves on the client's next request.
    const route = `/${toKebabCase(schema.entityNamePlural)}`
    return NextResponse.json({
      success: true,
      mode: "runtime",
      files: result.filesWritten,
      warnings: result.warnings,
      route,
      backupId: snapshotId,
    })
  } catch (err) {
    const detail =
      err instanceof WriteAborted ? `${err.message}: ${(err.cause as Error)?.message ?? ""}` : (err as Error).message
    logger.error("[entity-builder] runtime write failed:", err)
    await audit(actor, schema.entityName, schemaHashed, "failure", 0, 0, detail)
    const status = detail.includes("already exists") ? 409 : 500
    return NextResponse.json({ error: detail }, { status })
  }
}

async function handleDraftSave(
  schema: EntityBuilderSchema,
  schemaHashed: string,
  actor: string | null,
): Promise<NextResponse> {
  try {
    await fs.mkdir(assertSafePath(DRAFT_DIR), { recursive: true })
    const filePath = assertSafePath(path.join(DRAFT_DIR, `${schema.entityName}.json`))
    await fs.writeFile(filePath, JSON.stringify(schema, null, 2) + "\n")
    await audit(actor, schema.entityName, schemaHashed, "refused", 0, 0, null)
    return NextResponse.json({
      success: true,
      mode: "draft",
      savedTo: path.relative(process.cwd(), filePath).replace(/\\/g, "/"),
      message: `Schema saved as draft. Set ${RUNTIME_GATE}=true and re-POST to write source files.`,
    })
  } catch (err) {
    logger.error("[entity-builder] draft save failed:", err)
    await audit(actor, schema.entityName, schemaHashed, "failure", 0, 0, (err as Error).message)
    return NextResponse.json({ error: "Failed to persist schema" }, { status: 500 })
  }
}

async function audit(
  actor: string | null,
  entityName: string,
  schemaHashed: string,
  outcome: AuditOutcome,
  filesWritten: number,
  warnings: number,
  error: string | null,
  backupId: string | null = null,
): Promise<void> {
  await appendAudit({
    timestamp: new Date().toISOString(),
    actor,
    entityName,
    schemaHash: schemaHashed,
    outcome,
    filesWritten,
    warnings,
    error,
    backupId,
  })
}
