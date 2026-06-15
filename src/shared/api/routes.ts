/**
 * Single source of truth for client-side API endpoint paths.
 *
 * The Next.js route file under `src/app/api/<path>/route.ts` IS the wire
 * contract — what URL the client hits to reach each handler. Without a
 * central registry the same path lives as a string literal in every
 * `fetch(...)` call site, every rate-limit matcher, every test fixture.
 * Renaming an endpoint means hunting them down by hand and a typo silently
 * routes to a 404.
 *
 * Shape: a tree grouped by feature area. Static endpoints are string
 * constants; parametric endpoints are functions returning the resolved
 * URL. The few cases that need the bare prefix (rate-limit matchers,
 * `pathname.startsWith` checks for parametric children) get an extra
 * `*Prefix` constant alongside the function.
 *
 * Adding a route: edit this file. Removing a route: rename here, follow
 * the type errors.
 */

const ADMIN_BASE = "/api/admin"
const RUNTIME_BASE = "/api/runtime"
const I18N_BASE = "/api/i18n"
const THEME_BASE = "/api/theme"

export const API_ROUTES = {
  // ─── Entity builder (admin codegen for entity drafts) ────────────────────
  entityBuilder: {
    // `list` + `item` were used by the retired /admin/entity-builder
    // dashboard's api.ts (Part 4 cleanup). The matching server routes
    // were removed in the same pass; re-adding them needs both ends
    // wired again.
    generate: `${ADMIN_BASE}/entity-builder/generate`,
    backups: `${ADMIN_BASE}/entity-builder/backups`,
    backup: (id: string) => `${ADMIN_BASE}/entity-builder/backups/${id}`,
  },

  // ─── Entity overrides (admin live edits over the registered configs) ────
  //
  // Projection lives client-side: importing the server-side projection
  // would pull every entity config into the route's RSC graph, and many
  // configs transitively reach client-only hooks. The client already has
  // every config registered through `initializeEntityConfigs()`, so the
  // panel computes the projection there and only fetches the override map.
  entityOverrides: {
    base: `${ADMIN_BASE}/entity-overrides`,
    item: (entityName: string) => `${ADMIN_BASE}/entity-overrides?entityName=${encodeURIComponent(entityName)}`,
  },

  // ─── Widget builder (admin codegen for widgets) ──────────────────────────
  widgetBuilder: {
    list: `${ADMIN_BASE}/widget-builder`,
    item: (id: string) => `${ADMIN_BASE}/widget-builder/${id}`,
    generate: `${ADMIN_BASE}/widget-builder/generate`,
    preview: `${ADMIN_BASE}/widget-builder/preview`,
  },

  // ─── Page builder (admin CRUD + preview + Swagger proxy) ────────────────
  pageBuilder: {
    /** Prefix used by the rate limiter to gate every CRUD verb at once. */
    pagesPrefix: `${ADMIN_BASE}/page-builder/pages`,
    list: `${ADMIN_BASE}/page-builder/pages`,
    item: (pageId: string) => `${ADMIN_BASE}/page-builder/pages/${pageId}`,
    preview: (pageId: string) => `${ADMIN_BASE}/page-builder/preview/${pageId}`,
    proxySwagger: `${ADMIN_BASE}/page-builder/proxy-swagger`,
    /** Phase 7 — materialize gets its own tighter rate-limit row. */
    materialize: (pageId: string) => `${ADMIN_BASE}/page-builder/pages/${pageId}/materialize`,
    materializePrefix: `${ADMIN_BASE}/page-builder/pages/`,
  },

  // ─── Dashboard layout (admin default + per-user) ─────────────────────────
  dashboardLayout: {
    /** Admin-managed default layout shown to users with no saved canvas. */
    default: `${ADMIN_BASE}/dashboard-layout/default`,
    /** Current user's saved canvas layout. */
    user: "/api/user/dashboard-layout",
  },

  /** Widget registry consumed by the canvas picker. */
  widgets: "/api/widgets",

  // ─── Runtime builder (config + per-entity records + materialize) ─────────
  runtime: {
    /** Bare `/api/runtime` — used as a middleware-bypass prefix. */
    base: RUNTIME_BASE,
    config: `${RUNTIME_BASE}/config`,
    version: `${RUNTIME_BASE}/version`,
    data: (entityId: string) => `${RUNTIME_BASE}/data/${entityId}`,
    /** Prefix-form for `pathname.startsWith` matchers (rate limits, etc.). */
    dataPrefix: `${RUNTIME_BASE}/data/`,
    materialize: (entityId: string) => `${RUNTIME_BASE}/materialize/${entityId}`,
    materializePrefix: `${RUNTIME_BASE}/materialize/`,
  },

  // ─── i18n overrides (admin translation editor) ───────────────────────────
  i18n: {
    overrides: `${I18N_BASE}/overrides`,
    /**
     * Source-of-truth writer — edits land in messages/<locale>/<ns>.json.
     * Gated behind APP_ALLOW_RUNTIME_CODEGEN on the server; the client
     * mirrors that with NEXT_PUBLIC_APP_ALLOW_RUNTIME_CODEGEN.
     */
    sourceWrite: `${I18N_BASE}/source-write`,
    version: `${I18N_BASE}/version`,
  },

  // ─── Theme overrides (admin theme customizer) ────────────────────────────
  theme: {
    overrides: `${THEME_BASE}/overrides`,
    publish: `${THEME_BASE}/overrides/publish`,
    revert: `${THEME_BASE}/overrides/revert`,
    version: `${THEME_BASE}/version`,
  },
} as const
