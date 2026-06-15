/**
 * GET    /api/admin/widget-builder/[id] — fetch the saved widget by id
 * DELETE /api/admin/widget-builder/[id] — remove draft + (runtime mode)
 *                                          unlink the .widget.ts file
 */

import { promises as fs } from "node:fs"
import path from "node:path"
import { NextResponse } from "next/server"
import { logger } from "@/shared/logger"
import { widgetBuilderSchema } from "@/features/admin-tools/widget-builder/types/widget-schema"
import { requirePermission } from "@/app/api/_lib/require-permission"
import { assertSafePath } from "@/shared/utils/safe-path"
import { PERMISSIONS } from "@/shared/auth/permission-keys"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const MANAGE_PERMISSION = PERMISSIONS.ADMIN_WIDGET_BUILDER
const DRAFT_DIR = path.join(process.cwd(), "messages", "_overrides", "widget-builder")
const RUNTIME_GATE = "APP_ALLOW_RUNTIME_CODEGEN"

const ID_RE = /^[a-z][a-z0-9-]*$/

function draftPathFor(id: string): string {
  // Defence in depth: ID_RE already restricts `id` to kebab-case at the
  // route, but assertSafePath enforces the contract regardless of how this
  // helper is called in the future.
  return assertSafePath(path.join(DRAFT_DIR, `${id}.json`))
}

function widgetSourcePathFor(id: string): string {
  return assertSafePath(path.join(process.cwd(), "src", "features", "dashboard", "widgets", `${id}.widget.ts`))
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const guard = await requirePermission(MANAGE_PERMISSION)
  if (!guard.ok) return guard.response

  const { id } = await ctx.params
  if (!ID_RE.test(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  try {
    const raw = await fs.readFile(draftPathFor(id), "utf8")
    const parsed = widgetBuilderSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) {
      return NextResponse.json({ error: "Saved widget is invalid", issues: parsed.error.issues }, { status: 422 })
    }
    return NextResponse.json({ widget: parsed.data })
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({ error: "Widget not found" }, { status: 404 })
    }
    logger.error("[widget-builder] fetch failed:", err)
    return NextResponse.json({ error: "Fetch failed" }, { status: 500 })
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const guard = await requirePermission(MANAGE_PERMISSION)
  if (!guard.ok) return guard.response

  const { id } = await ctx.params
  if (!ID_RE.test(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  const removed: string[] = []
  try {
    try {
      await fs.unlink(draftPathFor(id))
      removed.push(`messages/_overrides/widget-builder/${id}.json`)
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err
    }

    if (process.env[RUNTIME_GATE] === "true") {
      try {
        await fs.unlink(widgetSourcePathFor(id))
        removed.push(`src/features/dashboard/widgets/${id}.widget.ts`)
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err
      }
    }

    return NextResponse.json({ success: true, filesRemoved: removed })
  } catch (err) {
    logger.error("[widget-builder] delete failed:", err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
