# Admin tools

Three admin-only surfaces, all routed under `/admin/*`, all permission-
gated. Each one stores its mutations as JSON overrides under
`messages/_overrides/` so changes survive deploys and roll back to source
defaults if the override file is removed.

| Tool                | Route                       | Permission                    | What it edits                                      |
| ------------------- | --------------------------- | ----------------------------- | -------------------------------------------------- |
| Translation editor  | `/admin/translations`       | `Api.Translation.Manage`      | Per-locale overrides on top of `messages/{en,ar}/*.json` |
| Theme customizer    | `/admin/theme`              | `Api.Theme.Manage`            | Token map (CSS variables) — draft / publish flow  |
| Entity management   | `/admin/entities`           | `Api.Admin.EntityBuilder`     | Unified surface: static + runtime entities, convert / restore, backups |
| Entity builder      | `/admin/entity-builder`     | `Api.Admin.EntityBuilder`     | **Redirects to `/admin/entities`** (legacy URL kept for bookmarks) |
| Git Bridge          | `/admin/git`                | `Api.Admin.GitOperations`     | Working-tree status + diff viewer + commit/revert for source-tree writes |
| Widget builder      | `/admin/widget-builder`     | `Api.Admin.WidgetBuilder`     | Dashboard widget definitions                       |

Users who hold the `admin` role automatically pass every check above.
Without one of those permissions the page renders the
"Forbidden" notice and the underlying API calls return 403.

---

## Translation editor — `/admin/translations`

### What it does

Every user-visible string in the app comes from `messages/{en,ar}/*.json`.
The editor lets an admin **override** any leaf key without rebuilding —
overrides ship as a separate file and the i18n pipeline merges them on
read. Source files are never mutated.

### Walkthrough

1. **Pick a locale.** The locale toggle at the top sets which file you're
   editing. The right-hand pane shows the AR string for the same key when
   you're in EN, and vice versa, so a translator can see both at once.

2. **Search for a key.** Type into the filter — matches against both the
   key path (e.g. `pages.order.create_title`) and the source string. The
   list is virtualised; 6,000+ keys scroll smoothly.

3. **Edit a value.** Click the row, type into the value input. The change
   is buffered locally — nothing ships until you click **Save** in that
   row. An inline diff shows source-vs-override.

4. **Reset.** Each overridden row exposes "Reset to source", which removes
   the override entirely (the source key is what users will see again).

📸 `docs/screenshots/admin-translations-edit.png`

### How overrides land

- Save → POST `/api/i18n/overrides` with `{ locale, namespace, keyPath, value }` → writes `messages/_overrides/i18n/<locale>.json`.
- The version counter at `/api/i18n/version` increments. Clients poll it; when the number changes they refetch `/api/i18n/overrides?locale=…` and re-merge.
- Reset → DELETE `/api/i18n/overrides` with `{ locale, namespace, keyPath }`.

### Common pitfalls

- **The source file changed under your override.** If a developer renames
  a key in `messages/en/pages.json` but an override still references the
  old name, the override is now orphaned. The editor surfaces this with
  a red "Source missing" badge — clean it up by Reset.
- **You're editing the wrong locale.** The locale toggle is sticky per
  session but resets on a fresh tab. Confirm the badge before saving.
- **You hit 403.** Either you don't have `Api.Translation.Manage` /
  `admin`, or your session has expired and the slim JWT lost its
  permissions. Refresh the page to force a session re-fetch.

---

## Theme customizer — `/admin/theme`

### What it does

Every colour, radius, font weight, and spacing token in the design
system maps to a CSS variable (`--primary`, `--radius`, etc.). The
customizer lets an admin edit that token map and ship it without a
build — themes are runtime data.

The editor uses a **draft → publish** flow so changes can be reviewed
before they go live for everyone.

### Walkthrough

