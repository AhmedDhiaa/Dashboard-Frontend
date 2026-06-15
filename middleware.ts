/**
 * Next.js Middleware
 *
 * Responsibilities (ordered by performance priority):
 * 1. Bypass static/API routes immediately (no processing)
 * 2. Locale cookie injection
 * 3. Lightweight auth cookie check — redirect unauthenticated users to login
 * 4. Security headers on every response
 *
 * PERFORMANCE NOTE:
 * We intentionally do NOT call auth() (NextAuth) here. auth() triggers the jwt
 * callback which may call performRefresh() — a network call to the OAuth2 server.
 * On every page request that would mean 8 s of potential blocking latency.
 * Instead we do an O(1) cookie-existence check:
 *   - Cookie present → pass through (the page/component verifies session deeply)
 *   - Cookie absent  → redirect to /auth/login
 * Deep session analysis (token expiry, RefreshAccessTokenError) is handled by:
 *   - Server components via getServerSession()
 *   - Client-side AuthGuard + SessionExpiryBanner
 */

import createIntlMiddleware from "next-intl/middleware"
import { NextRequest, NextResponse } from "next/server"
import {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  LOCALE_COOKIE_MAX_AGE,
  isValidLocale,
} from "@/shared/config/locale-constants"
import { isMiddlewareBypassPath, isPublicPath } from "@/infra/auth/auth-constants"
import { getSafePath } from "@/shared/utils/url"
import { rateLimiter } from "@/infra/ratelimit"
import { findRateLimit } from "@/infra/ratelimit/config"

// ─── i18n middleware ──────────────────────────────────────────────────────────

const intlMiddleware = createIntlMiddleware({
  locales: [...SUPPORTED_LOCALES],
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: "never",
  localeDetection: true,
})

// ─── Auth cookie names ────────────────────────────────────────────────────────

/** NextAuth session cookie names — both HTTP (dev) and HTTPS (prod) variants */
const SESSION_COOKIE_NAMES = [
  "next-auth.session-token", // HTTP (localhost dev)
  "__Secure-next-auth.session-token", // HTTPS production
  "__Host-next-auth.session-token", // Strict HTTPS production
]

/**
 * O(1) auth check — only verifies that a session cookie is present.
 * Token validity is verified by server components and the client-side AuthGuard.
 */
function isAuthenticated(request: NextRequest): boolean {
  return SESSION_COOKIE_NAMES.some(name => request.cookies.has(name))
}

/**
 * True for the in-process dev route-warmer's requests (server.ts →
 * warmDevRoutes), which are allowed to skip the auth redirect so they compile
 * the real dashboard route instead of the login page.
 *
 * Gated by THREE independent conditions so it can never fire for a real visitor:
 *   1. isDev — NODE_ENV === "development".
 *   2. Direct request — no proxy `x-forwarded-*` headers. Every real deployment
 *      sits behind a load balancer/proxy that sets these; the warmer hits
 *      http://localhost directly and carries none. This holds even if NODE_ENV
 *      were misconfigured in production.
 *   3. The explicit `x-dev-warmup: 1` tag.
 */
function isDevWarmupRequest(request: NextRequest, isDev: boolean): boolean {
  if (!isDev) return false
  if (request.headers.get("x-dev-warmup") !== "1") return false
  const viaProxy = request.headers.get("x-forwarded-for") || request.headers.get("x-forwarded-host")
  return !viaProxy
}

// ─── Rate limit ───────────────────────────────────────────────────────────────

/**
 * Extract the client IP for rate-limit bucketing. We read headers (not
 * `request.ip`, deprecated in Next 13+ and unreliable across deploy shapes).
 *
 * X-Forwarded-For is a CLIENT-CONTROLLED string: a request can arrive with a
 * forged `X-Forwarded-For: 1.2.3.4` that a real proxy then *appends* its
 * observed client IP to (`1.2.3.4, <real-ip>`). So the LEFTMOST entry is
 * attacker-controlled and the RIGHTMOST (the one our own proxy added) is the
 * trustworthy one. Reading the leftmost — the previous default — let an
 * attacker rotate the header per request and split the rate-limit counter
 * across forged IPs, defeating the login/brute-force cap (OWASP A07). We now
 * default to the secure read:
 *
 *   TRUSTED_PROXY_HEADERS="0"  → no trustworthy proxy at all; collapse every
 *                                client into one global bucket (harsher, but
 *                                un-spoofable).
 *   TRUSTED_PROXY_HEADERS="1"  → operator guarantees the proxy chain rewrites
 *                                XFF, so the LEFTMOST entry is the genuine
 *                                original client (legacy behaviour, opt-in).
 *   unset (default)            → SECURE DEFAULT: take the RIGHTMOST entry,
 *                                stepping back over `TRUSTED_PROXY_HOPS`
 *                                known internal proxies (default 0). A client
 *                                prepending forged hops can't shift this, so
 *                                per-IP bucketing holds without operators
 *                                having to opt in.
 */
