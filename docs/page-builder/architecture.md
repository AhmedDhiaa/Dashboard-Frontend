# Page Builder — Architecture

> **Audience:** engineers reviewing or modifying the Page Builder feature.
> **Companion docs:** [`schema.md`](./schema.md) (the Zod contracts),
> [`extending.md`](./extending.md) (recipe for new blocks),
> [`canvas.md`](./canvas.md) (canvas authoring + DnD layer),
> [`user-guide.md`](./user-guide.md) (end-user view).

> **Canvas authoring layer:** see [`canvas.md`](./canvas.md) for the
> tree-based authoring component, drag-and-drop wiring, and state
> machine details introduced in Phase 2A and 2B.

---

## 1. The big picture

```text
                 ┌──────────────────────────────────────┐
                 │  /admin/page-builder  (canvas UI)    │
                 │   ┌────────────┐   ┌──────────────┐  │
                 │   │ Palette    │   │  Properties  │  │
                 │   │ (registry) │   │  Panel (JSON)│  │
                 │   └────────────┘   └──────────────┘  │
                 │   ┌────────────────────────────────┐ │
                 │   │  Center: blocks list +         │ │
                 │   │   <PreviewPane>                │ │
                 │   │     <PageRenderer>             │ │
                 │   └────────────────────────────────┘ │
                 └──────────────────────────────────────┘
                                  │  Save
                                  ▼
              ┌────────────────────────────────────┐
              │  POST /api/admin/page-builder/…    │
              │   1. requirePermission              │
              │   2. pageSchema.parse              │
              │   3. writePage  (assertSafePath)   │
              │   4. mergePageI18n                 │
              │   5. appendAudit                   │
              └────────────────────────────────────┘
                                  │
                  ┌───────────────┴────────────────┐
                  ▼                                ▼
   messages/_overrides/pages/<id>.json   messages/{en,ar}/pages_dynamic.json

                                  │  Materialize
                                  ▼
       ┌──────────────────────────────────────────────────┐
       │  POST /…/<id>/materialize       7-gate pipeline  │
       │   1. env kill-switch                             │
       │   2. CI scan                                     │
       │   3. requirePermission                           │
       │   4. rate-limit (5/min)                          │
       │   5. assertSafePath                              │
       │   6. typecheckPlannedFiles                       │
       │   7. snapshotFiles + appendAudit                 │
       └──────────────────────────────────────────────────┘
                                  │
                                  ▼
              src/app/(dashboard)/pages/<id>/{page.tsx,schema.ts,types.ts}
```

The same `<PageRenderer>` runs in three contexts:
1. **Canvas live-preview** — schema is in-memory React state.
2. **Runtime route `/pages/[pageId]`** — schema is read server-side
   from the override store on every request.
3. **Materialized route `src/app/(dashboard)/pages/<id>/`** — schema
   is bundled at build time, validated through `pageSchema.parse(...)`
   on module load.

This single-renderer story is the load-bearing bet of the architecture.
Fork it and the three contexts drift.

---

## 2. Module map

```
src/features/admin-tools/page-builder/
├── schema/                    Zod schemas (Phase 1)
│   ├── field-schema.ts        localized + ident patterns + fieldSchema
│   ├── action-schema.ts       api/navigate/dialog/drawer + buttonSchema
│   ├── block-schema.ts        17 block variants + dataSource + formLayout
│   └── page-schema.ts         pageSchema (top-level)
├── registry/                  Block registry (Phase 2)
│   ├── block-registry.ts      class + singleton + register()
│   └── blocks/*.tsx           one file per block type
├── renderer/                  Runtime rendering (Phase 3)
│   ├── PageRenderer.tsx       page-level guard + layout frame
│   ├── BlockRenderer.tsx      registry dispatch + recursion
│   ├── FormLayoutRenderer.tsx 4 layouts, recursive
│   ├── ActionExecutor.ts      api/navigate/dialog/drawer
│   └── page-builder-action.service.ts   apiClient seam
├── canvas/                    Editor UI (Phase 4)
│   ├── PageBuilderCanvas.tsx  shell
│   ├── BlockPalette.tsx       drag source
│   ├── PropertiesPanel.tsx    JSON editor
│   ├── PreviewPane.tsx        live render
│   ├── SwaggerWizard.tsx      Phase 5
│   └── hooks/
│       ├── useCanvasState.ts  schema + undo/redo + dirty
│       ├── useSavePage.ts     POST/PUT + SignalR fan-out
│       └── useMaterializePage.ts  POST + result banner
├── openapi/                   Swagger integration (Phase 5)
│   ├── parser.ts              parseSwagger + clusterEndpoints
│   ├── field-mapper.ts        OpenAPI prop → field type
│   └── page-generator.ts      cluster → PageSchema
├── server/                    Server-side (Phase 6 + 7)
│   ├── storage.ts             read/write/list/delete
│   ├── audit.ts               JSONL audit log
│   ├── i18n-merge.ts          pages_dynamic.json merger
│   ├── code-generator.ts      schema → TS files
│   └── file-writer.ts         7-gate materialize pipeline
└── components/                Cross-app surfaces
    └── DynamicPagesSection.tsx   sidebar entries (Phase 8)
```

