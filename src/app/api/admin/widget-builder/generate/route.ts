/**
 * POST /api/admin/widget-builder/generate
 *
 * Two operating modes, mirroring the entity-builder generate endpoint:
 *
 * • runtime  (env APP_ALLOW_RUNTIME_CODEGEN=true) — also writes
 *            `src/features/dashboard/widgets/<id>.widget.ts` so the
 *            widget is statically importable at next build.
 *
 * • draft   (default; production) — persists the validated schema at
 *           `messages/_overrides/widget-builder/<id>.json`. The runtime
 *           reads drafts directly when the canvas asks for the widget
 *           registry, so admins can ship widgets without redeploys.
 *
 * In both modes the body is `{ mode: 'create'|'update', schema }`. Update
 * is just create with overwrite-allowed semantics.
 */

import { promises as fs } from "node:fs"
import path from "node:path"
import { NextResponse, type NextRequest } from "next/server"
import { logger } from "@/shared/logger"
import { widgetBuilderSchema } from "@/features/admin-tools/widget-builder/types/widget-schema"
import { generateWidgetFile } from "@/features/admin-tools/widget-builder/server/code-generator"
import { requirePermission } from "@/app/api/_lib/require-permission"
import { codegenAllowed } from "@/app/api/_lib/codegen-gate"
import { assertSafePath } from "@/shared/utils/safe-path"
import { PERMISSIONS } from "@/shared/auth/permission-keys"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const MANAGE_PERMISSION = PERMISSIONS.ADMIN_WIDGET_BUILDER
const DRAFT_DIR = path.join(process.cwd(), "messages", "_overrides", "widget-builder")
const RUNTIME_GATE = "APP_ALLOW_RUNTIME_CODEGEN"

interface PostBody {
  mode?: "create" | "update"
  schema?: unknown
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const guard = await requirePermission(MANAGE_PERMISSION)
  if (!guard.ok) return guard.response

  let body: PostBody
  try {
    body = (await request.json()) as PostBody
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 })
  }

  const parsed = widgetBuilderSchema.safeParse(body.schema ?? body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Schema invalid", issues: parsed.error.issues }, { status: 400 })
  }

  const schema = parsed.data
  const mode = body.mode ?? "create"

  try {
    await fs.mkdir(assertSafePath(DRAFT_DIR), { recursive: true })
    // schema.id is regex-validated by widgetBuilderSchema; assertSafePath
    // re-asserts the resulting path lives under messages/_overrides/.
    const draftPath = assertSafePath(path.join(DRAFT_DIR, `${schema.id}.json`))

    if (mode === "create") {
      try {
        await fs.access(draftPath)
        return NextResponse.json({ error: `Widget '${schema.id}' already exists. Edit it instead.` }, { status: 409 })
      } catch {
        // not present — good
      }
    }

    await fs.writeFile(draftPath, JSON.stringify(schema, null, 2) + "\n")

    // Source emission is dev-only (codegenAllowed === false in production even
    // with the flag set); in prod the draft above is the shippable artifact.
    if (codegenAllowed()) {
      const generated = generateWidgetFile(schema)
      // generated.path comes from the codegen template, but treat it as
      // untrusted: the safe-path guard refuses anything outside the
      // src/features/dashboard/widgets allowed root.
      const abs = assertSafePath(generated.path)
      await fs.mkdir(path.dirname(abs), { recursive: true })
      await fs.writeFile(abs, generated.content)
      return NextResponse.json({
        success: true,
        mode: "runtime",
        savedTo: path.relative(process.cwd(), draftPath).replace(/\\/g, "/"),
        sourceWritten: generated.path,
        message: "Widget saved and source emitted.",
      })
    }

    return NextResponse.json({
      success: true,
      mode: "draft",
      savedTo: path.relative(process.cwd(), draftPath).replace(/\\/g, "/"),
      message: `Widget saved as draft. Set ${RUNTIME_GATE}=true to also emit source.`,
    })
  } catch (err) {
    logger.error("[widget-builder] save failed:", err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
