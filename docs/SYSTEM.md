# Acme Dashboard — System Reference (the source of truth)

> This is the **authoritative, verified** description of the system as it actually
> exists in code. It supersedes any prior planning/handoff/upgrade documents
> (now deleted). When a comment, badge, or older doc disagrees with this file,
> **this file and the code win.** `README.md` is the entry-point overview;
> this document is the deep reference.

**What it is:** a Next.js 16 (App Router) web control plane for an **ABP
Framework** ERP backend (`https://api.example.com`) covering orders, fleet, stock,
invoices, payments, loyalty, tickets, HR/work-sessions, geography, and reports —
fully bilingual (English / العربية, first-class RTL), with live SignalR tracking,
a Google-Maps engine, a runtime no-code builder, and a live theme customizer.

**At a glance (verified counts):** 14 domain groups · **54** entity configs ·
**203** dashboard pages · **37** API route handlers · 12 feature modules ·
9 admin-tool sub-features · 18 i18n namespaces · **144** test files.

---

## 1. Architecture — the 7-layer "clean sandwich"

`App → Features → Domains → Core → Infra → UI → Shared`, with **build-time-enforced**
import boundaries. Two enforcers:

- **`scripts/validate-architecture.ts`** (`npm run validate`) — import-graph analyzer
  with a zero-exception forbidden-imports matrix; confines `apiClient` to `infra/`
  and `*.service.ts` files only.
- **`eslint-plugin-custom/`** — `domain-boundary-enforcement`, `no-manual-crud-columns`,
  `no-manual-form-fields`, `require-entity-config`, `no-string-permission-key`,
  `no-physical-direction` (RTL), `no-static-heavy-import` (bundle budget),
  `max-lines-per-page`, plus complexity / `no-console` / hardcoded-color bans.

Layer rules: `shared` imports nothing app-internal; `ui` cannot reach
`infra`/`domains`/`features`; a feature may import `core`/`ui`/`infra`/`shared`
but **not** `@/app` or a sibling feature.

### Directory map

```text
src/
├── app/(dashboard)/     # 203 authenticated route shells (thin: guard + ConfigDriven* )
│   ├── auth/            # login, session-expired
│   └── api/             # 37 route handlers: runtime, admin, i18n, theme, user, health, auth
├── core/               # framework-agnostic engine
│   ├── auth/           #   PermissionContext, PagePermissionGuard
│   ├── crud/           #   ConfigDriven{List,Detail,Edit}Page + CRUDListPage + RecordBreadcrumb
│   ├── data-table/ entities/ enums/ forms/
├── domains/            # 14 groups, 54 *.config.tsx (+ service, schema, types each)
├── features/           # 12 isolated modules (admin-tools, runtime-builder, maps, tracking, …)
├── infra/              # api (axios + BaseCRUDService + QueryProvider), auth (NextAuth→ABP),
│                       #   socket (SignalR singleton), observability, ratelimit
├── ui/                 # design-system (Radix+CVA, token-only), data-table, layout, theme
├── shared/             # config, hooks, logger, safeguards, auth/permission-keys, types, utils
└── i18n/               # next-intl request config + path-aware namespace loader
middleware.ts           # cookie auth gate + CSP nonce + security headers + rate-limit
server.ts               # custom IIS/Azure-aware HTTP server (dev + prod), URL sanitization
```

---

## 2. The config-driven CRUD engine (the core idea)

One typed **`EntityConfig`** (`src/core/entities/types.ts`) is the single source of
truth for an entity: `service`, `listColumns`, `detailSections`, `formFields` +
Zod `createSchema`/`updateSchema`, `translations`, `features` flags,
`permissionKey`, `defaultSort`, `filterFields`, routing. Generic renderers in
`core/crud` consume it, so a route page is a ~3-line shell:

```tsx
// src/app/(dashboard)/brands/page.tsx
<PagePermissionGuard entityName="brand" action="view">
  <ConfigDrivenListPage entityConfigName="brand" />
</PagePermissionGuard>
```

**Registration:** configs are **lazily** registered (one dynamic `import()` per
entity — no barrel pulls all 54 into one chunk). The registry module
`src/core/entities/configs/init.ts` is **auto-generated** by
`scripts/generate-entity-init.ts` — **never hand-edit it**. The generator anchors
the registry key to the *exported* top-level `entityName` and **throws on
duplicate keys** (guards the historical `item`/`price-list` collision; covered by
`route-registry-resolution.test.ts`).