API routes (under `src/app/api/admin/page-builder/`):

```
pages/                        list + create
  [pageId]/                   read + update + delete
    materialize/              7-gate codegen
preview/[pageId]/             read-only
proxy-swagger/                server-side fetch + cache
```

Dynamic page route: `src/app/(dashboard)/pages/[pageId]/page.tsx`.

---

## 3. The single-renderer rule

`<PageRenderer schema={...}>` is the only component that knows how to
turn a `PageSchema` into JSX. Everything else delegates:

- `<PageBuilderCanvas>` mounts `<PreviewPane>` which mounts
  `<PageRenderer>`.
- `/pages/[pageId]/page.tsx` reads schema from the override store and
  passes it to `<PageRenderer>`.
- Materialized `src/app/(dashboard)/pages/<id>/page.tsx` imports the
  inlined schema and passes it to `<PageRenderer>`.

This keeps three otherwise-divergent paths semantically identical.
Adding a new render path means feeding a `PageSchema` into the same
component — never copying its rendering logic.

---

## 4. Block registry — the load-order rules

`block-registry.ts` orchestrates registration. The constraints:

1. **The singleton is created at module top.** All block files import
   `blockRegistry` from this module.
2. **Registrations happen at the bottom of `block-registry.ts`.** Block
   files contribute *definitions* via named exports; the registry calls
   `register(definition)` for each in order.
3. **Block files don't access `blockRegistry` at module top-level.**
   They may import it for use INSIDE `Render` callbacks (which fire
   after init), but reading it at the top would break the registration
   cycle.

Layout blocks (card / tabs / accordion / grid) follow this rule by
accepting pre-rendered children via React children or an id-keyed map.
The recursion into nested `blocks: BlockSchema[]` is owned by
`BlockRenderer` (in `renderer/`), which DOES import the registry —
that file isn't part of the cycle.

---

## 5. Save flow

```
Canvas Save click
  │
  ▼
useSavePage.trigger(schema, …)
  │
  ▼
PUT /api/admin/page-builder/pages/<id>     (404 ⇒ POST instead)
  │
  ▼
1. requirePermission(ADMIN_PAGE_BUILDER)         (rate-limit gate too)
2. pageSchema.safeParse(body)        ← rejects invalid drafts at edge
3. writePage(id, parsed)
   │
   ├─ assertSafePath
   ├─ withLock(id) → readPage → write file → bumpVersion
   └─ structured-clone cache update
4. mergePageI18n(parsed)
   │
   ├─ extractPageI18n → {<id>: {title, blocks: [...]}, …}
   └─ writes messages/{en,ar}/pages_dynamic.json
5. appendAudit({operation: "create"|"update", …})
6. (client) socket.invoke("PageUpdated", id)     ← SignalR fan-out
```

A `<PageVersionWatcher>` mounted on the dynamic route subscribes to
`ReceivePageSchemaChanged` events and triggers `router.refresh()` when
the saved pageId matches.

---

## 6. Materialize flow — the 7 gates

```
POST /api/admin/page-builder/pages/<id>/materialize
  │
  ▼
GATE 1 — env kill-switch
  process.env.APP_ALLOW_RUNTIME_CODEGEN === "true"   else 404

GATE 2 — CI scan
  scripts/check-codegen-flag.mjs (run in CI; not at request time)

GATE 3 — permission
  requirePermission(PERMISSIONS.ADMIN_PAGE_BUILDER)

GATE 4 — rate limit
  page-builder-materialize: 5/min/IP (config.ts; longer-prefix matched
  before the CRUD rule)

GATE 5 — path safety
  assertSafePath enforced inside persistGeneration + snapshotFiles +
  storage.ts. Every fs primitive passes through the helper.

GATE 6 — sandbox typecheck
  typecheckPlannedFiles writes the planned files into
  .entity-builder-cache/typecheck/<id>/, runs `tsc --noEmit` against
  the project tsconfig, returns {ok, errors}. ok === false ⇒ refused
  before touching real source.

GATE 7 — backup + audit
  snapshotFiles → .entity-builder-backups/<timestamp>/
  appendAudit JSONL line per attempt
```

