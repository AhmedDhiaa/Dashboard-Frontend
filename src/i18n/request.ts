/**
 * next-intl request configuration — path-aware namespace lazy loading.
 *
 * Loads only the message namespaces a given route actually consumes, instead
 * of shipping all 16 (~150 KB) on every request. The largest single saving is
 * `pages.json` (~60 KB EN / ~75 KB AR), which is unnecessary on routes that
 * do not render entity pages — /auth/*, the dashboard root, /403, /404.
 *
 * Mechanism:
 *   - middleware.ts injects `x-pathname` into the forwarded request headers.
 *   - `getRequestConfig` reads that header via `headers()` and consults the
 *     map below to compute the namespace set for the current URL.
 *   - The selected namespaces are loaded in parallel and merged into the
 *     `messages` object passed to NextIntlClientProvider.
 *
 * Adjusting the map:
 *   - Adding a namespace to a route is cheap (a few KB extra in the bundle).
 *   - Removing one is risky — verify by grepping for `t("<namespace>."` calls
 *     in pages served by that route before tightening.
 */

import { getRequestConfig } from "next-intl/server"
import { cookies, headers } from "next/headers"
import { LOCALE_COOKIE_NAME, DEFAULT_LOCALE, isValidLocale, type Locale } from "@/shared/config/locale-constants"
import { readOverrides, readVersion, type OverrideMap } from "@/app/api/i18n/_lib/storage"

// ─── Namespace catalogue ──────────────────────────────────────────────────────

/** Every JSON namespace under `messages/<locale>/`. Keep in sync with disk. */
type Namespace =
  | "common"
  | "auth"
  | "errors"
  | "nav"
  | "crud"
  | "forms"
  | "table"
  | "map"
  | "dashboard"
  | "settings"
  | "pages"
  | "pages_dynamic"
  | "pages_tickets"
  | "pages_tracking"
  | "theme"
  | "admin"
  | "showcase"
  | "Enum"

/**
 * The namespace key as exposed to consumers (e.g. `t("Enum.foo")`) does not
 * always match the on-disk filename casing. Map only where they differ.
 */
const NAMESPACE_FILENAME: Partial<Record<Namespace, string>> = {
  Enum: "enum",
}

// `auth` is in ALWAYS because two components mount on every route and read
// from it: AppShellSkeleton (shown by AuthGuard while the session resolves)
// and SessionExpiryBanner (rendered by ClientProviders for token-refresh
// failures). Both can fire on the dashboard root, not just /auth/*, so
// scoping `auth` to /auth/* alone produces whole-namespace MISSING_MESSAGE
// errors on the rest of the app. The file is ~5 KB — cheap to always load.
//
// `crud` follows the same pattern: CommandPalette is mounted by the
// dashboard layout on every dashboard route and calls
// `t("crud.messages.no_results")` (CommandPalette.tsx:48). The dashboard
// root (`/`, `/dashboard`) returns early below WITHOUT adding `crud`, so
// the palette throws a whole-namespace MISSING_MESSAGE there. Adding
// `crud` to ALWAYS fixes it globally — same shape as the auth bug
// (commit 5aa2ba7).
// `admin` joins ALWAYS because the admin-tool surfaces (entity-override editor,
// system-entities panel, builders) render raw i18n keys whenever the namespace
// isn't loaded for their route — and the path-aware selection misses them in
// practice. At ~2.4 KB it is the cheapest, most reliable fix: the admin tools
// resolve their labels on every route they can be mounted from.
//
// `theme` joins for the same reason: the ThemeCustomizer floating button is
// mounted by the dashboard layout on EVERY route, so the customizer panel
// (title, tabs, actions, sections) must resolve its labels everywhere — not
// just on /settings/theme. The file is ~2 KB.
const ALWAYS: ReadonlySet<Namespace> = new Set(["common", "errors", "auth", "crud", "admin", "theme"])

// The complete namespace set. Used as a safe fallback when the `x-pathname`
// request header is absent — in that case path-aware selection cannot be
// trusted (it would silently collapse to the `/dashboard` set and drop the
// section namespaces, surfacing as raw i18n keys on /settings, /sales-invoices,
// /tickets and page-builder pages). Loading everything (~150 KB) guarantees
// correctness; the path-aware optimization still applies whenever the header
// is present.
const ALL_NAMESPACES: ReadonlySet<Namespace> = new Set([
  "common",
  "auth",
  "errors",
  "nav",
  "crud",
  "forms",
  "table",
  "map",
  "dashboard",
  "settings",
  "pages",
  "pages_dynamic",
  "pages_tickets",
  "pages_tracking",
  "theme",
  "admin",
  "showcase",
  "Enum",
])

