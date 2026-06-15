/**
 * Per-entity record CRUD.
 *
 *   GET    /api/runtime/data/<entityId>          – list records (public read).
 *   POST   /api/runtime/data/<entityId>          – create one. Writer-gated.
 *                                                  Body = the record fields (no id).
 *   PATCH  /api/runtime/data/<entityId>          – update one. Writer-gated.
 *                                                  Body = { id, ...fields }.
 *   DELETE /api/runtime/data/<entityId>          – delete one. Writer-gated.
 *                                                  Body = { id }.
 *
 * The entityId is part of the path and validated against a strict regex —
 * we never let it flow into a filesystem path without that check, so
 * traversal (`../`, absolute paths, etc.) is impossible.
 *
 * Every write bumps the global version counter so polling clients refresh.
 */

import { NextResponse, type NextRequest } from "next/server"
import { logger } from "@/shared/logger"
import { isValidEntityId } from "../../_lib/constants"
import { createRecord, deleteRecord, readRecords, updateRecord } from "../../_lib/storage"
import { requireRuntimeReader, requireRuntimeWriter } from "../../_lib/auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type RouteContext = { params: Promise<{ entityId: string }> }

function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 })
}

function notFound(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 404 })
}

async function resolveEntityId(context: RouteContext): Promise<string | null> {
  const { entityId } = await context.params
  return isValidEntityId(entityId) ? entityId : null
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

async function readJsonBody(request: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json()
    return isPlainObject(body) ? body : null
  } catch {
    return null
  }
}

// ─── GET ────────────────────────────────────────────────────────────────────

export async function GET(_request: NextRequest, context: RouteContext): Promise<NextResponse> {
  // Permission-gated read. Runtime data can carry tenant business records
  // (customers, inventory rows), so reads require the runtime *reader* grant
  // (manager OR data-writer) — matching the page's RUNTIME_MANAGE gate while
  // also admitting data-writers. A plain signed-in user is rejected.
  const guard = await requireRuntimeReader()
  if (!guard.ok) return guard.response

  const entityId = await resolveEntityId(context)
  if (!entityId) return badRequest("Invalid entityId")

  try {
    const items = await readRecords(entityId)
    return NextResponse.json(
      { entityId, items, totalCount: items.length },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
    )
  } catch (err) {
    logger.error("[runtime-data] GET failed:", err)
    return NextResponse.json({ error: "Failed to read records" }, { status: 500 })
  }
}

// ─── POST ───────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const entityId = await resolveEntityId(context)
  if (!entityId) return badRequest("Invalid entityId")

  const guard = await requireRuntimeWriter()
  if (!guard.ok) return guard.response

  const body = await readJsonBody(request)
  if (!body) return badRequest("Body must be a JSON object")

  // System fields are server-managed; strip any client-provided values.
  const { id: _id, createdAt: _c, updatedAt: _u, ...payload } = body

  try {
    const { record, version } = await createRecord(entityId, payload)
    return NextResponse.json({ record, version }, { status: 201 })
  } catch (err) {
    logger.error("[runtime-data] POST failed:", err)
    return NextResponse.json({ error: "Failed to create record" }, { status: 500 })
  }
}

// ─── PATCH ──────────────────────────────────────────────────────────────────

export async function PATCH(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const entityId = await resolveEntityId(context)
  if (!entityId) return badRequest("Invalid entityId")

  const guard = await requireRuntimeWriter()
  if (!guard.ok) return guard.response

  const body = await readJsonBody(request)
  if (!body) return badRequest("Body must be a JSON object")

  const { id, createdAt: _c, updatedAt: _u, ...patch } = body
  if (typeof id !== "string" || id.trim() === "") {
    return badRequest("'id' must be a non-empty string")
  }

  try {
    const { record, version } = await updateRecord(entityId, id, patch)
    if (!record) return notFound(`Record "${id}" not found in entity "${entityId}"`)
    return NextResponse.json({ record, version })
  } catch (err) {
    logger.error("[runtime-data] PATCH failed:", err)
    return NextResponse.json({ error: "Failed to update record" }, { status: 500 })
  }
}

// ─── DELETE ─────────────────────────────────────────────────────────────────

export async function DELETE(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const entityId = await resolveEntityId(context)
  if (!entityId) return badRequest("Invalid entityId")

  const guard = await requireRuntimeWriter()
  if (!guard.ok) return guard.response

  const body = await readJsonBody(request)
  if (!body) return badRequest("Body must be a JSON object")

  const { id } = body
  if (typeof id !== "string" || id.trim() === "") {
    return badRequest("'id' must be a non-empty string")
  }

  try {
    const { removed, version } = await deleteRecord(entityId, id)
    if (!removed) return notFound(`Record "${id}" not found in entity "${entityId}"`)
    return NextResponse.json({ ok: true, version })
  } catch (err) {
    logger.error("[runtime-data] DELETE failed:", err)
    return NextResponse.json({ error: "Failed to delete record" }, { status: 500 })
  }
}