### List data flow (verified end-to-end)

```
page.tsx → ConfigDrivenListPage → CRUDListPage (TanStack Query)
        → service.getList(params) → BaseCRUDService (infra/api/crud-service.ts) → ABP
```

- **Search** → ABP `Term` (or a per-config `searchParam`; the Role endpoint uses
  `Filter`). **Sorting** → ABP `Sorting: "<field> <asc|desc>"`. **Pagination** →
  `SkipCount` / `MaxResultCount`. Multi-select filters serialize as repeated
  params (`DocumentStatus=1&DocumentStatus=2`).
- **Server-side sorting** is wired through the table: a header click updates
  `sorting` state → new query key → refetch with `Sorting`. The config's
  `defaultSort` seeds the initial sort. (Before: header clicks only re-ordered the
  visible page — a multi-page correctness bug, now fixed.)
- **Optimistic delete + undo** via React Query cache + a Sonner "Undo" toast;
  the DELETE is deferred until the toast times out.
- **Permissions:** page entry via `PagePermissionGuard` / `canView`; create/edit/
  delete gated in the list/detail pages; per-**column** gating
  (`ColumnMetadata.requiredPermission`) and per-**field** detail gating exist
  (mechanism shipped; sensitive columns are opt-in once the backend defines
  granular keys).

### Static vs runtime entities (dual-track)

- **Static** — typed `*.config.tsx` under `src/domains`, registered at build,
  served at `/<plural>`.
- **Runtime** — JSON schema authored in the `/builder` UI (no deploy), served by
  `app/(dashboard)/runtime/[entity]`, data via `api/runtime/data/[entityId]`.

---

## 3. The no-code builder platform

The dashboard can build and edit interfaces from within the UI. Two halves:

**`features/runtime-builder/`** — author runtime entities/pages/dashboards as JSON
(persisted under `messages/_overrides/runtime/config.json`), with per-entity record
CRUD. Reachable from the sidebar (`/builder`).

**`features/admin-tools/`** — 9 sub-features:

| Sub-feature | What it does | API surface |
| :-- | :-- | :-- |
| `entity-builder` | generate a full entity (config + route + service + schema) | `api/admin/entity-builder/{generate,backups,backups/[id]}` |
| `entity-converter` | convert a static entity to runtime-editable + restore | `api/admin/entities/[name]/{convert,restore}` |
| `entity-overrides` | **edit any registered entity's config in-UI** (labels, page size, field order…) | `api/admin/entity-overrides` |
| `page-builder` | drag-drop page composition from a swagger spec | `api/admin/page-builder/{pages,proxy-swagger}` |
| `widget-builder` | author dashboard widgets | `api/admin/widget-builder/*` |
| `git-bridge` | commit / revert generated code from the UI | `api/admin/git/{branch,commit,diff,revert,status}` |
| `translation-editor` | edit translations, write the JSON files | `api/i18n/{source-write,overrides,version}` |
| `theme-customizer` | live theme editing, persisted + versioned | `api/theme/overrides/*` |
| `registry-updater` | patch `navigation.ts` / `permission-keys.ts` for new entities | (used by materialize) |

The in-UI **override editor** (`SystemEntitiesPanel` + `EntityOverrideEditor`) is
mounted on **`/admin/entities`**: list every registered entity and edit its config
without touching source. Overrides persist to the git-ignored runtime store and
apply at read time (`core/entities/overrides`), hydrated in the root layout.

### Materialize — promote a runtime entity to real source

`api/runtime/materialize/[entityId]` (and the entity-builder generate path) write
typed `*.config.tsx` + route pages, merge i18n into `messages/{en,ar}/pages.json`,
patch the registry, and run `init-entities` — so the result is indistinguishable
from a handwritten entity. Author-provided Arabic (`field.labelAr`,
`pluralNameAr`/`singularNameAr`/`descriptionAr`) is threaded through; it falls back
to English when absent (no more mirrored-English in the `ar` slot).

**Safety gates (defense in depth):** env kill-switch
(`APP_ALLOW_RUNTIME_CODEGEN`) **AND** a `NODE_ENV !== production` route gate
(`api/_lib/codegen-gate.ts`) — source-writing codegen is **dev-only**; the draft/
preview paths stay available. Plus: permission gate, rate-limit, `safe-path`
allowlist with symlink resolution, sandboxed `tsc` typecheck, byte-level rollback,
backup snapshot + JSONL audit, and a startup safeguard that refuses to boot a prod
server with the flag armed (absent an explicit override token).