// ─── Path → namespace mapping ────────────────────────────────────────────────

/**
 * Path-classification helpers. Splitting the predicates out keeps the main
 * dispatcher under the per-function complexity budget and makes each rule
 * obvious in isolation.
 */
const isAuthPath = (p: string): boolean => p.startsWith("/auth")
const isStatusPagePath = (p: string): boolean => p === "/403" || p === "/404"
const isDashboardRoot = (p: string): boolean => p === "/" || p === "/dashboard"
const isDashboardWidget = (p: string): boolean => p === "/dashboard/kpis" || p === "/dashboard/alerts"
// The drag-and-drop analytics canvas (/dashboard/canvas) renders the same
// widget library as the dashboard root (DashboardCanvas + WidgetCard +
// AddWidgetPicker), all of which call `useT("dashboard")`. It is NOT a
// dashboard *root* (no entity/map widgets) nor a kpis/alerts *widget* route,
// so it needs the `dashboard` namespace loaded without the extra
// table/map/pages overhead the root pulls in.
const isDashboardCanvas = (p: string): boolean => p === "/dashboard/canvas"

/** Routes that render a map widget — boundary preview, tracking, etc. */
function usesMap(p: string): boolean {
  return (
    p.startsWith("/tracking") ||
    p === "/dashboard/kpis" ||
    p.startsWith("/cities") ||
    p.startsWith("/areas") ||
    p.startsWith("/orders") ||
    p.startsWith("/example") ||
    p.startsWith("/launch-points") ||
    p.startsWith("/distribution-") ||
    // Work-session detail (/work-sessions/[id]) renders SessionMapCard →
    // UnifiedMap, which always mounts MapLoadingOverlay + MapControls
    // (both `useT("map")`). Without `map` here the overlay/controls show
    // raw keys ("Loading", "Api Key Check", …).
    p.startsWith("/work-sessions")
  )
}

/** Section-level extras. Each call mutates `ns` in place. */
function addSectionNamespaces(p: string, ns: Set<Namespace>): void {
  if (p.startsWith("/settings")) {
    ns.add("settings")
    if (p === "/settings/theme") ns.add("theme")
  }
  if (p.startsWith("/tickets") || p.startsWith("/ticket-messages")) ns.add("pages_tickets")
  if (p.startsWith("/tracking") || isDashboardWidget(p)) ns.add("pages_tracking")
  // Page Builder dynamic + materialized pages live under /pages/* and load
  // their copy from `pages_dynamic.json` (Phase 8 — admin can edit via the
  // Translation editor without redeploying). Built pages (and the builder
  // canvas) can host a `map-block`, which renders UnifiedMap → MapControls /
  // MapLoadingOverlay (`useT("map")`), so `map` rides along with the page
  // builder surfaces too.
  if (p.startsWith("/pages/") || p.startsWith("/admin/page-builder")) {
    ns.add("pages_dynamic")
    ns.add("map")
  }
  if (usesMap(p)) ns.add("map")
  if (p.startsWith("/admin") || p === "/builder" || p.startsWith("/builder/")) ns.add("admin")
  // The component showcase ("All") loads its own namespace for the page header,
  // section titles/descriptions, sticky-nav labels and the maps preview.
  if (p.startsWith("/showcase")) ns.add("showcase")
}

/**
 * Decide which namespaces a given path needs. Conservative on purpose: when
 * in doubt, include rather than exclude — a missing namespace surfaces as
 * "missing translation" warnings, which are noisier than a few extra KB.
 */
