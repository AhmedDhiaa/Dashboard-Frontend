/**
 * Production-Ready Next.js Server
 *
 * Unified server implementation for all environments:
 * - Development (tsx server.ts)
 * - Production (node dist/server.js after build)
 * - IIS/Azure (handles IISNODE_VERSION)
 *
 * @enterprise-grade
 */

import { createServer } from "http"
import next from "next"
import { validateEnvironmentVariables } from "@/shared/config/env"
import { NAV_GROUPS } from "@/shared/config/navigation"

// Validate required environment variables at startup — throws in production if invalid
validateEnvironmentVariables()

// Environment detection
const isDev = process.env.NODE_ENV !== "production"
const getHostname = () => {
  if (isDev) return "localhost"
  return process.env.HOSTNAME || "localhost"
}

// Port detection with IIS support
const getPort = (): number => {
  if (process.env.IISNODE_VERSION) {
    // IIS/Azure deployment - use IISNODE pipe or PORT
    return parseInt(process.env.PORT || "3000", 10)
  }
  return parseInt(process.env.PORT || "3000", 10)
}

const hostname = getHostname()
const port = getPort()

// Initialize Next.js app.
//
// `turbopack: isDev` makes this custom dev server compile with Turbopack
// instead of Webpack. The previous default (Webpack) compiled each of the
// ~200 routes on-demand on first visit, which is the dominant cause of the
// "navigation is extremely slow in dev" symptom (fast on the second visit).
// Turbopack's incremental dev compiler removes that per-route stall.
//
// Scope: this flag is false in production (isDev === false), and `next build`
// still runs Webpack (`build` script passes `--webpack`), so production
// bundling is unchanged. If a Turbopack incompatibility ever surfaces in dev,
// reverting is a one-line change (or use `npm run dev:next`).
const app = next({ dev: isDev, hostname, port, turbopack: isDev })
const handle = app.getRequestHandler()

/**
 * Gateway shield for host-accumulation loops produced by misconfigured
 * proxy chains (the canonical symptom: `req.url === "/localhost:3000/foo"`).
 *
 * Deny-by-default. We do NOT try to recognise hostnames by TLD — that
 * pattern trails the times (any new TLD slips through). Instead:
 *
 *   1. Decode pct-escapes once so encoded variants don't slip past.
 *   2. Strip any leading scheme + authority that leaked into req.url.
 *   3. Drop any path segment containing `:` — RFC 3986 path segments
 *      cannot legally contain a colon, so anything that does is proxy
 *      pollution, regardless of whether the segment looks like a
 *      hostname.
 *   4. Reject (collapse to `/`) on any residue of pollution: a
 *      remaining `://`, a remaining `:`, or oversize input.
 *
 * The shape of legal Next.js URLs (including dev-time chunks like
 * `/_next/static/chunks/[turbopack]_…`) is preserved; only colon-bearing
 * authority segments are stripped, which legitimate paths never contain.
 *
 * For user-supplied `redirectTo` values use `getSafePath` from
 * `@/shared/utils/url` instead — that has a stricter allowlist suitable
 * for auth redirect sinks.
 */
const MAX_URL_LENGTH = 500

function sanitizeUrl(urlString: string): string {
  if (urlString.length > MAX_URL_LENGTH) return "/"

  let current: string
  try {
    current = decodeURIComponent(urlString)
  } catch {
    return "/"
  }
  if (current.length > MAX_URL_LENGTH) return "/"

  // Drop any scheme + authority that leaked into req.url.
  current = current.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "")
  // If still no leading slash, the leading authority hasn't been stripped
  // by the regex above; drop everything up to the first slash so what
  // remains is at least path-shaped.
  if (!current.startsWith("/")) {
    const firstSlash = current.indexOf("/")
    current = firstSlash >= 0 ? current.substring(firstSlash) : "/"
  }

  // Walk segments; any colon-bearing segment is host:port pollution and
  // must go. RFC 3986 forbids `:` in path segments, so this is safe.
  const cleaned =
    "/" +
    current
      .split("/")
      .filter(seg => seg.length > 0 && !seg.includes(":"))
      .join("/")

  if (cleaned.length > MAX_URL_LENGTH) return "/"
  // Belt-and-braces: any residual pollution markers collapse to root.
  if (cleaned.includes("://") || cleaned.includes(":")) return "/"
  return cleaned
}

