/**
 * GET /api/admin/widget-builder
 *
 * Returns the list of widget drafts the builder knows about. Drafts live
 * under `messages/_overrides/widget-builder/<id>.json`. Powers the
 * dashboard at /admin/widget-builder.
 */

import { promises as fs } from "node:fs"
import path from "node:path"
import { NextResponse } from "next/server"
import { logger } from "@/shared/logger"
import { widgetBuilderSchema } from "@/features/admin-tools/widget-builder/types/widget-schema"
import { requirePermission } from "@/app/api/_lib/require-permission"
import { PERMISSIONS } from "@/shared/auth/permission-keys"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const MANAGE_PERMISSION = PERMISSIONS.ADMIN_WIDGET_BUILDER
const DRAFT_DIR = path.join(process.cwd(), "messages", "_overrides", "widget-builder")

interface WidgetSummary {
  id: string
  titleKey: string
  category: string
  permissionKey: string
  source: string
}

export async function GET(): Promise<NextResponse> {
  const guard = await requirePermission(MANAGE_PERMISSION)
  if (!guard.ok) return guard.response

  try {
    let entries: string[] = []
    try {
      entries = await fs.readdir(DRAFT_DIR)
    } catch {
      return NextResponse.json({ widgets: [] })
    }

    const widgets: WidgetSummary[] = []
    for (const file of entries) {
      if (!file.endsWith(".json") || file.startsWith("_")) continue
      try {
        const raw = await fs.readFile(path.join(DRAFT_DIR, file), "utf8")
        const parsed = widgetBuilderSchema.safeParse(JSON.parse(raw))
        if (!parsed.success) continue
        const w = parsed.data
        widgets.push({
          id: w.id,
          titleKey: w.titleKey,
          category: w.category,
          permissionKey: w.permissionKey,
          source:
            w.dataSource.type === "entity-list" ? `entity:${w.dataSource.entityName}` : `api:${w.dataSource.endpoint}`,
        })
      } catch (err) {
        logger.warn(`[widget-builder] skipping unreadable draft ${file}:`, err)
      }
    }
    return NextResponse.json({ widgets: widgets.sort((a, b) => a.id.localeCompare(b.id)) })
  } catch (err) {
    logger.error("[widget-builder] list failed:", err)
    return NextResponse.json({ error: "Failed to list widgets" }, { status: 500 })
  }
}
