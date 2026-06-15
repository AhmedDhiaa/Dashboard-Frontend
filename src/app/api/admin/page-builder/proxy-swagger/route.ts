/**
 * GET /api/admin/page-builder/proxy-swagger?url=<spec-url>
 *
 * Server-side fetch + cache for OpenAPI specs. The browser cannot load
 * cross-origin specs without CORS — we route every fetch through this
 * proxy so the wizard works regardless of the spec server's CORS config.
 *
 * Caching:
 *   - 5-minute TTL (matches the i18n override cache pattern in
 *     `src/i18n/request.ts`).
 *   - Keyed by URL.
 *   - Bounded to 20 entries; oldest evicted FIFO. Specs are 50-500 KB so
 *     this caps memory at a few megabytes.
 *
 * Errors are reported through `errorReporter.captureException` and
 * surfaced to the client as a structured 502 (so the wizard can show a
 * useful message without leaking internal stack traces).
 */

import { NextResponse, type NextRequest } from "next/server"
import { requirePermission } from "@/app/api/_lib/require-permission"
import { errorReporter } from "@/infra/observability/error-reporter"
import { PERMISSIONS } from "@/shared/auth/permission-keys"
import {
  parseSwagger,
  clusterEndpoints,
  type ParseResult,
  type ResourceCluster,
} from "@/features/admin-tools/page-builder/openapi/parser"
import type { OpenAPIV3 } from "openapi-types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const SPEC_TTL_MS = 5 * 60 * 1000
const CACHE_LIMIT = 20

interface CachedSpec {
  parsed: ParseResult
  clusters: ResourceCluster[]
  cachedAt: number
}

const specCache = new Map<string, CachedSpec>()

/** Origin allowlist — only the configured API origin can be proxied.
 *  We match the full origin (scheme + host + port), not just the hostname, so
 *  the proxy can't be pointed at a different scheme/port on the same host.
 *  Anything else gets a 400, so the proxy can't be used as an open relay. */
function isAllowedHost(target: URL): boolean {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL
  if (!apiUrl) return false
  try {
    const allowed = new URL(apiUrl)
    return target.origin === allowed.origin
  } catch {
    return false
  }
}

function evictOldestIfNeeded(): void {
  if (specCache.size < CACHE_LIMIT) return
  const oldest = specCache.keys().next().value
  if (oldest) specCache.delete(oldest)
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = await requirePermission(PERMISSIONS.ADMIN_PAGE_BUILDER)
  if (!guard.ok) return guard.response

  const url = request.nextUrl.searchParams.get("url")
  if (!url) {
    return NextResponse.json({ error: "Missing 'url' query parameter" }, { status: 400 })
  }

  let target: URL
  try {
    target = new URL(url)
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 })
  }

  if (!isAllowedHost(target)) {
    return NextResponse.json(
      { error: "URL host is not in the allowlist (NEXT_PUBLIC_API_URL host only)" },
      { status: 400 },
    )
  }

  const cached = specCache.get(target.toString())
  if (cached && Date.now() - cached.cachedAt < SPEC_TTL_MS) {
    return NextResponse.json({
      info: cached.parsed.info,
      clusters: cached.clusters,
      schemas: cached.parsed.schemas,
      cached: true,
    })
  }

  try {
    const response = await fetch(target.toString(), {
      // Server-side fetch — no auth needed for public swagger endpoints.
      // ABP exposes /swagger/v1/swagger.json without auth by default.
      headers: { Accept: "application/json" },
      // Do NOT auto-follow redirects: we only validated the INITIAL origin, so
      // an allowed host that 3xx-redirects us to a link-local metadata IP or an
      // internal service would be SSRF. Refuse any redirect outright.
      redirect: "manual",
    })
    if (response.type === "opaqueredirect" || (response.status >= 300 && response.status < 400)) {
      return NextResponse.json(
        { error: "Spec server attempted a redirect, which the proxy refuses (SSRF guard)" },
        { status: 502 },
      )
    }
    if (!response.ok) {
      return NextResponse.json({ error: `Spec server returned ${response.status}` }, { status: 502 })
    }
    const doc = (await response.json()) as OpenAPIV3.Document
    const parsed = parseSwagger(doc)
    const clusters = clusterEndpoints(parsed.endpoints)

    evictOldestIfNeeded()
    specCache.set(target.toString(), { parsed, clusters, cachedAt: Date.now() })

    return NextResponse.json({
      info: parsed.info,
      clusters,
      schemas: parsed.schemas,
      cached: false,
    })
  } catch (err) {
    errorReporter.captureException(err, {
      tags: { source: "page-builder.proxy-swagger" },
      extra: { url: target.toString() },
    })
    return NextResponse.json({ error: "Failed to fetch / parse spec" }, { status: 502 })
  }
}
