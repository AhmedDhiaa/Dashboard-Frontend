# Development walkthroughs

Three end-to-end paths for adding an entity, plus a fourth walkthrough for
dashboard widgets. The ordering is **fastest-to-source-changes** — if
this is your first hour on the project, walking §0 → §1 → §2 → §3 in
order produces a working entity, then materializes it to source files,
then shows you the plop equivalent for when you skip the UI entirely.

| # | Walkthrough | When to use it | Persists where |
| --- | --- | --- | --- |
| §1 | [Runtime builder](#1-add-an-entity-via-the-runtime-builder) | Need a CRUD surface today, no PR | `messages/_overrides/runtime/` JSON files on the server |
| §2 | [Materialize a runtime entity](#2-materialize-a-runtime-entity-to-source-files) | The runtime entity has stabilized; promote it to source so it ships in the build | Real `src/` files, an i18n bundle update, a backup snapshot |
| §3 | [Plop generator](#3-add-an-entity-via-the-plop-generator) | Skip the UI — same `src/` output as §2, terminal-driven | Real `src/` files, an i18n bundle update |
| §4 | [Dashboard widget](#4-add-a-dashboard-widget) | Add a tile (KPI / chart / table / alert / map) to the dashboard canvas | Widget definition under `messages/_overrides/widget-builder/` plus optional `.widget.ts` source on materialize |

Each walkthrough lists exact commands, expected output files, and where
the screenshot lives in `docs/screenshots/`.

---

## 0. Setup (one-time, ~3 minutes)

```bash
git clone <repo-url> acme-dashboard
cd acme-dashboard
npm install                          # ~90 s on a fast connection
cp .env.example .env.local

# Minimum two values for local dev:
echo 'NEXT_PUBLIC_API_URL=http://localhost:5000' >> .env.local
echo 'NEXTAUTH_SECRET=dev-only-min-32-chars-of-bytes-here' >> .env.local

npm run dev
# Ready in ~5 s. Server lives at http://localhost:3000.
```

Sign in at `http://localhost:3000/auth/login` with whatever
credentials your backend accepts. From here, **§1 takes ~2 minutes**;
**§2 takes another ~3 minutes**. Total cold-clone to working entity:
under 10 minutes.

If `npm run dev` complains about `APP_ALLOW_RUNTIME_CODEGEN`, that's
fine — the runtime builder (§1) doesn't need it. Only §2 does, and we
turn it on at the top of that walkthrough.

---

## 1. Add an entity via the runtime builder

**Use this when** an admin needs a CRUD surface without a code change:
the entity is small, you want it shipped today, you don't want to
review the schema in a PR.

**You'll get** a `RuntimeEntity` stored on the server under
`messages/_overrides/runtime/config.json`, with its records in
`messages/_overrides/runtime/data/<entityId>.json`. Every admin sees
the same data — there's no per-browser private database. The entity
is live immediately under `/runtime/<entityId>`. **No source file is
written** unless you explicitly materialize it (§2).

### Step 1 — open the builder

```
http://localhost:3000/builder
```

(or click the **wrench icon** in the global header → "Manage
Entities"). Available to anyone with dashboard access; **materializing**
to source files (§2) requires `Api.Admin.EntityBuilder` and is gated
on an env flag.

📸 `docs/screenshots/dev-runtime-builder-empty.png`

### Step 2 — define the entity

On the **Entities** tab click **+ New entity**:

- **Plural / Singular / Id** — the singular auto-derives from the
  plural; the id auto-slugifies. Override only if the convention
  doesn't fit.
- **Fields** — add one row per field. Types: text, long text, number,
  select, boolean, date. Each row carries `required`, `placeholder`,
  validation (min/max, length, pattern), and a `Set as title` toggle
  that picks the primary list column.
- **Advanced** (collapsed by default):
  - *Features* — toggle which CRUD buttons render (view, create,
    edit, delete, export, import).
  - *List filters* — pick a field, an operator, and a widget (text /
    boolean / date-range). Each filter shows up in the list-view
    toolbar.
  - *Bulk actions* — toolbar entries that act on selected rows
    (delete / export / publish / archive).
  - *Permission key* — ABP permission prefix used after materialize.
    Leave blank to derive `Api.<PascalCase(id)>`.

Hit **Create entity**. The entity appears in the registry; data writes
go straight to the server.

📸 `docs/screenshots/dev-runtime-builder-form.png`

### Step 3 — verify the entity is persisted

```bash
curl -s http://localhost:3000/api/runtime/config | jq '.entities[] | .id'
# Should include your new entity's id, e.g. "ticket-categories"
```

The on-disk record is written here:

```
messages/_overrides/runtime/config.json
messages/_overrides/runtime/data/<entityId>.json   (created lazily on first record)
```

Both directories are git-ignored — they're per-environment runtime
state, not source. (See `.gitignore` and the deploy isolation note in
[runbooks/deploy-cd.md](runbooks/deploy-cd.md) §5.)

### Step 4 — use it

Open `http://localhost:3000/runtime/<entityId>`. You'll see the
list / detail / edit pages the runtime builder rendered from your
schema. Adding a record writes to
`messages/_overrides/runtime/data/<entityId>.json` and the dashboard
refreshes via SignalR push (no polling — see
[Task C4](runbooks/production-hardening.md) for the rationale).

📸 `docs/screenshots/dev-runtime-builder-live.png`

### Step 5 — bind a sidebar page (optional)

Switch to the **Pages** tab on `/builder` to add a sidebar entry
that opens the runtime CRUD view (`/runtime/<entityId>`). The sidebar
refreshes immediately — no reload.

---

## 2. Materialize a runtime entity to source files

**Use this when** the runtime entity from §1 has stabilized and you
want it to live in `src/domains/<area>/<name>/` like a hand-written
entity — code-reviewed, type-checked, in the build.

**You'll get** real `src/` files (the same set §3's plop generator
produces), an i18n bundle update, and a backup snapshot for
one-click rollback.

### Pre-conditions

Materialize is gated on **two** conditions — without both it returns
`409 Conflict`:

| Gate | How to satisfy locally |
| --- | --- |
| **Permission**: `Api.Admin.EntityBuilder` | Sign in as a user with `admin` role, or your backend has granted you that key. |
| **Env flag**: `APP_ALLOW_RUNTIME_CODEGEN=true` | Add it to `.env.local` and restart `npm run dev`. **Do NOT set this in production** — see the long warning in `.env.example`. |

```bash
echo 'APP_ALLOW_RUNTIME_CODEGEN=true' >> .env.local
# Stop and restart the dev server so the env reload picks it up:
# Ctrl-C, then `npm run dev` again.
```

### Step 1 — open the materialize dialog

On `/builder`, click the **rocket icon** on the entity card you built
in §1.

📸 `docs/screenshots/dev-materialize-dialog.png`

### Step 2 — review the diff

The dialog mounts `/api/runtime/materialize/<entityId>?dryRun=true`
which returns the **planned diff** without touching disk:

- Each file the materialize will write or modify, listed by path.
- Status per file: `new` / `modified` / `unchanged`.
- A unified-style diff for `modified` files so you can eyeball
  exactly what changes.

For a fresh entity, all files are `new` — a clean slate. For a
re-materialize of an entity already promoted once, you'll see the
`modified` set — typically `pages.json` plus the entity config if
schema fields changed.

### Step 3 — confirm

Click **Materialize to disk**. The dialog POSTs to
`/api/runtime/materialize/<entityId>` (no dryRun). The endpoint:

1. Re-runs the planner.
2. **Type-checks the planned files** in a sandboxed `tsconfig` — a
   typecheck failure aborts the materialize before any file is
   written.
3. **Snapshots existing targets** to `.entity-builder-backups/<id>`
   so the materialize is reversible from the **Backups** panel at
   `/admin/entity-builder`.
4. Writes the files.
5. Runs `npm run init-entities` so the new entity is registered with
   the registry loader.
6. Removes the runtime entity from `messages/_overrides/runtime/`
   (it now lives in source, not in the runtime override store).
7. Returns `{ success: true, route, files: [...], backupId, warnings }`.

The new route at `/<plural>` is live in the dev server — Next's HMR
picks up the new files within ~1 s.

### Expected files (the 7 produced by `generateEntityFiles`)

For an entity with id `ticket-category` in domain `system`:

```
src/domains/system/ticket-category/ticket-category.types.ts
src/domains/system/ticket-category/ticket-category.schema.ts
src/domains/system/ticket-category/ticket-category.service.ts
src/domains/system/ticket-category/ticket-category.config.ts
src/app/(dashboard)/ticket-categories/page.tsx                    (list)
src/app/(dashboard)/ticket-categories/[id]/page.tsx               (detail)
src/app/(dashboard)/ticket-categories/[id]/edit/page.tsx          (edit)
```

Plus mutations to `messages/{en,ar}/pages.json` adding the
`ticket_category` namespace.

📸 `docs/screenshots/dev-materialize-success.png`

### Step 4 — verify

```bash
npm run type-check && npm run lint && npm run validate
# All three should pass — typecheck already ran inside the
# materialize, but a fresh local pass confirms init-entities wired
# the registry correctly.
```

Then visit `http://localhost:3000/<plural>` — you should see the
list page rendered from the materialized config. The runtime
`/runtime/<id>` URL now redirects to `/<plural>` since the entity
moved out of the runtime store.

### If something goes wrong: rollback

The **Backups** panel at `http://localhost:3000/admin/entity-builder`
lists every snapshot the materialize wrote. Click a snapshot row →
**Restore** → confirm. The previous file contents are written back
and the runtime entity is **not** automatically re-created — you'd
re-add it from §1 if needed. See
`src/features/admin-tools/entity-builder/server/backup.ts` for the
on-disk shape; it's a JSONL log of file contents pre-write, addressable
by snapshot id.

---

## 3. Add an entity via the plop generator

**Use this when** you're skipping the UI: you want a deliberate,
PR-reviewable entity from the start. Same `src/` output as §2 — same
templates, even — but driven from the terminal in 30 seconds.

**You'll get** a typed Zod schema, a `BaseCRUDService`, an
`EntityConfig`, three pages (list / detail / edit), entries in
`messages/{en,ar}/pages.json`, and an auto-registered loader in
`src/core/entities/configs/init.ts`.

### Step 1 — run the generator

```bash
npm run plop -- entity
```

You'll be prompted for:

| Prompt | Example | Notes |
| --- | --- | --- |
| Singular name | `Customer` | PascalCase. Drives every other derivation. |
| Plural name | `Customers` | The list-page heading + nav label. |
| Dashboard route | `/customers` | Press Enter to accept the auto-derived kebab plural. |
| Bilingual? | `Y` | Adds a `foreignName` field (Arabic). |
| Status field? | `Y` | Adds `isActive` boolean. |
| Audit metadata? | `Y` | Adds created/modified columns to the detail view. |
| Domain area | `business` | One of: business, geography, finance, system, … |

📸 `docs/screenshots/dev-plop-prompts.png`

### Step 2 — read the output

Plop prints every file it created. A clean run looks like:

```
✔ ++ src/domains/business/customer/customer.types.ts
✔ ++ src/domains/business/customer/customer.schema.ts
✔ ++ src/domains/business/customer/customer.service.ts
✔ ++ src/domains/business/customer/customer.config.ts
✔ ++ src/app/(dashboard)/customers/page.tsx
✔ ++ src/app/(dashboard)/customers/[id]/page.tsx
✔ ++ src/app/(dashboard)/customers/[id]/edit/page.tsx
messages/en/pages.json: added "customer"
messages/ar/pages.json: added "customer"
post-gen:
  init-entities: ok
  lint-fix: ok (7 files)
```

If `init-entities: FAILED` appears, run `npm run init-entities`
manually and read the error — usually a duplicate registration from
a prior run.

### Step 3 — registry: auto-patched on materialize

`src/shared/config/navigation.ts` and `src/shared/auth/permission-keys.ts`
are **auto-patched** when an entity is materialized via the runtime
builder or the page-builder canvas (Part 3.1 wiring). The materialize
dialog's "Registry metadata" card (Part 3.2) lets you pick the sidebar
group, position, icon, and permission key BEFORE the write — those
values flow into the patcher inputs verbatim.

After materialize, open `/admin/git` to review both edits inline (the
DiffModal — Part 3.4 — shows the unified diff per file) before
committing.

The patchers are byte-preserving and idempotent: re-running materialize
on an already-registered entity is a no-op. They refuse loudly on
identifier collisions, so a permission-keys conflict surfaces as a
materialize refusal rather than silently mis-writing the file.

If you're generating an entity OUTSIDE the materialize flow (e.g.
hand-rolling the source files), you'll still need to add the entries
manually — but in practice the runtime builder is the supported
authoring path. See `docs/runbooks/edit-static-entity.md` for the
convert/restore lifecycle that bridges the two.

### Step 4 — add the nav translation

Add `customers` to `messages/{en,ar}/nav.json`:

```diff
   "employees": "Employees",
+  "customers": "Customers",
   "drivers": "Drivers",
```

Mirror the AR file. Both must agree or `custom/no-untranslated-strings`
will eventually flag it.

### Step 5 — verify

```bash
npm run type-check && npm run lint && npm run validate
```

All three should pass. Then visit
`http://localhost:3000/customers`. You should see an empty list page
with the search bar and "+ New" button.

📸 `docs/screenshots/dev-plop-result.png`

### Step 6 — backend wiring

The generated service points at `/api/app/<entity>` by default. If
your backend uses a different endpoint, edit it in
`src/domains/<area>/<entity>/<entity>.service.ts`. Re-running the
generator does **not** overwrite — it's safe to edit afterwards.

### Common follow-up edits

- **Field-level form layout**: `formFieldOrder` in `<entity>.config.ts`.
- **List columns**: `listColumns` in `<entity>.config.ts`.
- **Required permissions**: `permissionKey` in the config + the
  navigation entry from Step 3.
- **Validation**: extend the Zod schema in `<entity>.schema.ts`. The
  form picks up the new rules automatically.

---

## 4. Add a dashboard widget

**Use this when** you want a tile on the dashboard: a KPI, a chart, a
table preview, an alert strip, a map.

**You'll get** a widget definition that any user with the right
permission can drop onto their personal dashboard layout.

### Step 1 — open the widget builder

Navigate to **Admin → Widget builder** or
`http://localhost:3000/admin/widget-builder`. Permission:
`Api.Admin.WidgetBuilder` (or `admin` role).

### Step 2 — wizard, 5 steps

| Step | What you fill in |
| --- | --- |
| 1. Basics | Widget id (kebab), title key, category (kpi / chart / table / alert / map), refresh policy (manual / interval / socket), permission key. |
| 2. Data source | Either *registered entity* (pick from the dropdown — the one you built in §1, §2, or §3) or *API endpoint* (paste a path + items-path). |
| 3. Visualization | Variant-aware sub-form. KPI = value field + optional trend. Chart = chart type, X axis, Y series, **token** colours. Table = column list. Alert = severity + message field. Map = position field. |
| 4. Preview | Toggle between mock data and live. Live calls the configured source through your session. |
| 5. Save | Summary card + Save button. |

📸 `docs/screenshots/dev-widget-builder-step3-chart.png`
📸 `docs/screenshots/dev-widget-builder-preview.png`

### Step 3 — verify the widget exists

```bash
curl -s http://localhost:3000/api/admin/widget-builder | jq '.widgets[] | .id'
curl -s http://localhost:3000/api/widgets | jq '.widgets[] | {id, category, source}'
```

The first lists every saved widget (admin-only). The second is the
runtime registry the dashboard canvas reads, filtered to widgets the
*current viewer* has permission for.

### Step 4 — drop it on a dashboard

Open `http://localhost:3000/dashboard/canvas`. Click **Customize**,
then **+ Add widget**, pick yours from the picker, then **Save**.

📸 `docs/screenshots/dev-widget-canvas-edit.png`

The layout persists per user in
`messages/_overrides/dashboard-layout/<userKey>.json`. Admins
additionally see **Save as default**, which writes `_default.json` —
the layout new users see before they customise.

### Visualisation rules to remember

- **Colours must be tokens**: `var(--primary)`, `var(--accent)`,
  `var(--chart-1)..(--chart-5)`. Hex colours fail Zod validation in
  [`src/shared/widgets/schema.ts`](../src/shared/widgets/schema.ts) and
  the widget won't save. This is what keeps charts dark-mode-correct
  without a re-render.
- **Refresh `interval` is deprecated**: schema literal kept for
  back-compat, but the runtime coerces to `manual` and logs a warning.
  Use `socket` with a topic for live updates (Task C4).
- **`socket` refresh implies `api-call` source**: the widget needs the
  server to push events, which only the api-call path is wired for.
- **Chart bodies are lazy-loaded**: recharts (~85 KB gz) only ships
  when a chart widget mounts. KPI / table / alert widgets pay zero
  recharts cost.

---

## Where to go next

- **API surface** the wizards POST against → [`docs/API-REFERENCE.md`](API-REFERENCE.md).
- **Day-2 admin work** (translations, theming, draft management) → [`docs/ADMIN-TOOLS.md`](ADMIN-TOOLS.md).
- **Production runbooks** → [`docs/runbooks/`](runbooks/) (next-auth rollback, Sentry verification, security headers, deploy hygiene, deploy CD, incident response).
