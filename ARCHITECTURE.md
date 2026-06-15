# Architecture Documentation

This document defines the architectural boundaries and technical patterns of the project.

## 1. Core Principles

- **Configuration over Code**: UI is a projection of entity metadata.
- **Reactive Flow**: Features communicate via observers, not polling.
- **Strict Layering**: Boundaries are enforced at build-time to prevent spaghetti dependencies.

## 2. Layered Architecture (The "Clean" Sandwich)

| Layer | Responsibility | Allowed Imports |
| :--- | :--- | :--- |
| **App** | Routing, Server Actions | `features`, `core`, `ui`, `infra` |
| **Features** | Business Use Cases (Maps, Tracking) | `core`, `ui`, `infra`, `shared` |
| **Domains** | Entity Metadata & Configs | `core`, `shared` |
| **Core** | Registry, Base Services | `infra`, `shared` |
| **Infra** | API Client, Auth, Storage | `shared` |
| **UI** | Primitive Components, Renderers | `shared` |
| **Shared** | Utils, Common Types | None (Self-contained) |

> [!IMPORTANT]
> Infractions are caught by `npm run validate` and prevented in CI by the Architectural Validator.

## 3. The Entity System

Our system uses a **Build-Time Registration** pattern.

1. **Definition**: Developers create a `.config.ts` in `src/domains`.
2. **Generation**: `generate-entity-init.ts` scans the domain layer and syncs `src/core/entities/configs/init.ts`.
3. **Registration**: The `EntityRegistry` consumes these configs to power the generic renderers in `src/ui/crud`.

## 4. Map Engine v3 (Reactive)

The Map Engine implements a **Plugin Architecture** using an observer-based lifecycle.

- **BaseFeature**: Provides a `.subscribe()` method that notifies listeners of state/data changes.
- **UnifiedMap**: Orchestrates features without knowing their internal logic.
- **Performance**: High-frequency updates (like drawing or boundary checks) use a set of `stateChangeListeners` to update the UI instantly, eliminating legacy `setInterval` polling.

## 5. Enforcement & Quality

- **Architectural Validator**: A custom script (`scripts/validate-architecture.ts`) that analyzes the import graph.
- **ESLint Custom Plugin**: `eslint-plugin-custom/domain-boundary-enforcement.js` provides real-time linting in the IDE.
- **Quality Suite**: `npm run quality` executes type-checks, linting, and architectural validation in sequence.

## 6. Runtime vs static entities (dual-track design)

The system supports **two equivalent ways** to add a CRUD surface to the
dashboard. Both produce the same end-user experience; they differ in
where the schema lives and who can change it.