/**
 * Dev-only background warmup.
 *
 * Next.js dev compiles each route on first request. The FIRST data-heavy route
 * pays a large one-time cost (~10-17s) because it compiles the whole shared
 * graph — the data table, React Query, the entity system, charts, maps. Every
 * route after that reuses those chunks (~100-300ms). On-demand `router.prefetch`
 * is a no-op in dev, so the only way to hide that cost is to pay it BEFORE the
 * user clicks: fire a handful of unauthenticated GETs right after boot. Each
 * returns the SSR shell (200) and forces compilation in the background, so by
 * the time the user navigates, the route is already warm and appears instantly.
 *
 * Sequential (one compile at a time) so it doesn't thrash the compiler, and
 * opt-out via `APP_DEV_WARMUP=false`. Never runs in production.
 *
 * The warmer's GETs are tagged `x-dev-warmup: 1`; middleware honors that header
 * in dev to skip the auth redirect, so each request actually reaches and
 * compiles the dashboard route (an unauthenticated request would otherwise 302
 * to /auth/login and compile nothing — which previously made this a no-op).
 */
function warmDevRoutes(): void {
  if (!isDev || process.env.APP_DEV_WARMUP === "false") return
  // DERIVE the warmup set from the live nav config (single source of truth) so
  // it can never go stale: whatever routes the sidebar links to are exactly the
  // routes worth pre-compiling. We add the dashboard home and a create/edit form
  // route per single-segment entity (the form graph is shared, so the first that
  // resolves warms it; 404s on create-less entities are caught and ignored).
  // In production this is moot — `<Link prefetch>` (sidebar + the Add button)
  // pre-loads route chunks on the client; the warmup only compensates for dev,
  // where Next disables prefetch.
  const navHrefs = [...new Set(NAV_GROUPS.flatMap(g => g.items.map(i => i.href)).filter(h => h.startsWith("/")))]
  const formRoutes = navHrefs.filter(h => /^\/[a-z][a-z-]*$/.test(h)).map(h => `${h}/create/edit`)
  const routes = ["/", ...navHrefs, ...formRoutes]
  const base = `http://${hostname}:${port}`
  void (async () => {
    await new Promise(resolve => setTimeout(resolve, 1500)) // let the server settle
    // eslint-disable-next-line no-console -- dev warmup progress
    console.log(`[warmup] pre-compiling ${routes.length} route graphs in the background…`)
    for (const route of routes) {
      const started = Date.now()
      try {
        await fetch(`${base}${route}`, { headers: { "x-dev-warmup": "1" }, redirect: "manual" })
        // eslint-disable-next-line no-console -- dev warmup progress
        console.log(`[warmup] ${route} → ready in ${Date.now() - started}ms`)
      } catch {
        /* ignore warmup failures — the route will just compile on first visit */
      }
    }
    // eslint-disable-next-line no-console -- dev warmup progress
    console.log("[warmup] done — navigation should now be instant")
  })()
}

// Start server after Next.js is ready
app.prepare().then(() => {
  const server = createServer({ maxHeaderSize: 32768 }, async (req, res) => {
    try {
      if (req.url) {
        const sanitized = sanitizeUrl(req.url)
        if (sanitized !== req.url) {
          console.warn(`[SERVER] Sanitized URL: ${req.url} -> ${sanitized}`)
          // Force 302 redirect to clean browser address bar
          res.writeHead(302, { Location: sanitized })
          res.end()
          return
        }
      }

      await handle(req, res)
    } catch (err) {
      console.error("[SERVER ERROR]", req.url, err)
      res.statusCode = 500
      res.end("Internal Server Error")
    }
  })

  // Error handler
  server.on("error", err => {
    console.error("[FATAL ERROR]", err)
    process.exit(1)
  })

  // Start listening
  server.listen(port, () => {
    if (isDev) {
      // Development: Show detailed info
      // eslint-disable-next-line no-console -- Server startup logging is allowed
      console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║  🚀 Next.js Server Ready                                  ║
║                                                            ║
║  📍 HTTP Server:     http://${hostname}:${port}${" ".repeat(Math.max(0, 23 - hostname.length - port.toString().length))}║
║  🌍 Environment:     ${isDev ? "development" : "production"}${" ".repeat(Math.max(0, 28 - (isDev ? "development" : "production").length))}║
║  🔌 SignalR:         Connected via @microsoft/signalr     ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
      `)
      // Pre-compile the heavy route graphs so the first navigation is instant.
      warmDevRoutes()
    } else {
      // Production: Minimal logging
      // eslint-disable-next-line no-console -- Server startup logging is allowed
      console.log(`✅ Server listening on port ${port} (${process.env.IISNODE_VERSION ? "IIS" : "Node"})`)
    }
  })
})