1. **Open a preset.** The "Presets" panel exposes 5–6 starter themes
   (Light, Dark, High Contrast, Sand, etc.). Picking one loads its
   tokens into the draft — *not* into live.

2. **Tweak tokens.** The "Tokens" panel groups them by purpose
   (Foundation / Surface / Brand / Status / Charts). Each row is a
   colour swatch + a value input. Changes are reflected live in the
   preview pane on the right (the customizer renders a complete sample
   page using your draft tokens).

3. **Component overrides.** The "Components" tab lets you override
   per-component classes (e.g. give every `Button` an extra rounded
   corner). Stored as `{ componentId: { elements: { root: { classes:
   [...] } } } }`.

4. **Publish.** Click **Publish** to promote draft → live. Every
   browser polling `/api/theme/version` notices the bump within ~10
   seconds and refetches. **Revert** discards the draft and reloads
   the live tokens — useful if you want to throw away an experiment.

📸 `docs/screenshots/admin-theme-customizer.png`
📸 `docs/screenshots/admin-theme-component-override.png`

### How overrides land

- Edit a token → PATCH `/api/theme/overrides` with `{ tokens: {...} }` → writes the draft section of `messages/_overrides/theme/store.json`.
- Publish → POST `/api/theme/overrides/publish` → copies draft into live + bumps the version counter.
- Revert → POST `/api/theme/overrides/revert` → discards draft, no version bump.
- Read the live map (anyone): GET `/api/theme/overrides`. Add `?stage=draft` (admin-only) to read the unpublished draft.

### Common pitfalls

- **Tokens that look correct but render wrong.** Always use a CSS-var
  reference: `var(--primary)`. Pasting a raw hex (`#ff0000`) into a token
  value works *for that token* but breaks the dark-mode swap because the
  raw value won't recompute when `.dark` is set on `<html>`.
- **You published and the change isn't visible.** Check `/api/theme/version`
  bumped (the publish response carries the new value). If the number is
  fresh but the page looks unchanged, your browser is sitting on a
  cached HTML response — hard refresh.
- **Charts don't repaint.** Charts use `var(--chart-N)` references at
  paint time, so they should track the theme automatically. If they
  don't, the widget hard-coded a hex; fix the widget definition (see
  `docs/DEVELOPMENT.md` walkthrough 3 — colours must be tokens).

---

## Entity management — `/admin/entities`

Unified surface for both static (source-file) and runtime (JSON-store)
entities. The legacy `/admin/entity-builder` redirects here; the
wizard-based workflow it once hosted was retired earlier (Task A3) and
fully replaced by the runtime builder at `/builder` plus the convert
flow surfaced from this page.

### Table view — three row shapes

```
+---------------+---------+----------------------+-------------------------------+
| Name          | Source  | Status               | Actions                       |
+---------------+---------+----------------------+-------------------------------+
| Brand         | static  | Convertible from UI  | [ Edit fields ]               |
| Order         | static  | Source-only          | Open in editor (vscode://…)   |
| Custom Thing  | runtime | Editable             | [ Restore from source ] Edit  |
+---------------+---------+----------------------+-------------------------------+
```

- **Convertible from UI** — the static entity passes the convert
  parser's refusal rules. Clicking **Edit fields** runs convert: the
  source files are deleted, i18n keys move to `pages_dynamic`, the
  entity lands in the runtime store, and `/builder?entity=<id>` opens.
- **Source-only** — the parser refused (custom JSX renderers,
  identifier-only `listColumns`, etc.). The native browser tooltip
  carries the refusal reason; the action opens the source file in
  VSCode.
- **Editable** — runtime entity. **Edit** opens the runtime builder.
  If a paired convert backup still exists on disk, a **Restore from
  source** button appears that reverses the convert atomically.

Full PASS/REFUSE table for every entity in the repo is committed to
[`docs/static-entity-convertibility.md`](static-entity-convertibility.md);
the per-flow runbook lives at
[`docs/runbooks/edit-static-entity.md`](runbooks/edit-static-entity.md).