The pipeline is reused byte-for-byte from the entity-builder
(`src/features/admin-tools/entity-builder/server/`). No code is forked
— `materializePage` in `server/file-writer.ts` is a thin wrapper that
adds custom-block validation in front of the existing pipeline.

---

## 7. Schema-master invariants

Three SSOT unions live in `src/core/entities/`:

- **`MASTER_FIELD_TYPES`** — superset of every field-type vocabulary
  (FormFieldConfig.type ∪ EntityBuilderSchema.FIELD_TYPES ∪ Page Builder
  spec §3 types).
- **`MASTER_COLUMN_TYPES`** — same for column types.

Page Builder's own enums in `field-schema.ts` and `block-schema.ts` are
declared `as const satisfies readonly MasterFieldType[]` (or
`MasterColumnType[]`). Drift between the Page Builder list and the
master fails type-check immediately.

This means: adding a new field type that the Page Builder needs requires
adding a literal to MASTER once. Existing entity configs and entity-
builder JSON drafts can keep their narrower picks unchanged.

---

## 8. Permission gate map

```
schema.permission         → PageRenderer wraps in PagePermissionGuardByKey
block.permission          → BlockRenderer checks isGranted() before render
field.permission          → field-block render (Phase 9 follow-up; gate exists in schema)
button.permission         → button-block.Render returns null when not granted
sidebar visibility        → DynamicPagesSection filters via isGranted()
```

Every check goes through the existing `usePermissionContext()`. There
is no parallel Page Builder permission system.

---

## 9. Translation flow

```
Save (canvas)
  ↓
mergePageI18n(schema)
  ↓
messages/{en,ar}/pages_dynamic.json
  {
    "<pageId>": {
      "title": "…",
      "description": "…",
      "blocks": [{ "text": "…", "title": "…" }, …]
    }
  }
  ↓
/admin/translations  (existing translation editor)
  ↓
messages/_overrides/i18n/<locale>.json   (override layer)
  ↓
PageRenderer → useTranslations("pages_dynamic")
  ↓
resolveOrFallback(t, "<pageId>.title", schema.title.en)
  ↓
Rendered string  (override > base file > inline `.en` fallback)
```

The fallback chain matters: tests, fresh-saved pages, and pages saved
before the namespace existed all still render — no missing-message
markers leak to users.

---

## 10. Relationship to the entity-builder

Page Builder and Entity Builder are siblings under
`src/features/admin-tools/`. They share infrastructure heavily but
operate on different artifacts:

| | Entity Builder | Page Builder |
| :--- | :--- | :--- |
| Output artifact | A new entity (service + config + types + list/detail/edit pages) | A standalone page (any composition of blocks) |
| Schema authority | `entityBuilderSchema` (entities + fields + columns) | `pageSchema` (blocks + actions + permissions) |
| Source SSOT | `messages/_overrides/entity-builder/<name>.json` | `messages/_overrides/pages/<id>.json` |
| Materialize target | `src/domains/<domain>/<entity>/` | `src/app/(dashboard)/pages/<id>/` |
| Pipeline | 7-gate (own) | 7-gate (reuses entity-builder's) |
| Permission key | `Api.Admin.EntityBuilder` | `Api.Admin.PageBuilder` |
| Rate-limit row | `codegen-entity` 5/min | `page-builder-materialize` 5/min + `page-builder-crud` 30/min |

Page Builder explicitly **reuses** these from Entity Builder:
- `snapshotFiles` (backup)
- `typecheckPlannedFiles`
- `persistGeneration` (transactional file writer + i18n merge)
- The `GeneratedFile` / `CodeGenPlan` / `I18nBundle` types

That reuse is the architectural insurance: any future hardening of
the codegen pipeline (new gates, better diff, sharper typecheck) lands
in entity-builder and the Page Builder picks it up unchanged.

---

## 11. What lives outside the Page Builder feature

The feature deliberately doesn't own:

- **`PageRenderer`'s rendered components.** Every block wraps an
  existing primitive / CRUD component. Visual changes happen there,
  not here. The block files are thin adapters.
- **Permission semantics.** `usePermissionContext()` is the single
  source of truth — Page Builder calls `isGranted(...)` and reacts.
- **i18n loading.** The `pages_dynamic` namespace is registered in
  `src/i18n/request.ts`. The Page Builder writes to disk; the i18n
  layer loads + merges overrides.
- **Theme.** Every block uses semantic Tailwind tokens or wraps the
  existing primitives that already speak them. The `PreviewPane`
  toggles light/dark by toggling the `dark` class on a wrapper —
  same mechanism as the rest of the dashboard.

This isolation is intentional: the canvas can grow new blocks, the
schema can gain new variants, and the rendering can absorb design-
system changes — without any of those crossing into the others.
