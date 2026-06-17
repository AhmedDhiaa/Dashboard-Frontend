/**
 * Runtime builder config — entities + pages + dashboards.
 *
 *   GET /api/runtime/config        – returns the full config; auth-gated
 *                                    (any signed-in user, not the public).
 *   PUT /api/runtime/config        – replace the full config; admin-gated.
 *
 * PUT bumps the global version counter; clients polling /api/runtime/version
 * will see a new number and refetch.
 */

import { NextResponse, type NextRequest } from "next/server"
import { logger } from "@/shared/logger"
import { readConfig, writeConfig, type RuntimeConfig } from "../_lib/storage"
import { requireRuntimeConfigReader, requireRuntimeManager } from "../_lib/auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 })
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function validateConfig(body: unknown): { ok: true; config: RuntimeConfig } | { ok: false; reason: string } {
  if (!isPlainObject(body)) return { ok: false, reason: "Body must be a JSON object" }
  // We don't deep-validate the schema here — that's the builder UI's job.
  // We just check the top-level shape so a malformed write can't corrupt
  // the file beyond recognition.
  const shape = ["entities", "pages", "dashboards"] as const
  for (const key of shape) {
    if (key in body && !Array.isArray((body as Record<string, unknown>)[key])) {
      return { ok: false, reason: `'${key}' must be an array when present` }
    }
  }
  return { ok: true, config: body as RuntimeConfig }
}

export async function GET(): Promise<NextResponse> {
  const guard = await requireRuntimeConfigReader()
  if (!guard.ok) return guard.response

  try {
    const config = await readConfig()
    return NextResponse.json(config, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    })
  } catch (err) {
    logger.error("[runtime-config] GET failed:", err)
    return NextResponse.json({ error: "Failed to read config" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const guard = await requireRuntimeManager()
  if (!guard.ok) return guard.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return badRequest("Body must be JSON")
  }

  const validated = validateConfig(body)
  if (!validated.ok) return badRequest(validated.reason)

  try {
    const { version } = await writeConfig(validated.config)
    return NextResponse.json({ ok: true, version })
  } catch (err) {
    logger.error("[runtime-config] PUT failed:", err)
    return NextResponse.json({ error: "Failed to write config" }, { status: 500 })
  }
}