> **Deployment posture:** the builder's *source-write* surfaces are **dev-only**.
> In production, a normal build returns 409 / 404 for the write paths; config
> editing in prod goes through the git-ignored **entity-overrides** layer (no
> codegen). On a dev box, set `APP_ALLOW_RUNTIME_CODEGEN=true` to enable
> materialize/git/source-write.

---

## 4. Internationalization

- **`next-intl`** with **path-aware lazy namespace loading** — a route loads only
  the namespaces it needs (`src/i18n/request.ts`, driven by the `x-pathname`
  header set in middleware). 18 namespaces.
- **Parity is a CI gate** — `check:i18n-parity` enforces identical en/ar key sets
  (currently 2,775 keys); `check:i18n-usage` verifies every static `t()` key
  exists. Use `useT("ns")` / `useLocale()` from `@/shared/config`.
- **Two write layers:**
  - **Overrides** (`messages/_overrides/`, git-ignored) — runtime overrides applied
    at read time; the default prod-safe path.
  - **Source-write** (`api/i18n/source-write`, dev-gated) — rewrites the real
    git-tracked `messages/<locale>/<ns>.json` (4-space indent, atomic).
- **Parity-safe editing (enforced server-side):** a single-locale write may only
  *edit* a key that exists in **every** other locale. Creating a **new** key
  requires **both locales** in one atomic write
  (`setSourceKeyAllLocales`, with rollback) — surfaced in the UI by the **Add key**
  form on `/admin/translations`. Import classifies entries and skips/reports
  sibling-absent keys rather than breaking the parity gate.

---

## 5. Security model

- **Auth** — NextAuth 5 (beta) → ABP OAuth2 (password + refresh-token grant), JWT
  session. The slim JWT omits `grantedPermissions` to stay under HTTP-431; admin
  routes re-fetch `grantedPolicies` on demand.
- **`middleware.ts`** — O(1) cookie-existence gate (deliberately does **not** call
  `auth()` per request); locale cookie; per-request CSP **nonce** (prod) with a
  `connect-src` derived from `NEXT_PUBLIC_API_URL`; HSTS / nosniff / frame-deny /
  referrer / permissions-policy headers; URL-pollution sanitization.
- **Rate limiting** — per-IP, per-route (login + codegen routes). Client IP is read
  **secure-by-default**: the *rightmost* `X-Forwarded-For` entry minus
  `TRUSTED_PROXY_HOPS` (the IP the edge actually observed), not the spoofable
  leftmost. `TRUSTED_PROXY_HEADERS=1` opts into leftmost; `=0` collapses to a
  single global bucket.
- **Per-route authorization** — every mutating route gates via
  `requirePermission` / `requireAnyPermission` (`api/_lib/require-permission.ts`).
  Runtime **data reads** require the runtime reader grant (manager OR data-writer),
  not just any signed-in session.
- **File-writing routes** — confined by `safe-path` (allowed-roots + symlink
  resolution) and Zod identifier validation; the git bridge uses `execFile` argv
  (no shell) with a branch regex; codegen/restore are `NODE_ENV !== production`
  gated.
- **SSRF** — the swagger proxy matches the full **origin** (scheme+host+port) and
  refuses redirects (`redirect: "manual"`) so an allowed host can't bounce the
  server to an internal IP.
- **Env validation** (`src/shared/config/env.ts`) — soft warning at load; **strict
  at server start**: production refuses to boot without a valid API URL **and** a
  ≥32-char `AUTH_SECRET`/`NEXTAUTH_SECRET`.
- **Secrets** — `.env` is git-ignored; `check:leaked-secrets` scans the client
  bundle; `check:codegen-flag` fails if any tracked env arms the codegen flag.

---

## 6. Data, realtime & performance

- **Data** — TanStack Query 5 (`staleTime` 30 s, `keepPreviousData`); a single
  Axios instance with auth + refresh + retry interceptors; `BaseCRUDService` as the
  generic ABP client. `useAppConfig` caches granted policies in module scope (5-min
  TTL) with inflight dedup.
