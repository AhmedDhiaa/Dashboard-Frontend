/**
 * Direct source-of-truth translation editor.
 *
 *   GET    /api/i18n/source-write?locale=&namespace=  – full namespace JSON
 *   PATCH  /api/i18n/source-write                     – deep-set one key
 *   DELETE /api/i18n/source-write                     – deep-unset one key
 *
 * Edits land in messages/<locale>/<namespace>.json as deep nested JSON.
 * The override path (/api/i18n/overrides) remains the default; this
 * endpoint is gated behind APP_ALLOW_RUNTIME_CODEGEN="true" — same
 * posture as the entity- and page-builder materialize routes, so the
 * surface is invisible in locked production builds.
 *
 * Every successful PATCH/DELETE bumps the shared version counter so
 * next-intl re-fetches messages on the client.
 */

import { NextResponse, type NextRequest } from "next/server"
import { logger } from "@/shared/logger"
import { PathTraversalError } from "@/shared/utils/safe-path"
import { isSupportedLocale, SUPPORTED_LOCALES, type SupportedLocale } from "../_lib/constants"
import { requireTranslationAdmin } from "../_lib/auth"
import {
  existsInAllSiblingLocales,
  getNamespaceSource,
  InvalidKeyPathError,
  InvalidNamespaceError,
  ProtoPollutionError,
  setSourceKey,
  setSourceKeyAllLocales,
  unsetSourceKey,
} from "../_lib/source-storage"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const RUNTIME_GATE = "APP_ALLOW_RUNTIME_CODEGEN"

interface MutationBody {
  locale?: unknown
  namespace?: unknown
  keyPath?: unknown
  value?: unknown
  /** Both-locale create: { en: "...", ar: "..." }. Required for new keys. */
  values?: unknown
}

function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 })
}

/**
 * Validate the both-locale `values` payload. EVERY supported locale must carry
 * a non-empty string — this is the server-side enforcement of "new keys require
 * both locales", which keeps the en/ar parity gate green no matter which client
 * (editor, import, direct call) creates the key. Returns the typed map on
 * success, or an error message string on failure.
 */
function parseAllLocaleValues(values: unknown): Record<SupportedLocale, string> | string {
  if (typeof values !== "object" || values === null || Array.isArray(values)) {
    return "'values' must be an object mapping each locale to a string"
  }
  const out = {} as Record<SupportedLocale, string>
  for (const loc of SUPPORTED_LOCALES) {
    const v = (values as Record<string, unknown>)[loc]
    if (typeof v !== "string" || v.trim() === "") {
      return `'values.${loc}' must be a non-empty string (all locales are required to create a key)`
    }
    out[loc] = v
  }
  return out
}

function gateClosed(): NextResponse {
  // 404 (not 403) so scanners can't tell this endpoint exists in locked builds.
  return NextResponse.json({ error: "Source-write is disabled in this environment" }, { status: 404 })
}

function isGateOpen(): boolean {
  return process.env[RUNTIME_GATE] === "true"
}

/**
 * Translate the structured errors from source-storage into the right HTTP
 * status. Prototype-pollution attempts get an audit-worthy log line.
 */
function mapValidationError(err: unknown, locale: string, namespace: unknown): NextResponse | null {
  if (err instanceof ProtoPollutionError) {
    logger.warn("[i18n-source-write] rejected dangerous keyPath segment", {
      segment: err.segment,
      locale,
      namespace,
    })
    return badRequest(`keyPath segment "${err.segment}" is not allowed`)
  }
  if (err instanceof InvalidKeyPathError) return badRequest(err.message)
  if (err instanceof InvalidNamespaceError) return badRequest(err.message)
  if (err instanceof PathTraversalError) {
    logger.warn("[i18n-source-write] rejected unsafe path", { received: err.received })
    return badRequest("Resolved path is outside the messages tree")
  }
  return null
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isGateOpen()) return gateClosed()

  const guard = await requireTranslationAdmin()
  if (!guard.ok) return guard.response

  const params = request.nextUrl.searchParams
  const locale = params.get("locale")
  const namespace = params.get("namespace")
  if (!isSupportedLocale(locale)) return badRequest("'locale' query param must be a supported locale")
  if (!namespace || typeof namespace !== "string") return badRequest("'namespace' query param is required")

  try {
    const json = await getNamespaceSource(locale, namespace)
    return NextResponse.json({ locale, namespace, source: json })
  } catch (err) {
    const mapped = mapValidationError(err, locale, namespace)
    if (mapped) return mapped
    logger.error("[i18n-source-write] GET failed:", err)
    return NextResponse.json({ error: "Failed to read namespace source" }, { status: 500 })
  }
}

