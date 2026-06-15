/**
 * MSW handlers — mocks the backend surfaces our tests touch.
 *
 * Why MSW
 * -------
 * Most of our network code (BaseCRUDService, OAuth2 service, ABP
 * application-configuration fetch) wires to the real `fetch` API. Mocking
 * `fetch` per-test gets repetitive and brittle — MSW intercepts at the
 * network layer, so the same handler works for `apiClient`, `auth()`,
 * and ad-hoc fetches alike.
 *
 * Coverage
 * --------
 * The handlers below cover the top backend endpoints the app talks to:
 *   - Identity / OAuth2 (token, refresh, application-configuration, roles)
 *   - Generic CRUD (`/api/app/<entity>` × the registered entity set)
 *   - i18n / theme overrides
 *   - SignalR negotiate
 *
 * For each `BASE_ENTITIES` entity we expose the four operations
 * BaseCRUDService uses (list, getById, create, update, delete). This is
 * one handler-pair per entity, but functionally distinct (each is a
 * separate URL pattern), keeping the "30 endpoints" target met without
 * cargo-culting per-entity duplicates.
 *
 * Customising per-test
 * --------------------
 * Tests can call `server.use(...handlers)` to override any of these for
 * the scope of a single test. See the example in the test util's README.
 */

import { http, HttpResponse } from "msw"
import type { HttpHandler } from "msw"
import { mswFixtures, type EntityRecord } from "./fixtures"

// Match against any base URL — tests configure NEXT_PUBLIC_API_URL to
// `http://localhost:3000` (see setup.ts). The wildcard prefix lets the
// same handler match absolute URLs (in production code) and relative
// `/api/...` calls (browser-side fetches).
const ABS = "*://*"

// Pulled from the registered entity set; covers the 30+ entity endpoints
// surfaced via the entity-builder/registry.
const BASE_ENTITIES = [
  "area",
  "audit-log",
  "banner",
  "brand",
  "business-partner",
  "category",
  "city",
  "country",
  "currency",
  "customer",
  "employee",
  "extra-charge",
  "item",
  "job-title",
  "loyalty-program",
  "notification",
  "order",
  "payment",
  "promo-code",
  "purchase-invoice",
  "reason",
  "receive",
  "role",
  "sales-invoice",
  "stock-entry",
  "stock-exit",
  "supplier",
  "ticket",
  "unit",
  "user",
  "vehicle",
  "example",
  "warehouse",
  "work-session",
] as const

const listFor = (e: string): EntityRecord[] => mswFixtures.get(e)
const nextId = (): string => mswFixtures.nextId()

// ─── CRUD handlers ───────────────────────────────────────────────────────────

function crudHandlers(entity: string): HttpHandler[] {
  const collection = `${ABS}/api/app/${entity}`
  const item = `${ABS}/api/app/${entity}/:id`
  return [
    http.get(collection, ({ request }) => {
      const url = new URL(request.url)
      const max = Number(url.searchParams.get("MaxResultCount") ?? 10)
      const skip = Number(url.searchParams.get("SkipCount") ?? 0)
      const all = listFor(entity)
      return HttpResponse.json({ items: all.slice(skip, skip + max), totalCount: all.length })
    }),
    http.get(item, ({ params }) => {
      const id = String(params.id)
      const found = listFor(entity).find(r => r.id === id)
      if (!found) return HttpResponse.json({ error: { message: "Not found" } }, { status: 404 })
      return HttpResponse.json(found)
    }),
    http.post(collection, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      const record: EntityRecord = { id: nextId(), ...body }
      listFor(entity).push(record)
      return HttpResponse.json(record, { status: 201 })
    }),
    http.put(item, async ({ params, request }) => {
      const id = String(params.id)
      const body = (await request.json()) as Record<string, unknown>
      const list = listFor(entity)
      const idx = list.findIndex(r => r.id === id)
      if (idx === -1) return HttpResponse.json({ error: { message: "Not found" } }, { status: 404 })
      const updated = { ...list[idx], ...body, id }
      list[idx] = updated as EntityRecord
      return HttpResponse.json(updated)
    }),
    http.delete(item, ({ params }) => {
      const id = String(params.id)
      const list = listFor(entity)
      const idx = list.findIndex(r => r.id === id)
      if (idx === -1) return HttpResponse.json({ error: { message: "Not found" } }, { status: 404 })
      list.splice(idx, 1)
      return HttpResponse.json({ success: true })
    }),
  ]
}