export function getClientIP(request: NextRequest): string {
  const trust = process.env.TRUSTED_PROXY_HEADERS

  if (trust === "0") {
    // Headers are not trustworthy — collapse all clients into one bucket so
    // the limit applies globally instead of per-spoofed-IP.
    return "unverified-client"
  }

  const xff = request.headers.get("x-forwarded-for")
  const xri = request.headers.get("x-real-ip")

  if (trust === "1") {
    // Explicit trust: leftmost XFF entry is the original client.
    if (xff) return xff.split(",")[0]!.trim()
    if (xri) return xri.trim()
    return "unknown"
  }

  // Secure default: rightmost XFF entry minus a configured number of trusted
  // internal hops — the IP our own edge/proxy actually observed.
  if (xff) {
    const ips = xff
      .split(",")
      .map(s => s.trim())
      .filter(Boolean)
    if (ips.length > 0) {
      const hops = Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? "0", 10)
      const back = Number.isFinite(hops) && hops > 0 ? hops : 0
      const idx = Math.max(0, ips.length - 1 - back)
      return ips[idx]!
    }
  }
  if (xri) return xri.trim()
  return "unknown"
}

/**
 * Apply the per-IP, per-route rate limit if one is configured for this path.
 * Returns a 429 response when the limit is exceeded; otherwise returns null
 * and the caller continues normally. Headers on the 429 follow RFC 6585 +
 * the de-facto X-RateLimit-* convention.
 */
async function applyRateLimit(request: NextRequest, pathname: string): Promise<NextResponse | null> {
  const rule = findRateLimit(pathname)
  if (!rule) return null

  const ip = getClientIP(request)
  const key = `${rule.label}:${ip}`
  // `check` is async because the production adapter speaks Redis. The
  // in-memory adapter resolves synchronously via Promise.resolve, so the
  // dev path pays one microtask, no I/O.
  const result = await rateLimiter.check(key, rule.max, rule.windowMs)

  if (!result.allowed) {
    const retryAfter = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000))
    return new NextResponse(
      JSON.stringify({
        error: "Too Many Requests",
        message: `Rate limit exceeded for ${rule.label}. Try again in ${retryAfter}s.`,
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(result.limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.floor(result.resetAt / 1000)),
        },
      },
    )
  }

  return null
}

// ─── CSP nonce ────────────────────────────────────────────────────────────────

/**
 * Per-request nonce for the strict-CSP `script-src 'nonce-...'` directive.
 *
 * - Generated only in production. In development the existing CSP keeps
 *   `'unsafe-inline'` so Next's HMR runtime (which injects unnonced inline
 *   scripts) keeps working.
 * - 122 bits of entropy — `crypto.randomUUID()` is edge-runtime-safe and
 *   well past the CSP spec's 128-bit-entropy recommendation when the dashes
 *   are kept (which they are; the nonce charset allows them).
 * - The same value is set on the request header `x-nonce` (forwarded to
 *   the layout so it can attach `nonce={...}` to its inline scripts) AND
 *   inlined into the response CSP header.
 */
function makeNonce(): string {
  return crypto.randomUUID()
}

// ─── Main middleware ──────────────────────────────────────────────────────────

