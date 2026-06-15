# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

Newer releases are at the top. Each release lists **breaking changes
first** with an explicit **Migration** note, then the rest grouped
by Added / Changed / Removed / Performance / Security.

---

## [Unreleased] — Stabilization sprint (2026-05)

The post-1.0 stabilization sprint hardens the runtime-builder pipeline,
tightens CI gates, and lands several breaking changes that need
explicit upgrade steps. **Read the BREAKING CHANGES section before
deploying this version.**

### 💥 Breaking changes

#### A1 — Runtime entity store moved to the server

**What changed.** The runtime-builder used to keep entities and
records in each admin's `localStorage`. It now persists to the server
under `messages/_overrides/runtime/{config.json, data/<entityId>.json}`,
so every admin sees the same data and the data survives a browser
clear. Cross-tab and cross-admin sync runs over SignalR (see C4).

**Why.** Per-browser state was a footgun: an admin could spend an
hour shaping an entity, switch to a different machine, and lose the
work. It also made onboarding harder ("why don't I see your test
records?").

**Migration.** Admins with existing `localStorage`-backed entities
need to push them up once. The runtime-builder's **System** panel
(`/builder` → tab "System") shows a "Migrate from localStorage" card
when `localStorage` still has runtime data — clicking it calls
`migrateLocalToServer()` (see
[`src/features/runtime-builder/store/config-actions.ts`](src/features/runtime-builder/store/config-actions.ts))
and clears `localStorage` on success. **Skipping this step loses the
data**: the new build reads only the server config.

To force the local-storage backend back (offline demo, dev only):
set `NEXT_PUBLIC_RUNTIME_BACKEND=local`. Production must be `server`.

#### A3 — Entity-builder wizard removed; URLs changed

**What changed.** The 7-step wizard at `/admin/entity-builder/new`
and `/admin/entity-builder/edit/[entityName]` is gone. Entity
authoring lives in the runtime builder at `/builder`, with
"Materialize to source files" replacing the wizard's "Generate"
step (see [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) §1-§2).

**Why.** Two UIs that produced the same `src/` files meant double
the bug surface and double the test debt. The runtime builder is
the only authoring surface now; the wizard's templates live on as
the materialize codegen path so the on-disk output is byte-identical.

**Migration.**
- Bookmarks pointing at `/admin/entity-builder/new` → update to
  `/builder`.
- Bookmarks pointing at `/admin/entity-builder/edit/<name>` → there
  is no edit-by-name URL anymore (entities-as-source aren't edited
  through the UI). Edit the `.config.ts` directly.
- The retired `/admin/entity-builder` page still exists as a
  **manage** view — it lists leftover JSON drafts from the old
  wizard so admins can clean them up, and surfaces the **Backups**
  panel for materialize rollbacks.

#### B6 — Strict CSP with per-request nonce; theme inline-script changed

**What changed.** Production responses now ship a strict
`Content-Security-Policy: script-src 'nonce-…'` header. The
per-request nonce is generated in [`middleware.ts`](middleware.ts),
forwarded to the layout via the `x-nonce` request header, and inlined
into both the CSP value and any inline `<script>` the layout emits
(theme initialization, third-party loaders).

**Why.** `'unsafe-inline'` is a known XSS amplifier. Strict-nonce
CSP is the industry-standard defense; the inline theme-init script
is the only inline script we still emit, and it now carries the
nonce.

**Migration.**
- **Inline scripts must read `headers().get("x-nonce")` and pass it
  to `<script nonce={…}>`.** The pattern is established in
  [`src/app/layout.tsx`](src/app/layout.tsx); replicate it for any
  new inline script. A nonce-less `<script>` will be blocked by the
  browser in production.
- **Third-party SDKs that inject inline `<script>` may break.** In
  particular, custom GTM / analytics tags that the layout doesn't
  control will be CSP-blocked. Move them to the `next/script`
  `strategy="afterInteractive"` API which auto-applies the nonce, or
  add the source domain to `script-src` if the script is hosted.
- **Dev mode keeps `'unsafe-inline'`** for HMR compatibility — the
  difference is only visible after `next build && next start` or in
  a deployed image.
- Verify per `docs/runbooks/security-headers.md`:
  ```bash
  curl -I https://app.example.com | grep -i content-security-policy
  ```

#### D2 — Permission keys must come from `PERMISSIONS` const map

**What changed.** Fully-qualified permission key string literals
(`"Api.Theme.Manage"`, `"Api.Order.Create"`, etc.) are no longer
allowed outside [`src/shared/auth/permission-keys.ts`](src/shared/auth/permission-keys.ts).
A new ESLint rule
[`custom/no-string-permission-key`](eslint-plugin-custom/rules/no-string-permission-key.js)
fails any new occurrence; consumers import `PERMISSIONS.X_Y` instead.

**Why.** Permission keys were scattered across guards, configs,
route handlers, and the navigation file as raw strings. A typo
silently denied access (no compile-time signal). The central map
gives renames a single touch-point and surfaces typos as TypeScript
errors at every call site.

**Migration.** A grep should find every occurrence:
```bash
git grep -nE '"Api\.[A-Z][A-Za-z]*\.[A-Z]'
```
Replace each with the matching `PERMISSIONS.X_Y` constant. If the
key isn't in the map yet, add it — the map is the source of truth,
not the literals. **Two-segment entity prefixes** (`"Api.Brand"`,
`"Api.City"`) stay on each entity's `.config.ts` `permissionKey:`
field; the rule's regex requires the second `.` so prefixes are
never flagged.

#### C4 — Widget refresh `interval` mode deprecated; backend SignalR contract added

**What changed.** Polling-based widget refresh (`schema.refresh.mode === "interval"`)
is deprecated. The Zod schema literal is preserved for back-compat
with saved widget configs, but at runtime the value is **coerced to
`manual`** with a `logger.warn`. Use `socket` mode with a `topic`
for live updates.

The version watchers in `TranslationVersionWatcher.tsx`,
`ThemeVersionWatcher.tsx`, and `runtime-builder/store/server-provider.ts`
also moved from 30 s/8 s polling to SignalR push. Each requires a
backend event contract:
- `ReceiveTranslationVersionChanged` `{ version: number }` on i18n publish
- `ReceiveThemeVersionChanged` `{ version: number }` on theme publish
- `ReceiveRuntimeConfigChanged` `{ version: number }` on any admin's runtime mutation

**Why.** Polling at scale becomes expensive (every dashboard tab
hammering `/api/*/version` every 30 s) and never matches push
latency. SignalR is already wired for ticket / order / driver
tracking — the rate-limit and version watchers are the same shape.

**Migration.**
- **Existing widgets with `mode: "interval"`**: re-save them as
  `mode: "socket"` with the appropriate topic, or accept that they
  refresh only on `bump()`. The deprecation warning will fire in
  the browser console until you do.
- **Backend**: ensure the three `Receive*Changed` events fire on
  the matching mutations. Without them, dashboards won't see fresh
  translations / themes / runtime config until the user navigates.
  See the file headers in
  [`src/ui/application/TranslationVersionWatcher.tsx`](src/ui/application/TranslationVersionWatcher.tsx)
  and `ThemeVersionWatcher.tsx` for the exact contract specs.

#### E1 — `/api/health` response body shape narrowed

**What changed.** The readiness probe at `/api/health` returns a
strict `{ status, checks: { backend, storage } }` shape — no more
`failures`, `checks: [...]`, `latencyMs`, `httpStatus`, `version`,
`environment`, `timestamp`. The probe also now checks
`messages/_overrides/` writability in addition to backend liveness.

**Why.** The previous body leaked diagnostic detail (env values,
error messages) on the same endpoint a load balancer hits. The new
shape is the minimum the LB needs and nothing else.

**Migration.** Update any consumer that parses the old fields:
- Load-balancer health checks reading `body.status` keep working.
- Internal monitoring that read `body.checks[i].latencyMs` or
  `body.environment` must move to a different metric source —
  Sentry transactions cover the same ground (see
  [`docs/runbooks/incident-response.md`](docs/runbooks/incident-response.md) §4).

#### E3 — `RateLimiter.check()` is now async

**What changed.** The `RateLimiter` interface in
[`src/infra/ratelimit/types.ts`](src/infra/ratelimit/types.ts)
returns `Promise<RateLimitResult>` instead of `RateLimitResult`.
Direct callers must `await`. The middleware was updated; if you
imported `rateLimiter.check(...)` anywhere else, it'll now return a
Promise.

**Why.** The new Redis-backed adapter
([`src/infra/ratelimit/redis-limiter.ts`](src/infra/ratelimit/redis-limiter.ts))
needs to round-trip the network. Making the interface async lets the
in-memory adapter (sync internally) and the Redis adapter share the
same `RateLimiter` shape — middleware code doesn't change when
`UPSTASH_REDIS_REST_URL` is set.

**Migration.** `await rateLimiter.check(key, max, windowMs)` instead
of `rateLimiter.check(key, max, windowMs)`. The wrapping function
must become `async`.

### ✨ Added

- **Page Builder** (`src/features/admin-tools/page-builder/`) — a
  configuration-driven page editor that lets admins compose any
  dashboard page from registered blocks without writing code.
  - Schema layer ([`schema/`](src/features/admin-tools/page-builder/schema/))
    — Zod contracts for pages, blocks, fields, actions; built on a
    SSOT field-type and column-type union shared with the entity
    registry, so adding a field type lands in one place.
  - Block registry ([`registry/`](src/features/admin-tools/page-builder/registry/))
    — 16 built-in block types (heading, text, divider, spacer,
    card, tabs, accordion, grid, table, form, detail, kpi, chart,
    alert, button, map). Every block declares which existing
    component it wraps; registration fails if the trace is missing.
  - Renderer layer
    ([`renderer/`](src/features/admin-tools/page-builder/renderer/))
    — `<PageRenderer>` is the only component that turns a schema into
    JSX. Same component runs in canvas live-preview, the dynamic
    `/pages/[pageId]` route, and the materialized static routes.
  - Canvas editor at
    [`/admin/page-builder`](src/app/(dashboard)/admin/page-builder)
    — palette + block list + properties panel (JSON editor with Zod
    validation) + live preview pane (locale + theme + viewport
    toggles). HTML5 drag-and-drop; no new dnd library.
  - **Swagger integration** — server-side OpenAPI proxy with a 5-min
    cache + a wizard that turns any ABP-style cluster (orders, users,
    invoices, …) into a draft Page Builder page in one click. Field
    types are auto-mapped from the request body with format-aware +
    name-heuristic rules.
  - **CRUD persistence** at
    `messages/_overrides/pages/<pageId>.json`, audit log, SignalR
    fan-out via `socket.invoke("PageUpdated", pageId)`, and a
    `<PageVersionWatcher>` that refreshes open viewers on every save.
  - **Materialize pipeline** — promotes a draft to committed source
    files under `src/app/(dashboard)/pages/<pageId>/`. Reuses the
    entity-builder's 7-gate pipeline byte-for-byte (env kill-switch,
    CI scan, permission, rate-limit, path-safety, sandbox typecheck,
    backup + audit).
  - **Permission system integration** — page / block / button level
    gates all flow through the existing `PermissionContext`. No
    parallel permission system.
  - **Translation flow** — every save merges localized strings into
    `messages/{en,ar}/pages_dynamic.json` (new namespace), so admins
    can edit copy via `/admin/translations` without redeploying.
  - **Sidebar registration** — `<DynamicPagesSection>` lives next to
    `<RuntimeSidebarSection>`, filters by `navigation.enabled` + the
    viewer's permission, groups + orders entries.
  - Documentation:
    [`docs/page-builder/user-guide.md`](docs/page-builder/user-guide.md)
    (bilingual EN+AR),
    [`docs/page-builder/extending.md`](docs/page-builder/extending.md)
    (developer recipe for new blocks),
    [`docs/page-builder/architecture.md`](docs/page-builder/architecture.md),
    [`docs/page-builder/schema.md`](docs/page-builder/schema.md).
  - New rate-limit rules: `page-builder-crud` (30/min/IP) and
    `page-builder-materialize` (5/min/IP).
  - New permission `Api.Admin.PageBuilder` in the `PERMISSIONS` const.
  - New bundle-budget entry: `/(dashboard)/admin/page-builder/page`
    capped at 320 KB gzip (raised from the original 280 KB cap in
    Phase 2B to absorb `@dnd-kit`; current first-load 245.1 KB).
  - **Phase 2A — Canvas tree authoring** (folds back into the same
    feature; the original Phase 1 entry above describes the runtime
    + materialize layers, this entry covers the authoring UI):
    - **Path-based state machine** ([`canvas/hooks/useCanvasState.ts`](src/features/admin-tools/page-builder/canvas/hooks/useCanvasState.ts))
      operates on `BlockPath` segments (root / blocks / tab / item /
      action-blocks). Selection is id-based externally and path-
      derived internally via `findBlockById`. Mutations: `insertBlock`,
      `removeBlockAt`, `updateBlockAt`, `moveBlock`, `duplicateBlockAt`
      plus id-based wrappers. History (undo/redo) capped at 20
      snapshots; selection lives outside history.
    - **Tree utilities** ([`canvas/tree/`](src/features/admin-tools/page-builder/canvas/tree/))
      — pure helpers: `walkBlocks`, `findBlockById`, `getBlockAt`,
      `setBlockAt`, `insertBlockAt`, `removeBlockAt`, `moveBlock`,
      `duplicateBlockAt`, `getContainerSlots`, `canDropInto`,
      `isDescendantOf`, `getDropTargets`. All mutating ops return a
      fresh schema via `structuredClone`.
    - **Recursive BlockTree** ([`canvas/components/BlockTree.tsx`](src/features/admin-tools/page-builder/canvas/components/BlockTree.tsx))
      replaces the flat list. Each item renders a drag handle,
      chevron, label, Move ↑↓ buttons, and an actions menu
      (Duplicate / Move-to ▶ / Delete). Per-container "+ Add child"
      affordance. Slot labels for tabs / accordion only (multi-slot
      containers); card / grid hide the anonymous body label.
    - **Layers / Palette tabs in the left rail**
      ([`canvas/components/LayersPalettePanel.tsx`](src/features/admin-tools/page-builder/canvas/components/LayersPalettePanel.tsx))
      — the left rail now hosts both navigation (Layers) and
      authoring (Palette) under a Radix Tabs toggle. Smart
      heuristics: empty schema defaults to Palette; non-empty
      defaults to Layers. Auto-switches to Layers after a palette-
      driven add. Count badge reflects total blocks (root + nested,
      via `walkBlocks`). Left rail widened from `w-72` to `w-80`
      (288 → 320 px) to accommodate the tree row's controls.
  - **Phase 2B — Drag-and-drop reordering**:
    - **@dnd-kit integration** — pinned to `@dnd-kit/core@^6.3.1`,
      `@dnd-kit/sortable@^10.0.0`, `@dnd-kit/utilities@^3.2.2`.
      Bundle budget for `/(dashboard)/admin/page-builder/page`
      raised from 280 → 320 KB to absorb the cost (current first-
      load: 245.1 KB, 74.9 KB headroom — most of dnd-kit landed in a
      non-first-load chunk).
    - **Sortable items + droppable slots** — `useSortable` on every
      `BlockTreeItem` with the full `BlockPath` as data payload
      ([`canvas/components/BlockTreeItem.tsx`](src/features/admin-tools/page-builder/canvas/components/BlockTreeItem.tsx)).
      `useDroppable` on every slot for empty-container drops and
      gap-area container highlight ([`canvas/components/BlockTreeSlot.tsx`](src/features/admin-tools/page-builder/canvas/components/BlockTreeSlot.tsx)).
      Cross-container moves run through `state.moveBlock` so the
      existing cycle / form / slot-kind validation applies uniformly.
    - **Visual feedback** — `<DragOverlay>` shows a stripped-card
      ghost (icon + label + id, `shadow-2xl` + primary-tinted border)
      following the cursor. Drop-line indicator on the over-item
      (2px primary, 150 ms transition). Container highlight on the
      over-slot (`bg-primary/5 ring-1 ring-primary/30`). Empty slots
      pulse with `border-primary` + `animate-pulse`. Drop animation
      150 ms cubic-bezier with a touch of overshoot.
    - **Sensor + scope** — `MouseSensor` only (Desktop-only by spec,
      no touch), 5 px activation distance to avoid accidental drag
      on click. Listeners scoped to a dedicated drag handle
      ([`canvas/components/DragHandle.tsx`](src/features/admin-tools/page-builder/canvas/components/DragHandle.tsx))
      so select / Move ↑↓ / actions menu keep their own semantics.
      `autoScroll` enabled.
    - **Performance** — `React.memo` with a custom comparator on
      `BlockTreeItem`; schema mutations no longer ripple through
      every unrelated item. `expandedIds` self-prunes when the
      schema changes (after `replaceSchema` or container removal),
      guarding against "ghost expand" state.
    - **Accessibility** — `dnd-kit` Announcer wired with custom
      `accessibility.announcements` for screen readers. `DragHandle`
      `aria-label` is contextual: `Drag <displayName> (item N of M)`.
      Keyboard sensor deferred to Phase 2C; Move ↑↓ buttons and
      Move-to submenu cover the same affordances today.
  - **Test config polish** — `max-lines-per-function` raised to 200
    for test files (matches the existing maps-subsystem ceiling),
    keeping the source-code 100-line cap unchanged. Avoids artificial
    `describe` splits that don't aid readability.
  - **Docs update** — new [`docs/page-builder/canvas.md`](docs/page-builder/canvas.md)
    walks engineers through the authoring layer (~30-minute
    onboarding); [`docs/page-builder/user-guide.md`](docs/page-builder/user-guide.md)
    gains a bilingual "Reordering blocks" section.