| | **Static entity** | **Runtime entity** |
| :--- | :--- | :--- |
| **Schema lives in** | `src/domains/<area>/<name>/<name>.config.ts` | `messages/_overrides/runtime/config.json` |
| **Created by** | `npm run plop -- entity` (developer, terminal) | `/builder` UI (admin, no PR) |
| **Reviewed in** | A PR — code-owners look at the schema, types, validation | Nothing — admin pushes Save and it's live |
| **Lives until** | The next deploy that removes the file | The admin deletes it from `/builder` |
| **Visible at** | `/<plural>` (e.g. `/customers`) | `/runtime/<entityId>` |
| **Type-checked** | Yes (it's `.ts`) | No (the runtime renderer reads JSON) |
| **Permission key** | Whatever the developer set in `permissionKey:` | Auto-derived `Api.<PascalCase(id)>` unless overridden |

### When to use which

- **Use static** when the schema is part of the product contract: the
  field set is reviewed, the validation is tested, and "removing the
  entity" should require a PR. Anything customer-facing in
  production goes here.
- **Use runtime** when an admin needs a CRUD surface today and the
  schema is small or experimental. Lookup tables, ad-hoc admin
  scratchpads, internal-only categories — the kind of data where a
  config edit shouldn't require a deploy.
- **Promote runtime → static** (materialize) when the runtime
  entity has stabilized and you want it in the build. Materializing
  writes the same files `plop` would have written, plus a backup
  snapshot for one-click rollback. See §8 for the safety model and
  [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) §2 for the walkthrough.
- **Don't use runtime** for surfaces where a typo in the schema is a
  P1 — there's no compile-time safety on a runtime entity.

### Architectural consequence

The static-entity registry (`src/core/entities/configs/init.ts`) is
**generated** from the `.config.ts` files, not hand-written. The
runtime registry (`messages/_overrides/runtime/config.json`) is
mutated by API writes, not edited by developers. Both feed the same
generic renderers in `src/ui/crud` — that's the dual-track shape.

## 7. Permission key naming convention

Permission strings are flat ABP-style identifiers: `Api.<Module>` for
two-segment entity prefixes, `Api.<Module>.<Action>` for fully-
qualified action keys. They're declared in **one place**:
[`src/shared/auth/permission-keys.ts`](src/shared/auth/permission-keys.ts).

| Shape | Used for | Example | Where it's owned |
| :--- | :--- | :--- | :--- |
| `Api.<Module>` (2 segments) | Entity prefix — the system synthesizes `<prefix>.{Create,Update,Delete,View}` at check time | `Api.Brand` | Each entity's `permissionKey:` field in its `.config.ts` |
| `Api.<Module>.<Action>` (≥3 segments) | Fully-qualified action key — admin tool gates, dashboard visibility, report access | `Api.Theme.Manage` | The `PERMISSIONS` const map in `permission-keys.ts` |

### Why a central map

Permission strings used to be scattered across guards, route handlers,
configs, and the navigation file. A typo silently denied access — no
compile-time signal, just an empty page or 403. The
[`custom/no-string-permission-key`](eslint-plugin-custom/rules/no-string-permission-key.js)
ESLint rule blocks any new fully-qualified literal outside
`permission-keys.ts`; renames become a single-file change with a
TypeScript error at every call site that references the old name.

Two-segment entity prefixes live on the entity config (the natural
anchor) — the rule's regex requires a second `.` so prefixes are
never flagged.

## 8. Codegen safety model

The runtime-builder's "materialize" pipeline is a **remote file-write
primitive**: any admin who can reach `/api/runtime/materialize/*` or
`/api/admin/{entity,widget}-builder/generate` can cause source files
to be written into the repo. We treat that the same way we'd treat
`eval()` — it's powerful, it's deliberately gated, and the gates are
defense-in-depth so a single misconfiguration doesn't open the door.

The seven gates, in order from outermost to innermost:

1. **Production env kill-switch.** `APP_ALLOW_RUNTIME_CODEGEN` must
   be exactly `"true"` for the codegen endpoints to accept writes.
   The startup guard in [`instrumentation.ts`](instrumentation.ts)
   refuses to boot the server in production with this flag on, *unless*
   `APP_ALLOW_RUNTIME_CODEGEN_PROD_OVERRIDE=i-understand-the-risks`
   is also set — the two-key pattern that prevents an accidental
   one-line env edit from arming the system.
2. **CI-side env scan.** [`scripts/check-codegen-flag.mjs`](scripts/check-codegen-flag.mjs)
   blocks any tracked `.env*` file from setting BOTH the flag and the
   override token. Wired into `npm run quality` so PRs can't slip a
   prod-armed config through review.
3. **Permission gate.** Every codegen endpoint calls
   `requirePermission("Api.Admin.EntityBuilder")` (or
   `Api.Admin.WidgetBuilder`) before doing anything. Bypassing the
   gate requires bypassing NextAuth, which requires bypassing the
   network — the surface is small.
4. **Rate limit.** [`src/infra/ratelimit/config.ts`](src/infra/ratelimit/config.ts)
   caps codegen endpoints at 5/min/IP and runtime data writes at
   30/min/IP. A hijacked admin token can't sustain a rapid write
   burst. The Redis-backed adapter from
   [`src/infra/ratelimit/redis-limiter.ts`](src/infra/ratelimit/redis-limiter.ts)
   makes the cap global behind a load balancer.
5. **Path safety.** [`src/shared/utils/safe-path.ts`](src/shared/utils/safe-path.ts)
   normalizes every write target and refuses anything that escapes
   the safe-path allowlist (`src/`, `messages/`, the override
   directory). Catches `..` traversal, absolute paths, symlink
   redirects.
6. **Sandbox typecheck.** Before any file is written,
   [`src/features/admin-tools/entity-builder/server/typecheck.ts`](src/features/admin-tools/entity-builder/server/typecheck.ts)
   runs the planned files through `tsc` in an isolated `tsconfig`. A
   typecheck failure aborts the materialize without touching disk —
   you can't ship code that would fail CI through this path either.
7. **Backup + audit.** Every successful write is preceded by a
   snapshot in `.entity-builder-backups/<id>` and a JSONL line
   appended to `messages/_overrides/entity-builder/_audit.jsonl`
   (actor, timestamp, schema hash, file count, outcome). Materializes
   are reversible from the **Backups** panel at
   `/admin/entity-builder`; the audit log is the forensic trail when
   something goes wrong anyway.

The seven gates compose: bypassing one still leaves the other six in
place. Architects evaluating a new codegen-adjacent surface should
walk this list and ensure every gate fires for the new endpoint
before adding it to the allowlist.

## 9. Bundle budget philosophy

First-load JS is enforced as a **hard CI gate**, not a guideline. The
budget lives in [`bundle-budgets.json`](bundle-budgets.json):

```jsonc
{
  "shared": 350,           // KB gzipped, every page pays this
  "routes": {
    "/(dashboard)/page": 220,
    "/(dashboard)/orders/[id]/page": 180,
    "/(dashboard)/admin/entity-builder/page": 250,
    "default": 150         // every unlisted route
  }
}
```

Numbers are **gzipped KB on top of `shared`**. The script
[`scripts/check-bundle-budget.mjs`](scripts/check-bundle-budget.mjs)
runs after every `npm run build` (CI step), reads the manifest, and
fails the run with the exact route + size delta on any breach.

### How a regression looks

A PR that adds `import "exceljs"` to a list page bumps that route's
weight from ~30 KB to ~400 KB. CI fails:

```
Route /(dashboard)/items/page: route-only 412.6 KB exceeds 150 KB cap
  by 262.6 KB (first-load 657 KB, budget source: routes.default).
```

The reviewer can either: (a) reject the change; (b) raise the cap in
`bundle-budgets.json` with a one-line PR-description rationale (the
diff makes the bump visible); or (c) lazy-import `exceljs` so it doesn't
land in the route's first-load chunk. Option (c) is what the
[`custom/no-static-heavy-import`](eslint-plugin-custom/rules/no-static-heavy-import.js)
rule pushes you toward — it blocks top-level value imports of
`recharts`, `framer-motion`, `exceljs`, `jspdf`, `react-easy-crop`,
`cmdk`, and `@googlemaps/js-api-loader` outside an explicit
`allowFiles` list of dynamic-import wrappers.

### Why route-level budgets, not global

A global limit hides per-route bloat. The dashboard root, an order
detail page, and a list page have **very different JS budgets** —
the dashboard ships chart libs, order detail ships forms + a chat
runtime, list pages ship a CRUD table. Fixing one number forces
either tightness on small pages or laxity on large pages; neither
holds the line. Per-route caps with a `default` floor mean every
unlisted route inherits a tight ceiling and the explicit overrides
are visible in PR review.

## 10. Where a new feature should live

Use this as a decision tree when you don't know which layer to start in:

- Is it a **CRUD surface** for a domain entity? → `src/domains/<area>/<name>/`
  via `npm run plop -- entity` (or `/builder` if it shouldn't ship
  in source). See §6 for the runtime-vs-static call.
- Is it a **dashboard tile** (KPI / chart / table / alert / map)? →
  `/admin/widget-builder` for the definition, mounted on a canvas at
  `/dashboard/canvas`. The wizard's source files live in
  `src/features/admin-tools/widget-builder/`.
- Is it a **business use case** that crosses entities (auth flows,
  tracking, reporting pipelines)? → `src/features/<feature>/`. Owns
  its own UI, its own services; reads from `core` registries; never
  reaches into another `feature`.
- Is it a **shared registry** other features look up? → `src/core/`.
  Not a feature in itself — a registry that features read.
- Is it an **API client / auth adapter / storage primitive**? →
  `src/infra/`. The only layer that talks to network or filesystem
  directly outside route handlers.
- Is it a **design-system primitive** (button, dialog, table cell
  renderer)? → `src/ui/design-system/primitives/`. No business
  knowledge; takes props, renders, returns.
- Is it a **utility with no React / no domain knowledge**? →
  `src/shared/`. Self-contained — imports nothing else from the app.

The architectural validator (§5) enforces these boundaries. If your
import graph won't compile, the new feature is in the wrong layer.
