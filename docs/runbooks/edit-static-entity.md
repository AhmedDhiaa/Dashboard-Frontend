# Editing a static entity from the UI

This runbook covers the convert / edit / restore loop for static
entities — the `*.config.tsx` files under `src/domains/`. The path is:

```
Static entity ─convert─► Runtime entity ─edit─► (Materialize ─►) Static again
                                  ▲                                │
                                  └─────────── Restore from source ─┘
```

All actions live on `/admin/entities`. The page is admin-only and gated
behind `APP_ALLOW_RUNTIME_CODEGEN=true` — it 404s in production.

## When it works

The convert button (**"Edit fields"** on a static row) is enabled when
the parser at
[`src/features/admin-tools/entity-converter/server/parse-static-config.ts`](../../src/features/admin-tools/entity-converter/server/parse-static-config.ts)
can lift the entity into the runtime store losslessly. A handful of
currently-convertible entities:

- `brand`
- `country`
- `currency`
- `job-title`
- `unit`
- `ticket-message`

The canonical list (with refusal reasons for everything else) is
auto-generated to
[`docs/static-entity-convertibility.md`](../static-entity-convertibility.md)
by `scripts/build-static-entity-convertibility.mts`. Re-run it after
adding entities or tightening the parser:

```bash
npx tsx scripts/build-static-entity-convertibility.mts
```

## When it refuses

The parser refuses loudly rather than producing a half-converted entity.
Five common refusal categories, each with an example:

| Refusal | Example | Why |
| --- | --- | --- |
| Uses external renderers (`listColumns` is an identifier ref) | `order` | The runtime UI can't run an imported renderer function. |
| `detailSections` contains custom render logic (JSX) | `category`, `area`, `item` | Same — runtime UI renders fields uniformly. |
| `formFields.<key>` uses custom render hooks (`customRender`) | `vehicle.sizeInfo`, `warehouse.locationPoint` | Custom field renderers can't be serialised. |
| `formFields` uses unsupported type (`enum`, `password`) | `ticket.status`, `user.password` | Outside the 19-type RuntimeFieldType union. |
| `formFields is empty after stripping hidden/refused entries` | `stock-quantity`, `sales-invoice-item-document` | Read-only reports — nothing to edit. |

The full table of every refusal at
[`docs/static-entity-convertibility.md`](../static-entity-convertibility.md).
The refused row in `/admin/entities` shows the reason as a native browser
tooltip on hover; the action button opens the file in VSCode so the
admin can read the actual source.

## What convert does (end-to-end)

1. Parses the `*.config.tsx` + sibling `.schema.ts` + `.types.ts`.
2. Snapshots all 3 source files + both `pages.json` + both
   `pages_dynamic.json` into `.entity-builder-backups/<timestamp>/`.
3. Inserts the runtime entity into
   `messages/_overrides/runtime/config.json`.
4. Moves the `pages.<entityName>.*` subtree → `pages_dynamic.<id>.*`
   for both locales.
5. Deletes the 3 source files.
6. Re-runs `npm run init-entities`.
7. Appends one row to `.entity-builder-backups/_audit.jsonl` with
   `kind: "convert"`.

Any failure in steps 3-6 triggers full rollback via the snapshot. The
audit row records `outcome: "rolled-back"` and the originating error.

After convert, the user is redirected to
`/builder?entity=<id>` and a toast confirms the count:
"Wrote N files - review in Git Bridge before committing".

## How to undo

The runtime row in `/admin/entities` shows a **Restore from source**
button when a paired convert backup still exists. Clicking it:

1. Confirms the action via a dialog showing the backup id.
2. Takes a **fresh safety snapshot** of the current state (the runtime
   config + current i18n + any source files at the original paths).
3. Calls `restoreSnapshot(backupId)` which puts back ALL files the
   convert had captured — including both `pages.json` and both
   `pages_dynamic.json` at their pre-convert state, reversing the i18n
   migration as a side effect.
4. Removes the entity from
   `messages/_overrides/runtime/config.json`.
5. Re-runs `npm run init-entities`.
6. Appends an audit row with `kind: "restore"`.

Any failure restores the safety snapshot (step 2) plus unlinks any
source files brought back by step 3 that weren't in the safety
snapshot — `partialState: "untouched"` is byte-accurate. If the
rollback itself fails (disk fault) the audit row is
`outcome: "half-restored"` and the response carries
"hand-recover from snapshots" so the admin knows TWO snapshot ids to
choose from.

## Where the backups live

`.entity-builder-backups/<timestamp>/` — each subdirectory mirrors the
project tree under `src/domains/`, `messages/`, and
`messages/_overrides/runtime/`. The rolling-window policy keeps the
most recent 20 snapshots; older ones get pruned on each new snapshot.

The audit log at `.entity-builder-backups/_audit.jsonl` is append-only
and never pruned — see one line per attempted convert + restore +
registry patch (Part 3.1), with `kind` discriminating between them.

## Known follow-ups

- The page-builder canvas's materialize toolbar doesn't yet surface
  the `MaterializeSummaryCard` inline (Part 3.2 deferral). The
  page-builder route + `useMaterializePage` hook already accept the
  body overrides; the inline mount is a UX choice and a small follow-up.