// ─── Identity / OAuth2 / ABP ─────────────────────────────────────────────────

const identityHandlers: HttpHandler[] = [
  // OAuth2 token endpoint — login + refresh both POST here.
  http.post(`${ABS}/connect/token`, async () => {
    return HttpResponse.json({
      access_token: "mock-access-token",
      refresh_token: "mock-refresh-token",
      expires_in: 3600,
      token_type: "Bearer",
    })
  }),
  // ABP application-configuration — the slim cache the permission
  // context refreshes from.
  http.get(`${ABS}/api/abp/application-configuration`, () => {
    return HttpResponse.json({
      currentUser: {
        id: "user-1",
        userName: "test-user",
        email: "test@example.com",
        roles: ["admin"],
        isAuthenticated: true,
      },
      auth: {
        grantedPolicies: {
          "Api.Admin.WidgetBuilder": true,
          "Api.Admin.EntityBuilder": true,
          "Api.Theme.Manage": true,
          "Api.Translation.Manage": true,
        },
      },
      setting: { values: {} },
      localization: { values: {}, languages: [] },
    })
  }),
  // ABP roles list (used by the user/role assignment flows).
  http.get(`${ABS}/api/identity/roles/all`, () => {
    return HttpResponse.json({
      items: [
        { id: "r1", name: "admin" },
        { id: "r2", name: "user" },
      ],
      totalCount: 2,
    })
  }),
  // SignalR negotiate — return a minimal connection descriptor so any
  // accidental connect() in tests fails fast and visibly rather than
  // hanging on a real WebSocket handshake.
  http.post(`${ABS}/notifications/negotiate`, () => {
    return HttpResponse.json({ connectionId: "mock-conn", availableTransports: [] })
  }),
]

// ─── Admin tools (entity-builder, widget-builder, theme, i18n) ───────────────

const adminToolHandlers: HttpHandler[] = [
  // Entity-builder: list drafts + per-entity fetch + clone.
  http.get(`${ABS}/api/admin/entity-builder`, () => HttpResponse.json({ drafts: [] })),
  http.get(`${ABS}/api/admin/entity-builder/:entity`, ({ params }) =>
    HttpResponse.json({ draft: { entityName: String(params.entity) } }),
  ),
  http.post(`${ABS}/api/admin/entity-builder/generate`, () =>
    HttpResponse.json({ success: true, mode: "draft", message: "saved" }),
  ),
  // Widget-builder: list + fetch + save.
  http.get(`${ABS}/api/admin/widget-builder`, () => HttpResponse.json({ widgets: [] })),
  http.get(`${ABS}/api/admin/widget-builder/:id`, ({ params }) =>
    HttpResponse.json({ widget: { id: String(params.id) } }),
  ),
  http.post(`${ABS}/api/admin/widget-builder/generate`, () =>
    HttpResponse.json({ success: true, mode: "draft", message: "saved" }),
  ),
  // i18n + theme override surfaces.
  http.get(`${ABS}/api/i18n/version`, () => HttpResponse.json({ version: 1 })),
  http.get(`${ABS}/api/i18n/overrides`, () => HttpResponse.json({ en: {}, ar: {} })),
  http.get(`${ABS}/api/theme/version`, () => HttpResponse.json({ version: 1 })),
  http.get(`${ABS}/api/theme/overrides`, () => HttpResponse.json({ tokens: {} })),
  // User dashboard layout.
  http.get(`${ABS}/api/user/dashboard-layout`, () => HttpResponse.json({ widgets: [], version: 0 })),
  http.put(`${ABS}/api/user/dashboard-layout`, () => HttpResponse.json({ success: true })),
  // Widgets registry.
  http.get(`${ABS}/api/widgets`, () => HttpResponse.json({ widgets: [] })),
  // Health probe.
  http.get(`${ABS}/api/health`, () => HttpResponse.json({ status: "ok" })),
]

// ─── Aggregate ──────────────────────────────────────────────────────────────

/** @public Imported by test setup files (vitest setup, playwright fixtures). */
export const handlers: HttpHandler[] = [
  ...identityHandlers,
  ...adminToolHandlers,
  ...BASE_ENTITIES.flatMap(crudHandlers),
]

export { mswFixtures } from "./fixtures"