- **Server-backed runtime store** (A1) for runtime entities, with
  optimistic mutations, version-bucketed cache, and SignalR push
  for cross-admin sync.
- **`bundle-budgets.json`** (C1) — per-route first-load JS budgets
  enforced by [`scripts/check-bundle-budget.mjs`](scripts/check-bundle-budget.mjs)
  in CI. Default route budget is 150 KB gzip, with explicit caps for
  the dashboard root, order detail, and admin entity-builder.
- **`custom/no-static-heavy-import` ESLint rule** (C2) — blocks
  top-level value imports of `recharts`, `framer-motion`, `xlsx`,
  `jspdf`, `react-easy-crop`, `cmdk`, and `@googlemaps/js-api-loader`
  outside a curated allowlist of dynamic-import wrappers.
- **`custom/no-string-permission-key` ESLint rule** (D2) — see
  the BREAKING note above.
- **Module-level cache** (C5) for the i18n override store, theme
  store, and i18n namespace JSON imports. Backed by `fs.watch` for
  out-of-process invalidation; writers refresh the cache atomically
  by building fresh next-snapshots so concurrent readers never see
  half-written state.
- **Redis-backed rate limiter** (E3) at
  [`src/infra/ratelimit/redis-limiter.ts`](src/infra/ratelimit/redis-limiter.ts).
  Activates when `UPSTASH_REDIS_REST_URL` (preferred, edge-safe) or
  `REDIS_URL` (Node-only) is set; falls back to the in-memory
  limiter otherwise.