### Backups panel

Every runtime-mode write snapshots the files it's about to overwrite to
`messages/_overrides/entity-builder/_backups/<id>/`. The "Backups" panel
on the dashboard lists snapshots newest-first; the per-row "Restore"
button re-applies the snapshot atomically (same rollback semantics as a
write — partial restore is impossible).

### Audit log

`messages/_overrides/entity-builder/_audit.jsonl` — one JSON object per
line, never mutated. Shape:

```json
{
  "timestamp": "2026-05-06T10:11:12.345Z",
  "actor": "admin@example.com",
  "entityName": "customer-grade",
  "schemaHash": "sha256:abc…",
  "outcome": "success",         // success | refused | failure
  "filesWritten": 7,
  "warnings": 0,
  "error": null,
  "backupId": "20260506-101112-abc"
}
```

`outcome: refused` means draft mode rejected a write because runtime
mode wasn't enabled (or typecheck failed). `outcome: failure` means the
write started but rolled back — `error` carries the cause.

```bash
# Recent failures:
tail -50 messages/_overrides/entity-builder/_audit.jsonl | jq -c 'select(.outcome=="failure")'
```

### When to use the wizard vs. the plop generator

| Question                                                  | Plop                  | Visual builder        |
| --------------------------------------------------------- | --------------------- | --------------------- |
| Should this show up in PR review?                         | Yes                   | No (override file)    |
| Does it need bespoke logic in the service or schema?      | Yes                   | No (config-only)      |
| Should an admin be able to ship it without redeploy?      | No                    | Yes                   |
| Is it iterating fast (renames, field reshuffles)?         | Slow (PR per change)  | Fast (in-app)         |
| Does it ship to production?                               | Yes                   | Draft = yes; runtime mode = no in prod by default |

Both write the same `EntityConfig` shape. Switching from one path to
the other later is a copy-paste between the override JSON and a
config.ts.

---

## Widget builder — `/admin/widget-builder`

Full walkthrough in
[`docs/DEVELOPMENT.md` § 3](DEVELOPMENT.md#3-add-a-dashboard-widget).
This section covers the registry semantics that admins need to know.

### Where widget definitions live

| Mode    | Path                                                               | Visible to                                |
| ------- | ------------------------------------------------------------------ | ----------------------------------------- |
| Draft   | `messages/_overrides/widget-builder/<id>.json`                     | Loaded at runtime by `/api/widgets`       |
| Source  | `src/features/dashboard/widgets/<id>.widget.ts` (runtime mode)     | Bundled at build time                     |

`/api/widgets` returns drafts + source-registered widgets, **filtered by
the viewer's permissions**. A widget with `permissionKey: "Api.Order"` is
only ever returned to users who hold that permission — non-admins won't
even see it in the picker.

### Dashboard layouts

Per-user layouts live at `messages/_overrides/dashboard-layout/<userKey>.json`.
The default layout (what new users see before customising) lives at
`_default.json`. The customise → save → save-as-default flow:

1. User opens `/dashboard/canvas`.
2. Server returns the user's layout, falling back to `_default.json`,
   falling back to an empty layout.
3. User clicks **Customize** → drags / resizes / adds widgets → **Save**.
   Their per-user layout is written.
4. Admin (only) clicks **Save as default** → the same payload is also
   written to `_default.json`. Existing users are unaffected; new users
   inherit the default on their next visit.

📸 `docs/screenshots/admin-widget-canvas-default.png`

### Removing a widget cleanly

1. Confirm no live layout uses it: `grep -r "<widget-id>" messages/_overrides/dashboard-layout/`.
2. Delete the widget from `/admin/widget-builder` (the row's 🗑).
3. Any layout that still references the missing widget renders a
   "Missing widget" placeholder; users can remove it via the canvas's
   edit mode or admins can sweep `messages/_overrides/dashboard-layout/`.