/**
 * Both-locale create/edit: { namespace, keyPath, values: { en, ar } } — the
 * parity-preserving path for NEW keys; writes every locale atomically.
 */
async function handleAllLocaleWrite(namespace: string, keyPath: string, values: unknown): Promise<NextResponse> {
  const parsed = parseAllLocaleValues(values)
  if (typeof parsed === "string") return badRequest(parsed)
  try {
    const { version, byLocale } = await setSourceKeyAllLocales(namespace, keyPath, parsed)
    return NextResponse.json({ namespace, keyPath, values: parsed, version, byLocale })
  } catch (err) {
    const mapped = mapValidationError(err, SUPPORTED_LOCALES[0]!, namespace)
    if (mapped) return mapped
    logger.error("[i18n-source-write] PATCH (all locales) failed:", err)
    return NextResponse.json({ error: "Failed to write namespace source" }, { status: 500 })
  }
}

/**
 * Single-locale edit — only permitted for a key that ALREADY exists in every
 * other locale; otherwise the write would create a sibling-absent key and break
 * parity, so we 409 and point the caller at the both-locale path.
 */
async function handleSingleLocaleWrite(
  locale: SupportedLocale,
  namespace: string,
  keyPath: string,
  value: string,
): Promise<NextResponse> {
  try {
    if (!(await existsInAllSiblingLocales(locale, namespace, keyPath))) {
      return NextResponse.json(
        {
          error: "parity",
          message:
            `Key "${keyPath}" does not exist in all other locales, so a single-locale write would break ` +
            `translation parity. Create new keys with both locales: send { namespace, keyPath, values: { en, ar } }.`,
        },
        { status: 409 },
      )
    }
    const { json, version } = await setSourceKey(locale, namespace, keyPath, value)
    return NextResponse.json({ locale, namespace, keyPath, value, version, source: json })
  } catch (err) {
    const mapped = mapValidationError(err, locale, namespace)
    if (mapped) return mapped
    logger.error("[i18n-source-write] PATCH failed:", err)
    return NextResponse.json({ error: "Failed to write namespace source" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  if (!isGateOpen()) return gateClosed()

  const guard = await requireTranslationAdmin()
  if (!guard.ok) return guard.response

  let body: MutationBody
  try {
    body = (await request.json()) as MutationBody
  } catch {
    return badRequest("Body must be JSON")
  }

  const { locale, namespace, keyPath, value, values } = body
  if (typeof namespace !== "string" || namespace.trim() === "")
    return badRequest("'namespace' must be a non-empty string")
  if (typeof keyPath !== "string" || keyPath.trim() === "") return badRequest("'keyPath' must be a non-empty string")

  if (values !== undefined) return handleAllLocaleWrite(namespace, keyPath, values)

  if (!isSupportedLocale(locale)) return badRequest("'locale' must be a supported locale")
  if (typeof value !== "string") return badRequest("'value' must be a string")
  return handleSingleLocaleWrite(locale, namespace, keyPath, value)
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  if (!isGateOpen()) return gateClosed()

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
  if (typeof namespace !== "string" || namespace.trim() === "")
    return badRequest("'namespace' must be a non-empty string")
  if (typeof keyPath !== "string" || keyPath.trim() === "") return badRequest("'keyPath' must be a non-empty string")

  try {
    const { json, version, removed } = await unsetSourceKey(locale, namespace, keyPath)
    if (!removed) {
      return NextResponse.json({ error: "keyPath not found", locale, namespace, keyPath }, { status: 404 })
    }
    return NextResponse.json({ locale, namespace, keyPath, version, source: json })
  } catch (err) {
    const mapped = mapValidationError(err, locale, namespace)
    if (mapped) return mapped
    logger.error("[i18n-source-write] DELETE failed:", err)
    return NextResponse.json({ error: "Failed to remove namespace key" }, { status: 500 })
  }
}