- **Production Docker image** (E4) at [`Dockerfile`](Dockerfile) —
  three-stage build, runs as non-root (`nextjs:1001`), `node:22-alpine`,
  ships only the standalone tree.
- **Deploy CD pipeline** (E5) — staging deploy on push to main,
  manual-only production promotion via the `Deploy production`
  workflow, per-PR preview images at
  `ghcr.io/<owner>/<repo>:pr-<n>-<sha>`. Runbook:
  [`docs/runbooks/deploy-cd.md`](docs/runbooks/deploy-cd.md).
- **Web Vitals → Sentry forwarding** (E6) — LCP/CLS/INP/FCP/TTFB/FID
  attached as measurements on the active page-load transaction;
  visible in the Sentry "Web Vitals" view per route.
- **Incident response runbook** (E6) at
  [`docs/runbooks/incident-response.md`](docs/runbooks/incident-response.md)
  — one-page on-call playbook with three Sentry dashboard recipes,
  rollback procedure, feature-flag disable steps.
- **Bundle, deploy, and CD runbooks** at
  [`docs/runbooks/deploy-hygiene.md`](docs/runbooks/deploy-hygiene.md),
  [`docs/runbooks/deploy-cd.md`](docs/runbooks/deploy-cd.md), and
  expanded [`docs/runbooks/production-hardening.md`](docs/runbooks/production-hardening.md).