- **Realtime** — one lazy `@microsoft/signalr` singleton with debounced token-refresh
  reconnect, mounted once at the provider root (not per page).
- **Performance** — production shared bundle ≈244 KB gzip (cap 350); each entity
  route adds ≈2.7 KB. Heavy libs (recharts / exceljs / maps / framer-motion /
  signalr / cmdk) are **dynamically imported**, never in the shell. Lists are
  stale-while-revalidate. **Dev navigation** uses **Turbopack** (the custom dev
  server passes `turbopack: isDev`), avoiding Webpack's per-route on-demand compile
  stall; production still builds with `next build --webpack`.

---

## 7. Quality gate & CI

`npm run quality` (each must pass; lint is `--max-warnings 0`):

```
type-check → lint → validate (architecture)
  → check:next-auth-pin → check:leaked-secrets → check:codegen-flag
  → check:i18n-parity   → check:i18n-usage     → check:rsc-boundaries
  → check:swagger-drift → check:color-fn
```

- **swagger-drift** — fails if a service path is absent from the committed spec
  snapshot (`scripts/swagger-paths.json`).
- **color-fn** — fails on `hsl()/rgb()` wrapping an OKLCH token var.
- **check:dead-code** (knip) — separate ratchet (zero-cap on unused
  files/exports/types/duplicates); currently **green**.
- `build` additionally runs `check:bundle-budget`. Husky + lint-staged run on
  commit; Conventional Commits enforced.

Testing: Vitest + Testing Library + `vitest-axe` + MSW (144 test files, 1,500+
cases); Playwright RTL screenshot regression (`test:e2e:rtl`).

---

## 8. Dev / build / deploy

- **Dev** — `npm run dev` (custom `tsx server.ts`, Turbopack) on `:3000`;
  `npm run dev:next` is the plain `next dev --turbopack` alternative.
- **Build** — `init-entities → quality → next build --webpack → leaked-secret
  scan`, `output: standalone`.
- **Deploy** — `node .next/standalone/server.js`; `server.ts` handles
  `IISNODE_VERSION`/pipe ports for IIS+iisnode; set `API_URL` to the internal
  service name under Docker/IIS to avoid hairpin-NAT during SSR. `/api/health`
  reports backend connectivity. Startup safeguards refuse to boot with the codegen
  flag armed in prod (absent the override token).

---

## 9. Verified state & known constraints

**Working & verified:** config-driven CRUD (search/sort/filter end-to-end),
the builder + materialize pipeline (dev), in-UI config editing (entity-overrides),
parity-safe translation editing, the security model above, en/ar parity.

**Dev-only by design:** all *source-writing* builder surfaces (materialize,
entity-builder generate, widget-builder source emit, git-bridge, i18n source-write).
Prod config editing uses the no-codegen overrides layer.

**Backend-blocked (not frontend work):**
- Granular column/field permission keys (e.g. `Api.Payment.Amount.View`) — the
  gating mechanism is shipped; sensitive columns stay un-tagged until the backend
  defines + grants the keys (tagging on unconfirmed keys would hide data from all
  non-admins).
- WalletTopUp create/edit — needs a wallet-picker endpoint; shipped read-only.

**Deferred / spike-needed:** CSP `strict-dynamic` (needs a prod build to verify
Next chunks + the Maps loader still load); `/orders/schedule` is currently a
duplicate of `/orders` (wire a distinguishing filter or remove).

---

## 10. Other documentation

- **[README.md](../README.md)** — overview, getting started, env, scripts.
- **[ARCHITECTURE.md](../ARCHITECTURE.md)** — layer matrix & import rules.
- **[CONTRIBUTING.md](../CONTRIBUTING.md)** — standards & PR workflow.
- **[docs/DEVELOPMENT.md](DEVELOPMENT.md)** · **[docs/API-REFERENCE.md](API-REFERENCE.md)** · **[docs/ADMIN-TOOLS.md](ADMIN-TOOLS.md)**.
- **[docs/page-builder/](page-builder/)** — page-builder user guide, architecture, schema, extending.
- **[docs/runbooks/](runbooks/)** — deploy, incident response, security headers, next-auth rollback, git-bridge, production hardening.
- **[docs/static-entity-convertibility.md](static-entity-convertibility.md)** — convert rules.

---
*Last verified against the codebase after the security/correctness/perf/i18n/builder
pass. Keep this file in sync with the code — it is the truth.*
