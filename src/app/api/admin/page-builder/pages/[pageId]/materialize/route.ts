/**
 * POST /api/admin/page-builder/pages/<pageId>/materialize
 *
 * Promotes a Page Builder draft from the runtime override store
 * (`messages/_overrides/pages/<pageId>.json`) into committed source under
 * `src/app/(dashboard)/pages/<pageId>/`. Walks the same 7-gate pipeline
 * the entity-builder uses (env kill-switch, CI scan, permission, rate
 * limit, path safety, sandbox typecheck, backup + audit). See
 * `server/file-writer.ts` for the gate breakdown.
 *
 * Refused when:
 *   - `APP_ALLOW_RUNTIME_CODEGEN !== "true"` (404 — endpoint behaves
 *     as if it doesn't exist in production-locked builds).
 *   - The schema has a `customBlock` with an unregistered componentName
 *     (400 — explicit message naming the offending blocks).
 *   - The sandbox `tsc` reports any error against the planned files
 *     (422 — error list returned so the UI can surface them).
 *
 * The route is intentionally NOT idempotent against existing materialized
 * files: it overwrites by default. The on-disk backup snapshot in
 * `.entity-builder-backups/<id>/` is the rollback path.
 */

import { NextResponse, type NextRequest } from "next/server"
import { requirePermission } from "@/app/api/_lib/require-permission"
import { errorReporter } from "@/infra/observability/error-reporter"
import { PERMISSIONS } from "@/shared/auth/permission-keys"
import { readPage } from "@/features/admin-tools/page-builder/server/storage"
import {
  materializePage,
  materializedPageDir,
  MaterializeRefused,
} from "@/features/admin-tools/page-builder/server/file-writer"
import { rollbackFiles } from "@/features/admin-tools/entity-builder/server/file-writer"
import { applyRegistryPatches } from "@/features/admin-tools/registry-updater/server/apply-registry-patches"
import type { PageSchema } from "@/features/admin-tools/page-builder/schema/page-schema"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const RUNTIME_GATE = "APP_ALLOW_RUNTIME_CODEGEN"

function actorOf(session: { user?: { email?: string | null; name?: string | null } | null }): string | null {
  return session.user?.email ?? session.user?.name ?? null
}

/**
 * Translate the page schema's `permission` + `navigation` into the
 * registry-patcher input shape. Both are opt-in: a page without a
 * `navigation` block doesn't auto-register sidebar entry, and the
 * `permission` patch is skipped when the key is a 2-segment prefix
 * that doesn't need a PERMISSIONS map entry.
 */
function deriveRegistryInputs(
  schema: PageSchema,
  overrides: PostBody = {},
): {
  permissionKey?: Parameters<typeof applyRegistryPatches>[0]["permissionKey"]
  navigation?: Parameters<typeof applyRegistryPatches>[0]["navigation"]
} {
  // Body overrides WIN. When the summary card sends a navigation /
  // permissionKey block we use it as-is; otherwise we derive both from
  // the page schema as before.
  if (overrides.navigation || overrides.permissionKey) {
    return {
      navigation: overrides.navigation ?? schemaToNav(schema),
      permissionKey: overrides.permissionKey ?? schemaToPermissionKey(schema),
    }
  }
  return {
    permissionKey: schemaToPermissionKey(schema),
    navigation: schemaToNav(schema),
  }
}

function schemaToPermissionKey(schema: PageSchema) {
  // Permission: only patch when the schema permission has 3+ segments
  // (i.e. ABP-style `Api.Module.Action`). The patcher's input shape needs
  // a derived UPPER_SNAKE identifier — synthesise one from the dotted
  // path so `Api.Page.MyTool.Manage` becomes PAGE_MY_TOOL_MANAGE.
  const segments = schema.permission.split(".")
  return segments.length >= 3
    ? { identifier: toUpperSnake(segments.slice(1).join("_")), value: schema.permission }
    : undefined
}

function schemaToNav(schema: PageSchema) {
  return schema.navigation
    ? {
        group: schema.navigation.group,
        titleKey: `pages.${schema.id}.title`,
        href: schema.navigation.href ?? `/pages/${schema.id}`,
        icon: schema.navigation.icon,
        requiredPermission: schema.permission,
      }
    : undefined
}

function toUpperSnake(s: string): string {
  // "MyTool_Manage" → "MY_TOOL_MANAGE". The input already has underscores
  // separating segments; we only need to split on word boundaries inside
  // each segment.
  return s
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/-/g, "_")
    .toUpperCase()
}

interface PostBody {
  /** Override the navigation block from the page schema. */
  navigation?: Parameters<typeof applyRegistryPatches>[0]["navigation"]
  /** Override the permission patch input from the page schema. */
  permissionKey?: Parameters<typeof applyRegistryPatches>[0]["permissionKey"]
}

async function readBody(request: NextRequest): Promise<PostBody> {
  try {
    const body = (await request.json()) as PostBody
    return body && typeof body === "object" ? body : {}
  } catch {
    return {}
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ pageId: string }> },
): Promise<NextResponse> {
  // Gate 1: production env kill-switch. Behave as 404 in locked builds so
  // the existence of this surface isn't visible to scanners.
  if (process.env[RUNTIME_GATE] !== "true") {
    return NextResponse.json({ error: "Materialize is disabled in this environment" }, { status: 404 })
  }

  // Gate 3: permission (Gate 4: rate-limit handled by middleware).
  const guard = await requirePermission(PERMISSIONS.ADMIN_PAGE_BUILDER)
  if (!guard.ok) return guard.response
  const actor = actorOf(guard.session)

  const { pageId } = await params
  const schema = await readPage(pageId)
  if (!schema) {
    return NextResponse.json({ error: `No saved page "${pageId}"` }, { status: 404 })
  }

  try {
    const result = await materializePage(schema, { actor })

    // After the page files land, patch the registry. Page-builder pages
    // carry both a `permission` key and an optional `navigation` block on
    // the schema itself; the materialize POST body (the summary card)
    // can override either. If the patcher refuses we undo the page files
    // via `rollbackFiles`; the entity-builder backup snapshot remains as
    // a second line of defence for the registry files.
    const body = await readBody(request)
    const patchInputs = deriveRegistryInputs(schema, body)
    const patch = await applyRegistryPatches({ ...patchInputs, dryRun: false, actor })
    if (!patch.ok) {
      await rollbackFiles(result.filesWritten)
      return NextResponse.json(
        {
          error: patch.reason,
          conflictingPath: patch.conflictingPath ?? null,
          rolledBack: true,
          backupId: result.backupId,
        },
        { status: 409 },
      )
    }

    return NextResponse.json({
      ok: true,
      pageId,
      filesWritten: [...result.filesWritten, ...patch.patchedFiles],
      warnings: result.warnings,
      backupId: result.backupId,
      navigationSuggestion: result.navigationSuggestion,
      registryDiffs: patch.diffs,
      materializedAt: materializedPageDir(pageId),
    })
  } catch (err) {
    if (err instanceof MaterializeRefused) {
      const status = err.reason === "unknown-custom-block" ? 400 : err.reason === "typecheck-failed" ? 422 : 500
      return NextResponse.json({ error: err.message, reason: err.reason, details: err.details ?? null }, { status })
    }
    errorReporter.captureException(err, { tags: { source: "page-builder.materialize", pageId } })
    return NextResponse.json({ error: "Materialize failed" }, { status: 500 })
  }
}