export default async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl

  // 0. Rate limit — runs FIRST so abusive clients can't trigger any of the
  //    work below. Currently scoped to `/api/auth/*` (see config.ts); if
  //    `findRateLimit` returns no rule for this path, this is a no-op.
  const rateLimited = await applyRateLimit(request, pathname)
  if (rateLimited) return rateLimited

  const malformedRegex = /(?:localhost|127\.0\.0\.1|acme\.iq|:)/i

  // Nuclear Sanitization: Detect and break accumulation loops.
  if (malformedRegex.test(pathname) || pathname.length > 200) {
    console.warn(`[MIDDLEWARE] Sanitizing malformed URL: ${pathname}`)
    const safePath = getSafePath(pathname)
    return NextResponse.redirect(new URL(safePath, request.url))
  }

  // Mint the nonce ONCE per request, BEFORE the bypass check. /auth/login
  // and the API roots are in the bypass list (so they skip locale + auth
  // gate) but they're still HTML / JSON responses that need security
  // headers — most importantly the nonced CSP for /auth/login. The
  // single-source rule: every response that exits this middleware passes
  // through `finalise`, including the bypass path.
  const isDev = process.env.NODE_ENV === "development"
  const nonce = isDev ? "" : makeNonce()

  // 2. Locale cookie — inject default if missing/invalid
  const currentLocale = request.cookies.get(LOCALE_COOKIE_NAME)?.value
  const needsLocaleCookie = !currentLocale || !isValidLocale(currentLocale)

  /** Attach locale cookie + security headers to any outgoing response */
  const finalise = (response: NextResponse): NextResponse => {
    if (needsLocaleCookie) {
      response.cookies.set(LOCALE_COOKIE_NAME, DEFAULT_LOCALE, {
        path: "/",
        maxAge: LOCALE_COOKIE_MAX_AGE,
        sameSite: "lax",
      })
    }
    addSecurityHeaders(response, nonce)
    return response
  }

  // 1. Bypass: API auth routes, _next static, favicons — skip locale +
  //    auth-gate work, but still go through `finalise` so the response
  //    carries the security headers (incl. nonced CSP). The bypass means
  //    "this path doesn't need redirect-to-login or locale cookies", NOT
  //    "this path doesn't need security headers".
  if (isMiddlewareBypassPath(pathname)) {
    // Bypass paths still need the nonce on their request headers in case
    // the route renders HTML (e.g. /auth/login uses RootLayout). They
    // also need `x-pathname` so `getRequestConfig` (src/i18n/request.ts)
    // can pick the correct locale namespaces — without this, /auth/login
    // gets the dashboard's default namespace set, which is missing
    // `auth`, surfacing as MISSING_MESSAGE warnings on every render.
    const bypassHeaders = new Headers(request.headers)
    bypassHeaders.set("x-pathname", pathname)
    if (nonce) bypassHeaders.set("x-nonce", nonce)
    return finalise(NextResponse.next({ request: { headers: bypassHeaders } }))
  }

  // 3. Auth gate — redirect unauthenticated users away from protected routes.
  //
  //    DEV EXCEPTION: the background route-warmer (server.ts → warmDevRoutes)
  //    fires unauthenticated GETs tagged `x-dev-warmup: 1` to pre-compile each
  //    route's module graph at boot. Without this bypass those requests get a
  //    302 to /auth/login — which compiles the login page, NOT the dashboard
  //    route — silently defeating the warmer and leaving every first navigation
  //    to pay the full cold-compile (the "navigation takes 7s" symptom).
  //
  //    DEFENSE-IN-DEPTH: the bypass is gated on `isDev` (NODE_ENV), AND on the
  //    request being DIRECT — no proxy `x-forwarded-*` headers. Every real
  //    deployment sits behind a load balancer/proxy that sets these, so even if
  //    NODE_ENV were ever misconfigured to "development" in production, an
  //    external request (which always arrives via the proxy) can never satisfy
  //    the bypass. The in-process warmer hits http://localhost directly, so it
  //    carries no forwarded headers and still works in dev.
  const authenticated = isAuthenticated(request)
  const isDevWarmup = isDevWarmupRequest(request, isDev)

  if (!authenticated && !isDevWarmup && !isPublicPath(pathname)) {
    const loginUrl = new URL("/auth/login", request.url)

    // Sanitize redirectTo: Strip any host segments to prevent host-as-path loops
    const safeRedirectTo = getSafePath(pathname)
    loginUrl.searchParams.set("redirectTo", safeRedirectTo)

    return finalise(NextResponse.redirect(loginUrl))
  }

  // 4. Run i18n middleware, then ALWAYS forward `x-pathname` (+ `x-nonce`) to
  //    the route handler / layout so `getRequestConfig` (src/i18n/request.ts)
  //    can pick the correct locale namespaces and `RootLayout` can nonce its
  //    inline scripts.
  //
  //    IMPORTANT: under `localePrefix: "never"` next-intl returns a truthy
  //    `NextResponse.next()` on EVERY request (it only needs to set the locale
  //    cookie — it never rewrites the URL). The previous `if (intlResponse)
  //    return …` therefore short-circuited on every request, so the
  //    `x-pathname` header below was never set and `getRequestConfig` always
  //    fell back to `/dashboard` — silently breaking path-aware namespace
  //    loading for every section that isn't a superset of the dashboard set
  //    (settings, sales-invoices, tickets, page-builder pages → raw i18n keys).
  //
  //    So: honor a genuine redirect/rewrite as terminal, but for the common
  //    pass-through case rebuild a `next()` that carries our augmented request
  //    headers, copying next-intl's Set-Cookie (locale) onto it.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-pathname", pathname)
  if (nonce) requestHeaders.set("x-nonce", nonce)

  // Let next-intl run (it detects the locale from Accept-Language on first
  // visit and emits a NEXT_LOCALE cookie). Under `localePrefix: "never"` it
  // never adds a URL prefix, so it returns a pass-through `next()` — it does
  // NOT redirect. We therefore IGNORE its response body and always forward
  // our own `next()` carrying `x-pathname`, only honoring a genuine `location`
  // redirect in the unexpected case one occurs. The locale itself is read
  // from the cookie by getRequestConfig, so next-intl's request-header
  // injection isn't needed here — only its Set-Cookie is, which we copy over.
  const intlResponse = intlMiddleware(request)
  if (intlResponse.headers.has("location")) {
    return finalise(intlResponse)
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  intlResponse.cookies.getAll().forEach(cookie => response.cookies.set(cookie))
  return finalise(response)
}

