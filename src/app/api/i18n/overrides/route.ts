/**
 * Translation override CRUD.
 *
 *   GET    /api/i18n/overrides?locale=en   – returns the current map (public).
 *   PATCH  /api/i18n/overrides             – upsert one entry, admin-gated.
 *   DELETE /api/i18n/overrides             – remove one entry, admin-gated.
 *
 * Every PATCH and DELETE bumps a global version counter (see ./version/route).
 */

import { NextResponse, type NextRequest } from "next/server"
import { logger } from "@/shared/logger"
import { isSupportedLocale } from "../_lib/constants"
import { buildFlatKey, readOverrides, removeOverride, setOverride } from "../_lib/storage"
import { requireTranslationAdmin } from "../_lib/auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

interface MutationBody {
  locale?: unknown
  namespace?: unknown
  keyPath?: unknown
  value?: unknown
}

function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 })
}

/**
 * Block segments that could pollute Object.prototype when the override is
 * applied at request-render time by `setDeep` in `src/i18n/request.ts`.
 * Defense-in-depth — `setDeep` itself also refuses these segments, but a
 * 400 here gives the admin UI a clear error instead of silently dropping.
 */
const POLLUTION_SEGMENT_RE = /(^|\.)(__proto__|constructor|prototype)(\.|$)/
function isUnsafeKey(s: string): boolean {
  return POLLUTION_SEGMENT_RE.test(s)
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const locale = request.nextUrl.searchParams.get("locale")
  if (!isSupportedLocale(locale)) {
    return badRequest("Query param 'locale' is required and must be a supported locale")
  }

  try {
    const map = await readOverrides(locale)
    return NextResponse.json({ locale, overrides: map })
  } catch (err) {
    logger.error("[i18n-overrides] GET failed:", err)
    return NextResponse.json({ error: "Failed to read overrides" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const guard = await requireTranslationAdmin()
  if (!guard.ok) return guard.response

  let body: MutationBody
  try {
    body = (await request.json()) as MutationBody
  } catch {
    return badRequest("Body must be JSON")
  }

  const { locale, namespace, keyPath, value } = body
  if (!isSupportedLocale(locale)) return badRequest("'locale' must be a supported locale")
  if (typeof namespace !== "string") return badRequest("'namespace' must be a string (use '' for top-level keys)")
  if (typeof keyPath !== "string" || keyPath.trim() === "") return badRequest("'keyPath' must be a non-empty string")
  if (typeof value !== "string") return badRequest("'value' must be a string")
  if (isUnsafeKey(namespace) || isUnsafeKey(keyPath)) {
    return badRequest("'namespace' / 'keyPath' may not contain '__proto__', 'constructor', or 'prototype'")
  }

  const flatKey = buildFlatKey(namespace, keyPath)

  try {
    const { map, version } = await setOverride(locale, flatKey, value)
    return NextResponse.json({ locale, key: flatKey, value, version, overrides: map })
  } catch (err) {
    logger.error("[i18n-overrides] PATCH failed:", err)
    return NextResponse.json({ error: "Failed to write override" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const guard = await requireTranslationAdmin()
  if (!guard.ok) return guard.response

  let body: MutationBody
  try {
    body = (await request.json()) as MutationBody
  } catch {
    return badRequest("Body must be JSON")
  }

  const { locale, namespace, keyPath } = body
  if (!isSupportedLocale(locale)) return badRequest("'locale' must be a supported locale")
  if (typeof namespace !== "string") return badRequest("'namespace' must be a string (use '' for top-level keys)")
  if (typeof keyPath !== "string" || keyPath.trim() === "") return badRequest("'keyPath' must be a non-empty string")
  if (isUnsafeKey(namespace) || isUnsafeKey(keyPath)) {
    return badRequest("'namespace' / 'keyPath' may not contain '__proto__', 'constructor', or 'prototype'")
  }

  const flatKey = buildFlatKey(namespace, keyPath)

  try {
    const { map, version, removed } = await removeOverride(locale, flatKey)
    if (!removed) {
      return NextResponse.json({ error: "Override not found", key: flatKey }, { status: 404 })
    }
    return NextResponse.json({ locale, key: flatKey, version, overrides: map })
  } catch (err) {
    logger.error("[i18n-overrides] DELETE failed:", err)
    return NextResponse.json({ error: "Failed to remove override" }, { status: 500 })
  }
}
