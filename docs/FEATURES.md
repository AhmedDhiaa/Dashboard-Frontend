# Features — Catalog & Examples

> A feature-by-feature guide to **what the platform does** and **how to use each
> capability**, with a concrete example per feature. This complements
> [SYSTEM.md](./SYSTEM.md) (the architecture reference) and the deep-dive docs it
> links to. When this file and the code disagree, the code wins.

The platform is a **white-label, config-driven admin/control-plane** for an ABP
backend (or a fully standalone mock). You describe an entity once; the engine
renders its list, detail, edit, filters, table, permissions, and i18n.

**Index**
1. [Brand / white-label](#1-brand--white-label)
2. [Config-driven CRUD engine](#2-config-driven-crud-engine)
3. [Entity configuration](#3-entity-configuration)
4. [Data table](#4-data-table)
5. [Forms & validation](#5-forms--validation)
6. [Enums](#6-enums)
7. [Permissions & auth](#7-permissions--auth)
8. [i18n & RTL](#8-i18n--rtl)
9. [Theme Studio](#9-theme-studio)
10. [Translation editor](#10-translation-editor)
11. [No-code builders (entity / widget / page / runtime)](#11-no-code-builders)
12. [Maps & live tracking](#12-maps--live-tracking)
13. [Standalone mock mode](#13-standalone-mock-mode)
14. [Security safeguards](#14-security-safeguards)
15. [Rate limiting](#15-rate-limiting)
16. [Observability](#16-observability)
17. [Notifications, Excel export, misc](#17-notifications-excel-export-misc)

---

## 1. Brand / white-label

**What:** rebrand the whole app — product name, primary domain, image allow-list,
demo emails — with **two environment variables**. No code edits.

**Where:** [src/shared/config/brand.ts](../src/shared/config/brand.ts), wired into
`next.config.ts` (image domains), the mock data, and the auth UI.

**Example** — rebrand to "Northwind" on `northwind.io`:
```bash
# .env
NEXT_PUBLIC_APP_NAME=Northwind
NEXT_PUBLIC_BRAND_DOMAIN=northwind.io
```
```tsx
import { APP_NAME, BRAND_DOMAIN } from "@/shared/config/brand"
<h1>{APP_NAME}</h1>                    // "Northwind"
const email = `demo@${BRAND_DOMAIN}`  // "demo@northwind.io"
```
Defaults are neutral placeholders (`Acme` / `example.com`). Logo assets live at
`public/acme-light.png` / `public/acme-dark.png` and `public/logo.png` — replace
the files to swap the logo.

---

## 2. Config-driven CRUD engine

**What:** the heart of the platform. A single set of generic components renders a
full CRUD surface (list + detail + edit) from an entity config. Route files are
thin delegators — all logic lives once in `core/crud`.

**Where:** [src/core/crud/components/](../src/core/crud/components/) —
`ConfigDrivenListPage`, `ConfigDrivenDetailPage`, `ConfigDrivenEditPage`, `CRUDListPage`.

**Unified routing:** "simple" entities (list + detail + edit, no custom
sub-pages) share **one** dynamic route —
[`src/app/(dashboard)/[entity]/`](../src/app/(dashboard)/[entity]/) — instead of
three hand-written files each. The URL slug → config-name map lives in
[`[entity]/routes.ts`](<../src/app/(dashboard)/[entity]/routes.ts>); adding a
simple entity is **one line** there. Entities that need a custom page or extra
sub-routes (orders, employees, reports…) keep an explicit folder, which the App
Router prefers over the dynamic route. [`cities/`](<../src/app/(dashboard)/cities/>)
is kept as the worked example of an explicit override.

**Example** — the dynamic list route resolves the slug and renders the engine:
```tsx
// src/app/(dashboard)/[entity]/page.tsx
export default async function EntityListPage({ params }) {
  const { entity } = await params
  const configName = resolveEntityConfigName(entity) // "brands" → "brand"
  if (!configName) notFound()
  return (
    <PagePermissionGuard entityName={configName} action="view">
      <Suspense fallback={<DataTableSkeleton />}>
        <ConfigDrivenListPage entityConfigName={configName} />
      </Suspense>
    </PagePermissionGuard>
  )
}
```
The engine pulls columns, filters, search, pagination, sorting, row actions,
create/edit routes, permissions and i18n from the config — no per-entity table
or form code.

---

## 3. Entity configuration

**What:** the declarative description of an entity — list columns, detail
sections, form fields, filters, permissions, routes, service binding. One config
drives every surface. Configs are **lazy-loaded** (one chunk per entity) and
registered in a generated `init.ts`.

**Where:** `src/domains/<group>/<entity>/<entity>.config.tsx` (+ `.service.ts`,
`.schema.ts`, `.types.ts`). Registry: [src/core/entities/](../src/core/entities/).
Admin overrides merge on top at request time.

**Example** — minimal config skeleton:
```tsx
export const brandConfig = defineEntityConfig({
  entityName: "brand",
  permissionKey: "Brand",
  service: brandService,
  listColumns: [
    { field: "code", type: "badge-code" },
    { field: "name", type: "text-primary" },
    { field: "isActive", type: "boolean" },
  ],
  filterFields: [{ name: "isActive", type: "boolean" }],
  defaultSort: { field: "creationTime", direction: "desc" },
})
```
Run `npm run init-entities` after adding a config (the build does this
automatically) to register its lazy loader.

---

## 4. Data table

**What:** a server-paginated, sortable, filterable TanStack-based table with
column visibility, search, Excel export, expandable rows, and stale-while-
revalidate (kept-alive rows dim during refetch — no skeleton flash). Columns are
generated from metadata via an `accessorFn` resolver that silently handles
nested/undefined paths.

**Where:** [src/core/data-table/](../src/core/data-table/),
[src/ui/crud/renderers/table-column-factory.tsx](../src/ui/crud/renderers/table-column-factory.tsx).

**Example** — columns from metadata (what the engine does for you):
```tsx
const columns = createColumnsFromMetadata<Brand>([
  { field: "code", type: "badge-code" },
  { field: "cityInfo.entity.name", type: "text-primary" }, // dotted paths resolve safely
])
```
Each column exposes `id` + `accessorFn` (not `accessorKey`) on purpose — the
silent resolver avoids TanStack's per-cell dev-warning flood on nested undefined.

---

## 5. Forms & validation

**What:** config-driven forms (react-hook-form + Zod) with field ordering,
sections, and translated validation messages. A custom ESLint rule
(`no-manual-form-fields`) keeps forms config-driven.

**Where:** [src/core/forms/](../src/core/forms/), schemas in `*.schema.ts`,
validation helpers in [i18n.hooks.ts](../src/shared/config/i18n.hooks.ts) (`useValidation`).

**Example:**
```tsx
const { required, email } = useValidation()
const schema = z.object({
  name: z.string().min(1, required()),
  contactEmail: z.string().email(email()),
})
```

---

## 6. Enums

**What:** centrally cached enum values (status, type…) shared app-wide, loaded
on demand and preloaded for the common ones. Used by table badges, filters, and
selects. Context value is memoized so consumers only re-render on real changes.

**Where:** [src/core/enums/](../src/core/enums/) — `EnumProvider`, `useEnum`.

**Example:**
```tsx
const { getEnumName } = useEnumContext()
getEnumName("status", row.status, "ar") // localized status label
```

---

## 7. Permissions & auth

**What:** NextAuth v5 (→ ABP OAuth2) sessions with HttpOnly cookies; live
permissions from ABP application-configuration (refreshed every 5 min, not
session-frozen); page/route/column-level guards; admin bypass. Permission keys
are typed constants (a lint rule bans string literals).

**Where:** [src/infra/auth/](../src/infra/auth/),
[src/core/auth/](../src/core/auth/), `middleware.ts` (cookie gate),
`shared/auth/permission-keys`.

**Example:**
```tsx
const { isGranted, isAdmin } = usePermissions()
if (isGranted("Order.Create")) { /* show create button */ }

// Route-level:
<PagePermissionGuard entityName="order" action="view">…</PagePermissionGuard>
```

---

## 8. i18n & RTL

**What:** first-class English/Arabic with **path-aware lazy namespace loading**
(each route loads only the message namespaces it needs, cached per process),
runtime overrides (admins edit copy without redeploy), and logical-direction CSS
(a lint rule bans physical `left/right`). 19 namespaces, en/ar key parity enforced
in CI.

**Where:** [src/i18n/request.ts](../src/i18n/request.ts), `messages/{en,ar}/`,
[useT](../src/shared/config/i18n.hooks.ts).

**Example:**
```tsx
const t = useT("pages_tickets")
t("tickets.connection.connecting")     // namespaced lookup
const { isRTL, dir } = useLocale()
dir("ml-2", "mr-2")                    // pick by direction
```

---

## 9. Theme Studio

**What:** a live, token-based theme customizer. Admins pick palettes, fonts, radii
etc.; tokens are server-rendered into the first paint (no FOUC) and published
versions hot-apply to every signed-in user via a SignalR version watcher +
`router.refresh()`. CSS injection is filtered (key/value allow-list).

**Where:** [src/features/admin-tools/theme-customizer/](../src/features/admin-tools/theme-customizer/),
`src/app/api/theme/`, `src/ui/theme/`. Token build:
`src/app/api/theme/_lib/build-css.ts`.

**Example** — the layout server-renders live tokens:
```tsx
const themeStore = await readThemeStore()
const themeCss = buildThemeCss(themeStore.live.tokens) // emits :root{ --primary: … }
```

---

## 10. Translation editor

**What:** an in-app overlay to edit any visible string by clicking it, mapping the
DOM node back to its `(namespace, key)` and writing an override (or, with codegen
enabled, the source catalog). Backed by a "translation tap" every `useT()` call
reports through.

**Where:** [src/features/admin-tools/translation-editor/](../src/features/admin-tools/translation-editor/).
See [docs/ADMIN-TOOLS.md](./ADMIN-TOOLS.md).

---

## 11. No-code builders

Four runtime builders let admins extend the app without a deploy. Source-writing
pipelines are gated behind `APP_ALLOW_RUNTIME_CODEGEN` (DEV-only; the platform
refuses to boot with it on in prod absent an explicit override — see §14).

- **Entity builder** — define a new entity (fields, columns, permissions) from
  the UI; optionally materialize it to real source files.
- **Widget builder** — compose dashboard widgets from data sources + chart types.
- **Page builder** — drag-and-drop pages from a block palette (incl. map blocks),
  served under `/pages/*`. Deep dive: [docs/page-builder/](./page-builder/).
- **Runtime builder** — a fully client-side (or server-backed) no-code store for
  entities, records, pages and dashboards.

**Where:** [src/features/admin-tools/](../src/features/admin-tools/),
[src/features/runtime-builder/](../src/features/runtime-builder/),
`src/app/api/admin/*`, `src/app/api/runtime/*`.

**Example** — backend choice for the runtime store:
```bash
NEXT_PUBLIC_RUNTIME_BACKEND=server   # shared, stored under messages/_overrides/runtime/
NEXT_PUBLIC_RUNTIME_BACKEND=local    # per-browser localStorage (offline demos)
```

---

## 12. Maps & live tracking

**What:** a Google-Maps engine (search, boundaries/polygons, marker clustering,
drawing) and **live SignalR tracking** of orders/vehicles on the map. The maps
SDK and SignalR are lazy/bundle-split so non-map routes don't pay for them.

**Where:** [src/features/maps/](../src/features/maps/),
[src/features/tracking/](../src/features/tracking/),
[src/infra/socket/](../src/infra/socket/) (SignalR singleton).

**Example:**
```bash
NEXT_PUBLIC_ENABLE_MAPS=true
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=<restricted-to-your-referrers>
NEXT_PUBLIC_SOCKET_URL=https://your-api.example.com/service-system-hub
```
In standalone mock mode the socket is disabled automatically (no hub to reach).

---

## 13. Standalone mock mode

**What:** run the **entire app with no backend** on seeded, deterministic
in-memory data — offline login (`demo`/`demo`), all permissions, populated
tables/charts/maps, session-persistent CRUD. Ideal for demos and front-end dev.

**Where:** [src/infra/api/mock/](../src/infra/api/mock/). Toggle:
```bash
NEXT_PUBLIC_USE_MOCK_API=true      # standalone; false = real backend
NEXT_PUBLIC_MOCK_LATENCY_MS=80     # artificial latency so skeletons flash; 0 = instant
```
The mock swaps axios's adapter for an in-memory store; everything else (auth UI,
React Query, interceptors) runs unchanged. See [docs/FRONTEND-TEMPLATE.md](./FRONTEND-TEMPLATE.md).

---

## 14. Security safeguards

**What:** fail-fast startup guards and defense-in-depth that prevent dangerous
misconfigurations from reaching production.

**Where:** [src/shared/safeguards/](../src/shared/safeguards/), run from
`instrumentation.ts` via `run-startup-safeguards.ts`.

- **Mock-in-prod guard** — refuses to boot if `NEXT_PUBLIC_USE_MOCK_API=true` in
  production (mock grants every visitor full admin) unless an explicit override
  token is set. [mock-api-flag.ts](../src/shared/safeguards/mock-api-flag.ts).
- **Runtime-codegen guard** — refuses to boot with `APP_ALLOW_RUNTIME_CODEGEN=true`
  in prod absent an override; route handlers additionally hard-block source writes
  whenever `NODE_ENV=production`.
- **Dev-warmup auth bypass** — gated on `isDev` **and** a direct (non-proxied)
  request, so it can never fire for an external visitor even if `NODE_ENV` were
  misconfigured (`middleware.ts`).
- **CSP + nonce, HSTS, secure headers** — `middleware.ts` + `next.config.ts`.
- **Open-redirect & URL-pollution defense** — `getSafePath`, `server.ts` URL
  sanitizer. **Leaked-secret scan** — `scripts/check-leaked-secrets.mjs`.

**Example** — a deliberate public demo opts in explicitly:
```bash
NEXT_PUBLIC_USE_MOCK_API=true
NEXT_PUBLIC_USE_MOCK_API_PROD_OVERRIDE=i-understand-this-is-a-public-demo
```

---

## 15. Rate limiting

**What:** per-IP, per-route limits (e.g. login brute-force cap) with RFC-6585 +
`X-RateLimit-*` headers. In-memory by default; Redis/Upstash for multi-instance.
Secure client-IP extraction (rightmost trusted XFF hop) resists spoofing.

**Where:** [src/infra/ratelimit/](../src/infra/ratelimit/), wired in `middleware.ts`.

**Example:**
```bash
# multi-instance production — pick one:
UPSTASH_REDIS_REST_URL=…  UPSTASH_REDIS_REST_TOKEN=…   # edge-friendly
REDIS_URL=redis://…                                    # Node runtime
```

---

## 16. Observability

**What:** structured logging (level-gated, console + optional webhook) and Sentry
error/perf reporting — inert in dev/without a DSN, sampled in prod. A correlation
ID threads request/response logs.

**Where:** [src/shared/logger](../src/shared/logger/),
[src/infra/observability/](../src/infra/observability/), `instrumentation*.ts`.

**Example:**
```bash
NEXT_PUBLIC_SENTRY_DSN=…           # enables client reporting (prod)
NEXT_PUBLIC_LOG_LEVEL=info
NEXT_PUBLIC_ERROR_REPORT_ENDPOINT=https://…   # structured JSON error webhook
```

---

## 17. Notifications, Excel export, misc

- **Toasts** — one system (`useNotification` → sonner), top-center, variant-accented,
  with an **undo** affordance used by optimistic delete. `src/ui/application`.
- **Excel export** — every table can export; ExcelJS is **dynamically imported**
  only on click (a lint rule blocks static heavy imports). `src/shared/utils/excel.ts`.
- **Command palette** — `Cmd/Ctrl-K` navigation, lazy-loaded, permission-filtered.
  `src/features/navigation/CommandPalette`.
- **Dev route warmup** — `server.ts` pre-compiles the heavy module graphs at boot
  so first navigation in dev is warm (production navigation is already instant).

---

## Adding a new entity — end to end

1. Create `src/domains/<group>/<entity>/<entity>.config.tsx` (+ `.service.ts`,
   `.schema.ts`, `.types.ts`); set `basePath: "/<slug>"` to the plural URL slug.
2. **Routing** — for a *simple* entity, add **one line** to
   [`[entity]/routes.ts`](<../src/app/(dashboard)/[entity]/routes.ts>):
   `"<slug>": "<config-name>"`. No route files. For an entity that needs a custom
   page or extra sub-routes, add an explicit `src/app/(dashboard)/<slug>/` folder
   instead (thin delegators to `ConfigDriven*Page`, like `cities/`).
3. Add the permission keys and a nav entry; add i18n keys under `messages/{en,ar}/pages.json`.
4. `npm run init-entities` (automatic in `build`) registers the lazy loader.
5. `npm run quality` validates layers, i18n parity/usage, RSC boundaries, and types.

That's it — list, detail, edit, filters, search, sort, export, permissions and
localization all come from the one config.