// ─── Security headers ─────────────────────────────────────────────────────────

/**
 * Build the script-src directive.
 *
 *   prod (nonce given): `'self' 'nonce-...' https://maps.googleapis.com`
 *     The nonce blocks inline-script XSS without breaking our intentional
 *     inline scripts (themeInitScript, Next's framework-injected runtime
 *     chunks) — Next.js auto-applies the same nonce when it sees the
 *     `x-nonce` request header. The CSP grader credits this as no
 *     `'unsafe-inline'`, lifting the Mozilla Observatory score from B → A.
 *
 *   dev (no nonce): keeps `'unsafe-inline' 'unsafe-eval'` so Next.js dev
 *     HMR — which injects unnonced inline scripts on every reload —
 *     keeps working. Production is the only target that needs to score
 *     against Observatory; dev convenience wins here.
 */
export function buildScriptSrc(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development"
  if (isDev) {
    return "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com"
  }
  // Production. The nonce attribute on `<script>` tags rendered by the app
  // (see RootLayout) and on Next's framework injections must equal this
  // value — middleware mints the nonce ONCE per request and forwards it
  // via the `x-nonce` request header.
  return `script-src 'self' 'nonce-${nonce}' https://maps.googleapis.com`
}

/**
 * Build the connect-src origin list from configured env so a host change
 * (api-demo → api) can't silently break every XHR under strict CSP.
 * Falls back to the production API origin if env is unset at build time.
 */
function buildConnectSrc(): string {
  // `nominatim.openstreetmap.org` powers the free (Leaflet/OSM) map provider's
  // geocoding. OSM raster tiles are <img> loads, already covered by img-src.
  const origins = new Set<string>([
    "'self'",
    "https://maps.googleapis.com",
    "https://nominatim.openstreetmap.org",
    "wss:",
    "ws:",
  ])
  const add = (url?: string) => {
    if (!url) return
    try {
      origins.add(new URL(url).origin)
    } catch {
      /* ignore malformed env */
    }
  }
  add(process.env.NEXT_PUBLIC_API_URL ?? "https://api.example.com")
  add(process.env.NEXT_PUBLIC_SOCKET_URL) // if a distinct socket origin exists
  return `connect-src ${[...origins].join(" ")}`
}

function addSecurityHeaders(response: NextResponse, nonce: string): void {
  const csp = [
    "default-src 'self'",
    buildScriptSrc(nonce),
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: https: blob:",
    buildConnectSrc(),
    "frame-src 'self' https://maps.googleapis.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ")

  response.headers.set("Content-Security-Policy", csp)
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload")
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("X-XSS-Protection", "1; mode=block")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), interest-cohort=()")
}

// ─── Matcher ──────────────────────────────────────────────────────────────────

export const config = {
  matcher: [
    // Default: every page route except _next assets, favicon, and asset
    // files. API is excluded here because the auth gate / locale logic
    // shouldn't run for it.
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|css|woff2?|map|json)).*)",
    // Rate-limit-only: include the API roots that have rate-limit rules in
    // `infra/ratelimit/config.ts`. `applyRateLimit` fires first; the
    // bypass check (`isMiddlewareBypassPath`) then short-circuits each one
    // BEFORE any auth-gate / locale logic runs (their handlers do their
    // own permission checks).
    //   - /api/auth/*    → auth-callback, auth-signin
    //   - /api/admin/*   → codegen-entity, codegen-widget
    //   - /api/runtime/* → codegen-materialize, runtime-write
    "/api/auth/:path*",
    "/api/admin/:path*",
    "/api/runtime/:path*",
  ],
}