function namespacesForPath(pathname: string): ReadonlySet<Namespace> {
  const ns = new Set<Namespace>(ALWAYS)

  // Auth pages stand alone — no nav, no app shell. `auth` itself is already
  // in ALWAYS (see note above), so just short-circuit here.
  if (isAuthPath(pathname)) return ns

  // Standalone status pages — keep minimal.
  if (isStatusPagePath(pathname)) return ns

  // Everything below renders inside the dashboard shell, so nav + Enum are
  // needed (sidebar labels and shared enum displays).
  ns.add("nav")
  ns.add("Enum")

  if (isDashboardRoot(pathname) || isDashboardWidget(pathname) || isDashboardCanvas(pathname)) {
    ns.add("dashboard")
  }

  // Dashboard root + widget routes: the widgets mount their own data
  // hooks AND render entity configs (the alerts widget surfaces a
  // DataTable of Notification rows whose columns and toolbar headings
  // resolve from `pages.notification.*`). Without `pages` + `table` +
  // `map` + `pages_tracking` loaded, the first render throws a wall of
  // MISSING_MESSAGE warnings — visible only in dev but expensive in
  // browser CPU + noise during debugging.
  //
  // We do still short-circuit before adding `forms` / `crud`, which the
  // dashboard widgets don't touch (no CRUD forms on the root) so the
  // overhead stays bounded.
  if (isDashboardRoot(pathname)) {
    ns.add("table")
    ns.add("map")
    ns.add("pages")
    ns.add("pages_tracking")
    // `forms` is needed because entity configs reference shared field
    // labels (e.g. `forms.baseEntityType`) — even on the dashboard root
    // an alerts widget that surfaces a Notification entity rerenders
    // form-derived headings.
    ns.add("forms")
    return ns
  }

  // Default for app routes: list / detail / edit pages all consume pages,
  // crud, forms, table.
  ns.add("crud")
  ns.add("forms")
  ns.add("table")
  ns.add("pages")

  addSectionNamespaces(pathname, ns)
  return ns
}

// ─── Loader ───────────────────────────────────────────────────────────────────

// Module-level cache for parsed namespace JSON. Node's import system already
// caches the dynamic-import result, but the awaited promise chain still costs
// a microtask per call — and there are up to ~10 calls per request via
// Promise.all in `loadMessages`. The explicit Map skips the await entirely
// on warm hits, so `getRequestConfig` resolves synchronously after the first
// render of a given (locale, namespace) pair.
//
// JSON namespace files don't change at runtime (they ship with the deploy),
// so this cache has no invalidation path. Dev-mode hot-reload restarts the
// process, which clears the Map.
const namespaceCache = new Map<string, Record<string, unknown>>()

async function loadNamespace(locale: Locale, name: Namespace): Promise<Record<string, unknown>> {
  const cacheKey = `${locale}:${name}`
  const cached = namespaceCache.get(cacheKey)
  if (cached) return cached
  const filename = NAMESPACE_FILENAME[name] ?? name
  // The literal `.json` suffix is required for webpack/turbopack to produce
  // code-split chunks; the locale and filename are interpolated dynamically.
  const mod = (await import(`../../messages/${locale}/${filename}.json`)) as { default: Record<string, unknown> }
  namespaceCache.set(cacheKey, mod.default)
  return mod.default
}

async function loadMessages(locale: Locale, names: ReadonlySet<Namespace>): Promise<Record<string, unknown>> {
  const entries = await Promise.all([...names].map(async name => [name, await loadNamespace(locale, name)] as const))
  return Object.fromEntries(entries)
}

// ─── Override merging ────────────────────────────────────────────────────────
//
// Overrides are flat keys of the form `<namespace>.<keyPath>` (see
// src/app/api/i18n/_lib/storage). At request time we merge them on top of
// the file-loaded namespace JSON so admin edits (Task 7) take effect without
// a redeploy.
//
// Caching strategy:
//   - The cache key is `<locale>:<version>`. Reading the version is a single
//     small file read; on a cache hit (same version, within TTL) we skip
//     the JSON parse entirely.
//   - 60-second TTL caps how long a stale entry can survive in the off-chance
//     that the version-bump-then-router-refresh path is bypassed (e.g.
//     pages without the watcher mounted).
//   - Map is bounded — old entries get evicted as new versions write in.

interface OverrideCacheEntry {
  map: OverrideMap
  cachedAt: number
}

const OVERRIDE_TTL_MS = 60_000
const OVERRIDE_CACHE_LIMIT = 20
const overrideCache = new Map<string, OverrideCacheEntry>()

async function loadOverrideMap(locale: Locale): Promise<OverrideMap> {
  const version = await readVersion()
  const key = `${locale}:${version}`
  const hit = overrideCache.get(key)
  if (hit && Date.now() - hit.cachedAt < OVERRIDE_TTL_MS) return hit.map

  const map = await readOverrides(locale)
  overrideCache.set(key, { map, cachedAt: Date.now() })
  if (overrideCache.size > OVERRIDE_CACHE_LIMIT) {
    const firstKey = overrideCache.keys().next().value
    if (firstKey) overrideCache.delete(firstKey)
  }
  return map
}