- **`API_ROUTES` source-of-truth** (D3) at
  [`src/shared/api/routes.ts`](src/shared/api/routes.ts) — every
  client-side `/api/...` literal now imports through this module.

### ⚡ Performance

- **~50 KB first-load reduction on the dashboard root** (C3) by
  flipping 13 thin-wrapper `page.tsx` files to server components.
  86% of dashboard pages are now server components (was 79%).
- **Per-request file reads eliminated** (C5) for the i18n + theme
  override stores. Warm-cache reads return in O(microseconds).
- **All backend polling removed** (C4) except for three display
  clocks (session-expiry banner, redirect countdown, tracking
  sidebar). Push channel via SignalR carries the rest.

### 🔒 Security

- **Strict CSP with per-request nonce** (B6) — see BREAKING above.
- **Codegen safety model documented** (D2 + ARCHITECTURE.md §8) —
  seven defense-in-depth gates between an admin click and a file
  write to disk. The startup guard in [`instrumentation.ts`](instrumentation.ts)
  refuses to boot in prod with `APP_ALLOW_RUNTIME_CODEGEN=true`
  unless paired with the explicit override token.

### 🗑️ Removed

- **Legacy entity-builder wizard** (A3) — see BREAKING above.
- **Two skipped i18n tests** (D5) — `setLocaleStorage` and
  `getLocaleFromStorage` `describe.skip` blocks deleted; the
  helpers had been superseded by cookie-based persistence.
