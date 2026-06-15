/**
 * GET /api/widgets
 *
 * Returns the list of widgets the canvas can mount. Two sources:
 *   • Drafts under messages/_overrides/widget-builder/<id>.json
 *   • Statically registered widgets (.widget.ts files) — loaded in
 *     runtime mode; absent in draft-only deployments
 *
 * Filtered by the viewer's session: a widget whose `permissionKey` the
 * viewer doesn't hold is dropped from the response so the canvas never
 * mounts a widget the user can't read.
 */

import { promises as fs } from "node:fs"
import path from "node:path"
import { NextResponse } from "next/server"
import { logger } from "@/shared/logger"
import { auth } from "@/infra/auth/server"
import { config } from "@/shared/config"
import { widgetBuilderSchema, type WidgetBuilderSchema } from "@/shared/widgets/schema"
import type { ExtendedSession } from "@/shared/types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const DRAFT_DIR = path.join(process.cwd(), "messages", "_overrides", "widget-builder")

async function loadDrafts(): Promise<WidgetBuilderSchema[]> {
  const out: WidgetBuilderSchema[] = []
  let entries: string[] = []
  try {
    entries = await fs.readdir(DRAFT_DIR)
  } catch {
    return []
  }
  for (const file of entries) {
    if (!file.endsWith(".json") || file.startsWith("_")) continue
    try {
      const raw = await fs.readFile(path.join(DRAFT_DIR, file), "utf8")
      const parsed = widgetBuilderSchema.safeParse(JSON.parse(raw))
      if (parsed.success) out.push(parsed.data)
    } catch (err) {
      logger.warn(`[widgets] skipping draft ${file}:`, err)
    }
  }
  return out
}

async function fetchUserPermissions(session: ExtendedSession): Promise<{ admin: boolean; perms: Set<string> }> {
  const roles = session.user?.roles ?? []
  const admin = roles.includes("admin")
  if (admin) return { admin: true, perms: new Set() }

  if (!session.accessToken) return { admin: false, perms: new Set() }

  const baseUrl = (process.env.API_URL ?? config.api.baseUrl ?? process.env.NEXT_PUBLIC_API_URL ?? "").replace(
    /\/+$/,
    "",
  )
  if (!baseUrl) return { admin: false, perms: new Set() }

  try {
    const res = await fetch(`${baseUrl}/api/abp/application-configuration?IncludeLocalizationResources=false`, {
      headers: { Authorization: `Bearer ${session.accessToken}`, Accept: "application/json" },
      cache: "no-store",
    })
    if (!res.ok) return { admin: false, perms: new Set() }
    const data = (await res.json()) as { auth?: { grantedPolicies?: Record<string, boolean> } }
    const granted = data.auth?.grantedPolicies ?? {}
    return {
      admin: false,
      perms: new Set(Object.keys(granted).filter(k => granted[k])),
    }
  } catch (err) {
    logger.warn("[widgets] permissions fetch failed:", err)
    return { admin: false, perms: new Set() }
  }
}

export async function GET(): Promise<NextResponse> {
  const session = (await auth()) as ExtendedSession | null
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const all = await loadDrafts()
    const { admin, perms } = await fetchUserPermissions(session)
    const visible = all.filter(w => admin || perms.has(w.permissionKey))
    return NextResponse.json({ widgets: visible })
  } catch (err) {
    logger.error("[widgets] list failed:", err)
    return NextResponse.json({ widgets: [] })
  }
}