/**
 * Set a deep value at `dotPath` inside `obj`, creating intermediate objects
 * as needed. Mutates in place. Caller is responsible for not mutating the
 * shared module-cached JSON imports — see `applyOverrides`.
 *
 * Refuses any segment named `__proto__`, `constructor`, or `prototype` to
 * close the prototype-pollution path. Without this guard, an attacker with
 * translation-admin permission could submit `keyPath="__proto__.x"` via
 * the i18n overrides API and pollute Object.prototype process-wide.
 */
const FORBIDDEN_SEGMENTS = new Set(["__proto__", "constructor", "prototype"])

function setDeep(obj: Record<string, unknown>, dotPath: string, value: unknown): void {
  const segments = dotPath.split(".")
  if (segments.some(seg => FORBIDDEN_SEGMENTS.has(seg))) return
  let cursor: Record<string, unknown> = obj
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i]!
    const next = cursor[seg]
    if (typeof next !== "object" || next === null) {
      cursor[seg] = Object.create(null)
    }
    cursor = cursor[seg] as Record<string, unknown>
  }
  const lastSeg = segments[segments.length - 1]!
  cursor[lastSeg] = value
}

/**
 * Apply the override map on top of the loaded messages. Overrides win.
 * Each touched namespace is structured-cloned first so we don't mutate the
 * imported JSON module (which is reused across requests).
 */
function applyOverrides(messages: Record<string, unknown>, overrides: OverrideMap): Record<string, unknown> {
  if (Object.keys(overrides).length === 0) return messages

  const cloned: Record<string, unknown> = { ...messages }
  const touched = new Set<string>()

  for (const [flatKey, value] of Object.entries(overrides)) {
    const dotIdx = flatKey.indexOf(".")
    if (dotIdx <= 0) continue // overrides without a namespace prefix have nowhere to land
    const namespace = flatKey.slice(0, dotIdx)
    const keyPath = flatKey.slice(dotIdx + 1)
    if (!(namespace in cloned)) continue // namespace not loaded for this route — skip silently

    if (!touched.has(namespace)) {
      cloned[namespace] = structuredClone(cloned[namespace])
      touched.add(namespace)
    }
    setDeep(cloned[namespace] as Record<string, unknown>, keyPath, value)
  }

  return cloned
}

// ─── Config ──────────────────────────────────────────────────────────────────

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const localeCookie = cookieStore.get(LOCALE_COOKIE_NAME)?.value
  const locale: Locale = isValidLocale(localeCookie) ? localeCookie : DEFAULT_LOCALE

  // Pathname is injected by middleware.ts via `x-pathname`. If we somehow
  // miss it (e.g. route bypassed middleware), default to a permissive set
  // that covers the common dashboard case. A missing pathname is not a
  // correctness problem — it just under-shrinks the bundle for that one
  // request.
  const headerStore = await headers()
  const pathnameHeader = headerStore.get("x-pathname")

  // When the header is present, use the optimized path-aware namespace set.
  // When it's ABSENT (middleware didn't run / didn't propagate it), fall back
  // to the COMPLETE set rather than the narrow `/dashboard` set — otherwise
  // section pages render raw i18n keys (see ALL_NAMESPACES note above).
  const namespaces = pathnameHeader ? namespacesForPath(pathnameHeader) : ALL_NAMESPACES
  const [baseMessages, overrides] = await Promise.all([loadMessages(locale, namespaces), loadOverrideMap(locale)])
  const messages = applyOverrides(baseMessages, overrides)

  return {
    locale,
    messages,
    // Iraq (IRDT — no DST, UTC+3 year-round). Dates rendered by `t()` /
    // `<FormattedDate>` use this zone unless an explicit `timeZone` prop
    // overrides them at the call site. Was previously "UTC", which showed
    // every timestamp 3 hours off the user's wall clock.
    timeZone: "Asia/Baghdad",
    now: new Date(),
    onError: error => {
      if (error.message.includes("INSUFFICIENT_PATH")) return
      if (process.env.NODE_ENV === "production" && error.code === "MISSING_MESSAGE") return
      if (process.env.NODE_ENV !== "production") {
        console.warn("[i18n]", error.message)
      }
    },
    getMessageFallback: ({ namespace, key }) => {
      const fullKey = namespace ? `${namespace}.${key}` : key
      const parts = fullKey.split(".")
      const lastPart = parts[parts.length - 1]
      if (!lastPart) return fullKey
      return lastPart
        .replace(/([A-Z])/g, " $1")
        .replace(/_/g, " ")
        .replace(/\b\w/g, l => l.toUpperCase())
        .trim()
    },
  }
})