- **Dead `genId as generateId` re-export** from `EntityBuilder.tsx`.
- **`basePath` parameter** from `createServerProvider()` and
  `migrateLocalToServer()` — no callers overrode it; the runtime
  base is now read from `API_ROUTES.runtime.*`.

### 📝 Documentation

- **DEVELOPMENT.md** restructured (F1) — three entity walkthroughs
  in fastest-to-source order: runtime builder → materialize → plop.
- **ARCHITECTURE.md** expanded (F2) with five new sections:
  runtime-vs-static entities, permission key naming, codegen safety
  model, bundle budget philosophy, and a "where does a new feature
  live" decision tree.

### 🛠️ Build / CI

- **Per-route bundle-budget enforcement** in CI (C1).
- **Coverage gate** in `vitest.config.ts` (D6) — measured floor
  ratchets up via `autoUpdate: false`. Spec target 70/60/70/70 lives
  in the comment as the goal; current floor is 30/24/27/32.
- **Standalone build artifact** (E4) now uploaded by CI as a
  self-contained directory (standalone server + `.next/static` +
  `public/`), 14-day retention.




### ♻️ Refactors

* Batch 1 detail pages - Unit, Role, Currency, Connection, ExtraCharge (-75% avg) ([07340b8](https://github.com/AhmedDhiaa/FrontEnd_Dashboard/commit/07340b8f86b4cb0e3bf1d2a1becf457791c1abb1))
* Batch 1 edit pages - Unit, Role, Currency, Connection, ExtraCharge (-70% avg) ([d2c1840](https://github.com/AhmedDhiaa/FrontEnd_Dashboard/commit/d2c1840d25fdbf7c466f2c7d246242df6ab12ae2))
* Batch 1 list pages - Unit, Role, Currency, Connection, ExtraCharge (-63% avg) ([957661f](https://github.com/AhmedDhiaa/FrontEnd_Dashboard/commit/957661f73255326735ff4cc5f14a685f1f1f6526))
* Batch 2 - Geographic entities (Countries, Cities, Areas) - 9 pages complete ([b105a0e](https://github.com/AhmedDhiaa/FrontEnd_Dashboard/commit/b105a0e3c994ac0049010c61060b31c898370f0b))
* Batch 3 - Inventory entities (Items, Warehouses, PriceLists) - 9 pages complete ([7a091e6](https://github.com/AhmedDhiaa/FrontEnd_Dashboard/commit/7a091e613be66080f63e7aacab678863fbd6db4f))
* Batch 4 complete - Users, Employees, BusinessPartners (9 pages) ([ba83dea](https://github.com/AhmedDhiaa/FrontEnd_Dashboard/commit/ba83deada0bc53fa3e51b229a6f25eb18d5769d6))
* Batch 5 complete - Vehicles, Orders, SalesInvoices (9 pages) ([bcb71ae](https://github.com/AhmedDhiaa/FrontEnd_Dashboard/commit/bcb71ae3103349b61d4af99be4cb518a37694a9b))
* Batch 6 complete - Tickets, Documents (6 pages) ([1776d48](https://github.com/AhmedDhiaa/FrontEnd_Dashboard/commit/1776d4811948ef27196efeb97f685ea8529a13b4))
* Brand detail page using BaseDetailRenderer (139 -> 35 lines, -75%) ([0938e9e](https://github.com/AhmedDhiaa/FrontEnd_Dashboard/commit/0938e9e7e53b0ca67a36a563f87f3d03486aa13b))
* Brand edit page using SchemaFormRenderer (89 -> 52 lines, -42%) ([10e62e3](https://github.com/AhmedDhiaa/FrontEnd_Dashboard/commit/10e62e3cf20fff89102afa9699ee5c135535e7b9))
* Category and JobTitle detail pages (-70% and -77%) ([a57f3a3](https://github.com/AhmedDhiaa/FrontEnd_Dashboard/commit/a57f3a371e27fb10ce53b721090241128e164fbb))
* Category and JobTitle list pages using column factory ([4b41792](https://github.com/AhmedDhiaa/FrontEnd_Dashboard/commit/4b41792cbf96621cbe050dab10bb12f20f77965a))


### 🐛 Bug Fixes

* Add missing schema exports and fix type errors ([790524f](https://github.com/AhmedDhiaa/FrontEnd_Dashboard/commit/790524fe471213321aff1052431b557c6b8f32a1))
* Connection edit page schema alignment ([ae60763](https://github.com/AhmedDhiaa/FrontEnd_Dashboard/commit/ae60763546fa145ee8cbc9b93e0affdbc1a3ba3d))
* Connection type conversion with proper defaults ([539efa3](https://github.com/AhmedDhiaa/FrontEnd_Dashboard/commit/539efa394a3664ddaa17bbf4985bd1cb00cc66d7))
* LoadingComponent type error in performance-utils ([a12df40](https://github.com/AhmedDhiaa/FrontEnd_Dashboard/commit/a12df406e80645d8d31268bc207d4b73621b9d54))
* LoadingComponent wrapper and remove deleted page references ([9ab0ee3](https://github.com/AhmedDhiaa/FrontEnd_Dashboard/commit/9ab0ee3724d641f8c4ad5799a252b958aeecf5a0))
* Remove concurrencyStamp from Role entityToFormData ([5f427ed](https://github.com/AhmedDhiaa/FrontEnd_Dashboard/commit/5f427edc5b8d45b0f64b50f88f537c6cf204a749))
* Remove countryId from cities defaultValues ([4bf2d87](https://github.com/AhmedDhiaa/FrontEnd_Dashboard/commit/4bf2d874818e45f027a3994ec8e7716a951a018d))
* Remove LazyUnifiedMap to fix build ([9fef4c4](https://github.com/AhmedDhiaa/FrontEnd_Dashboard/commit/9fef4c471ebf5a6e7e67dcb6435e31022f614cb8))
* Role displayName default value ([07cf608](https://github.com/AhmedDhiaa/FrontEnd_Dashboard/commit/07cf60821a74110b1a36ecec2d5a4effdf4f845f))
* Role schema to match actual interface (name, displayName, description) ([c4dccc5](https://github.com/AhmedDhiaa/FrontEnd_Dashboard/commit/c4dccc5e12984c36478eff1f432a411a0c539496))
* UnifiedMap import to use default export ([defe460](https://github.com/AhmedDhiaa/FrontEnd_Dashboard/commit/defe460d8cede10f91ff76f12b318a6be014b94e))
* Use createElement for LoadingComponent ([e686179](https://github.com/AhmedDhiaa/FrontEnd_Dashboard/commit/e68617972d949dd773d3873e89833ef98aea0b92))


### 📝 Documentation

* Add initial project documentation including README, architecture, and contributing guidelines. ([93aa397](https://github.com/AhmedDhiaa/FrontEnd_Dashboard/commit/93aa397fc491f45254d4e9f23e6b340e59660438))


### ✨ New Features

* Add Arabic translations for navigation and dashboard. ([c6dbd42](https://github.com/AhmedDhiaa/FrontEnd_Dashboard/commit/c6dbd42e79a0b90846f415594e49571d73ce113e))
* add Sheet component for responsive side sheets ([5390e09](https://github.com/AhmedDhiaa/FrontEnd_Dashboard/commit/5390e096fd4c10f9d98250248f9e75087a53bd6f))
* implement BoundaryFeature for polygon management with marker pooling and simplification support ([3074059](https://github.com/AhmedDhiaa/FrontEnd_Dashboard/commit/30740599bd6a66af439084c485431399b01ca7f6))
* Implement core dashboard infrastructure including config-driven CRUD, extensive UI primitives, theming, and i18n. ([a864888](https://github.com/AhmedDhiaa/FrontEnd_Dashboard/commit/a864888d5a8e1545067bb1927e52c73d095b8e8e))
* implement ticket management domain, real-time chat features, and dashboard integration with socket support. ([aa12923](https://github.com/AhmedDhiaa/FrontEnd_Dashboard/commit/aa1292330c4621727135ec75f11a40fe79b1166d))
* Introduce the new dashboard application with comprehensive features and infrastructure. ([e99f601](https://github.com/AhmedDhiaa/FrontEnd_Dashboard/commit/e99f601f225433f04b940cd5138c8c5bd2f52adf))


### 📦 Miscellaneous

* refine release push script ([3e48dc0](https://github.com/AhmedDhiaa/FrontEnd_Dashboard/commit/3e48dc0c87ccaf704ce1b72d77d09e586658aff0))
* setup automated versioning and releases ([e85ca3f](https://github.com/AhmedDhiaa/FrontEnd_Dashboard/commit/e85ca3fcc87a0d993cd6942df4c0155d7baf3b4d))
