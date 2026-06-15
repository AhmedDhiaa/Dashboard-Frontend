# API reference

The BFF layer in `src/app/api/*` exposes three families of endpoints:

- [`/api/i18n/*`](#i18n) — runtime translation overrides + version polling.
- [`/api/theme/*`](#theme) — runtime theme tokens + draft/publish flow.
- [`/api/admin/entity-builder/*`](#entity-builder) — visual builder backend.
- [`/api/admin/widget-builder/*`](#widget-builder) — widget builder backend.
- Plus a few related surfaces: [`/api/widgets`](#widgets), [`/api/user/dashboard-layout`](#dashboard-layouts), [`/api/admin/dashboard-layout/default`](#dashboard-layouts), [`/api/health`](#health), [`/api/_test/sentry`](#test-sentry).

> **Auth model:** every admin route reads the NextAuth session via the
> `requirePermission(...)` helper in [`src/app/api/_lib/require-permission.ts`](../src/app/api/_lib/require-permission.ts).
> Admins (role `admin`) pass every check. Non-admins must hold the named
> permission key on their slim JWT or the route fetches fresh permissions
> from the ABP `application-configuration` endpoint and re-checks. Route
> headers in this doc list the *minimum* permission.

> **Locale bypass:** all of these are `runtime: nodejs` routes. They run
> on the server only; the public `connect-src` CSP allows the browser to
> reach them via same-origin fetch.

---

## i18n

### `GET /api/i18n/version`

**Auth:** none (cheap polling endpoint).

Returns the monotonic counter that's bumped on every i18n PATCH /
DELETE. Clients poll this on a short interval; on a change they refetch
`/api/i18n/overrides`. The point is to avoid re-pulling every key every
few seconds.

```bash
curl http://localhost:3000/api/i18n/version
```

```json
{ "version": 17 }
```

Response carries `Cache-Control: no-store, no-cache, must-revalidate`
so a CDN can't pin it.

### `GET /api/i18n/overrides?locale=<en|ar>`

**Auth:** none (the translations are user-visible; gating the read
would prevent the client from rendering them).

Returns the full override map for one locale. The shape is *namespaced*
— same as `messages/<locale>/<namespace>.json`.

```bash
curl 'http://localhost:3000/api/i18n/overrides?locale=en' | jq
```

```json
{
  "locale": "en",
  "overrides": {
    "pages": {
      "order": { "create_title": "New order (override)" }
    },
    "nav": { "dashboard": "Home" }
  }
}
```

Errors:

| Status | When                                          |
| ------ | --------------------------------------------- |
| 400    | `locale` missing or not in `["en","ar"]`.     |
| 500    | I/O failure reading the override file.        |

### `PATCH /api/i18n/overrides`

**Auth:** `Api.Translation.Manage` (or `admin`).

Upsert one leaf key. Body shape:

```json
{
  "locale": "en",
  "namespace": "pages",
  "keyPath": "order.create_title",
  "value": "New order (override)"
}
```

`namespace` maps to the file (`messages/en/pages.json`); `keyPath` is
the dot-separated path inside that file. The handler bumps the version
counter on success.

```bash
curl -X PATCH http://localhost:3000/api/i18n/overrides \
  -H "Content-Type: application/json" \
  -d '{"locale":"en","namespace":"pages","keyPath":"order.create_title","value":"New order"}'
```

```json
{ "success": true, "version": 18 }
```

Errors: 400 (validation), 401 (no session), 403 (missing permission).

### `DELETE /api/i18n/overrides`

**Auth:** `Api.Translation.Manage`.

Remove one override (the source key wins again). Body shape: same as
PATCH minus `value`. Bumps the version counter.

---

## Theme

### `GET /api/theme/version`

**Auth:** none.

Identical pattern to `/api/i18n/version` — counter bumped on publish
only (`PATCH` to `/api/theme/overrides` writes the draft and does *not*
bump). Clients use this to know when published tokens have changed.

```json
{ "version": 4 }
```

### `GET /api/theme/overrides[?stage=draft]`

**Auth:** anyone for `stage=live` (default). `Api.Theme.Manage` for
`stage=draft`.

Returns the live token map. Pass `?stage=draft` to read the
unpublished draft instead — admin-gated because the draft can carry
in-flight experiments that aren't ready for general view.

```bash
curl http://localhost:3000/api/theme/overrides | jq
```

```json
{
  "stage": "live",
  "tokens": { "primary": "oklch(64% 0.18 260)", "radius": "0.6rem" },
  "version": 4,
  "updatedAt": "2026-04-30T10:00:00.000Z",
  "updatedBy": "designer@example.com"
}
```

### `PATCH /api/theme/overrides`

**Auth:** `Api.Theme.Manage`.

Replace the draft tokens map. Body:

```json
{ "tokens": { "primary": "oklch(60% 0.20 200)", "accent": "oklch(80% 0.15 90)" } }
```

Writes to the draft only — does NOT bump the version. Publish promotes
the draft to live.

### `POST /api/theme/overrides/publish`

**Auth:** `Api.Theme.Manage`.

Promote draft → live and bump the version counter. No request body.

```json
{
  "stage": "live",
  "tokens": { ... },
  "version": 5,
  "updatedAt": "2026-05-01T11:00:00.000Z",
  "updatedBy": "designer@example.com"
}
```

### `POST /api/theme/overrides/revert`

**Auth:** `Api.Theme.Manage`.

Discard the draft and reset it to the currently-live tokens. No version
bump (nothing changed for end users). Useful when an experiment is
abandoned mid-edit.

---

## Entity builder

All admin-gated by `Api.Admin.EntityBuilder`. The wizard at
`/admin/entity-builder` is a thin client over these endpoints.

### `GET /api/admin/entity-builder`

List every saved draft. Reads `messages/_overrides/entity-builder/*.json`.

```json
{
  "drafts": [
    {
      "entityName": "customer-grade",
      "domain": "business",
      "endpoint": "/api/app/customer-grade",
      "permissionKey": "Api.CustomerGrade",
      "fieldCount": 6
    }
  ]
}
```

### `POST /api/admin/entity-builder`

Clone a draft under a new name. Body:

```json
{ "sourceEntityName": "customer-grade", "newEntityName": "supplier-grade", "newPlural": "supplier-grades" }
```

Returns `{ success: true, draft: <full schema> }` on success. The
endpoint and permission key are re-derived from the new name so a
clone never shadows the source's URL.

Errors: 400 (validation — name shape, missing source), 404 (source
not found).

### `GET /api/admin/entity-builder/<entityName>`

Fetch one saved draft by name. Returns `{ draft: EntityBuilderSchema }`.

### `POST /api/admin/entity-builder/generate`

The big one — saves a schema. Two modes, picked by the env flag
`APP_ALLOW_RUNTIME_CODEGEN`:

| Flag value | Mode    | What happens                                                                                  |
| ---------- | ------- | --------------------------------------------------------------------------------------------- |
| `"true"`   | runtime | Writes the generated source files (schema, service, config, three pages) + merges i18n keys + runs `npm run init-entities` + `eslint --fix`. Snapshots existing files first; rolls back on any error. |
| anything else (default) | draft | Writes `messages/_overrides/entity-builder/<name>.json` only. Source tree is never touched. |

Body:

```json
{
  "mode": "create",          // "create" | "update" | "delete"
  "schema": { /* EntityBuilderSchema */ },
  "force": false             // honored on mode=create; implicit on update
}
```

Success response (draft mode):

```json
{
  "success": true,
  "mode": "draft",
  "savedTo": "messages/_overrides/entity-builder/customer-grade.json",
  "message": "Schema saved as draft. Set APP_ALLOW_RUNTIME_CODEGEN=true and re-POST to write source files."
}
```

Success response (runtime mode):

```json
{
  "success": true,
  "mode": "runtime",
  "files": ["src/domains/.../customer-grade.types.ts", "..."],
  "warnings": [],
  "route": "/customer-grades",
  "backupId": "20260506-123456-abc"
}
```

Errors:

| Status | When                                                                  |
| ------ | --------------------------------------------------------------------- |
| 400    | Body not JSON, or schema fails Zod validation (`issues` array in body)|
| 409    | `mode=create` and the entity already exists (use `force: true`)       |
| 422    | Runtime mode: planned files failed typecheck (`typecheckErrors` in body) |
| 500    | I/O failure during write (file-writer rolls back on this path)        |

Every attempt — accepted, refused, succeeded, failed — appends one
JSONL line to `messages/_overrides/entity-builder/_audit.jsonl`. See
[ADMIN-TOOLS.md § audit log](ADMIN-TOOLS.md#audit-log) for the row shape.

### `POST /api/admin/entity-builder/diff`

Body: `{ schema: EntityBuilderSchema }`. Returns a per-file diff
between what the schema would write and what's currently on disk. The
wizard's review step uses this to show the admin a unified preview
before they hit Generate.

```json
{
  "files": [
    { "path": "src/domains/.../customer-grade.config.ts", "diff": "@@ -3,4 +3,5 @@\n …" }
  ]
}
```

### `GET /api/admin/entity-builder/backups`

List file snapshots, newest first. Each runtime-mode write snapshots
the files it's about to overwrite into
`messages/_overrides/entity-builder/_backups/<id>/`.

```json
{
  "snapshots": [
    {
      "id": "20260506-123456-abc",
      "createdAt": "2026-05-06T12:34:56.000Z",
      "fileCount": 7,
      "entityName": "customer-grade"
    }
  ]
}
```

### `POST /api/admin/entity-builder/backups/<id>`

Restore a snapshot atomically. Same rollback semantics as a write —
partial restore is impossible.

---

## Widget builder

All admin-gated by `Api.Admin.WidgetBuilder`. Symmetric API to
entity-builder.

### `GET /api/admin/widget-builder`

```json
{
  "widgets": [
    {
      "id": "todays-orders",
      "titleKey": "dashboard.widgets.todays_orders",
      "category": "kpi",
      "permissionKey": "Api.Order",
      "source": "entity:order"
    }
  ]
}
```

### `GET /api/admin/widget-builder/<id>`

Fetch one widget definition (`{ widget: WidgetBuilderSchema }`).

### `DELETE /api/admin/widget-builder/<id>`

Removes the draft. In runtime mode (env `APP_ALLOW_RUNTIME_CODEGEN=true`)
also unlinks `src/features/dashboard/widgets/<id>.widget.ts`. Returns
`{ success: true, filesRemoved: [...] }`.

### `POST /api/admin/widget-builder/generate`

Save a widget definition. Body:

```json
{ "mode": "create" | "update", "schema": { /* WidgetBuilderSchema */ } }
```

Same draft / runtime split as entity-builder. Draft writes
`messages/_overrides/widget-builder/<id>.json`; runtime additionally
emits `src/features/dashboard/widgets/<id>.widget.ts`.

Errors: 400 (validation), 409 (`mode=create` and id taken).

### `GET /api/admin/widget-builder/preview?entity=<name>`

Pulls a 25-row sample from the registered entity's REST endpoint, using
the admin's session. Powers the wizard's live-preview mode without
committing the widget. Returns `{ items: Record<string, unknown>[] }`.

---

## Widgets registry

### `GET /api/widgets`

**Auth:** any signed-in user. Filters per-viewer permissions.

Returns the widgets the current viewer is allowed to mount on their
dashboard. Reads draft files + (in runtime mode) statically-registered
widgets, then drops anything whose `permissionKey` the viewer doesn't
hold.

```json
{ "widgets": [ { "id": "todays-orders", /* full WidgetBuilderSchema */ }, ... ] }
```

---

## Dashboard layouts

### `GET /api/user/dashboard-layout`

**Auth:** any signed-in user.

Returns the user's saved layout, falling back to `_default.json`,
falling back to an empty layout.

```json
{ "widgets": [ { "instanceId": "...", "widgetId": "todays-orders", "x": 0, "y": 0, "w": 3, "h": 2 } ], "version": 4, "updatedAt": "2026-05-01T10:00:00.000Z" }
```

### `PUT /api/user/dashboard-layout`

**Auth:** any signed-in user. Replaces the user's layout. Body shape
same as the GET response. Saves to
`messages/_overrides/dashboard-layout/<userKey>.json`. The user key is
derived from the session (`sub` or email, sanitised to filesystem-safe
chars).

### `GET /api/admin/dashboard-layout/default`

**Auth:** `Api.Admin.WidgetBuilder`.

Returns the global default layout (what new users see).

### `PUT /api/admin/dashboard-layout/default`

**Auth:** `Api.Admin.WidgetBuilder`.

Replace the global default layout. Existing users are unaffected —
their per-user file still wins.

---

## Health

### `GET /api/health`

**Auth:** none. Configure as a Kubernetes readiness probe / ECS
health check.

Probes backend + OAuth2 token endpoint with a 2 s per-probe timeout.
Returns 200 with `failures: []` when all clear, 503 with
`failures: ["backend", "oauth2"]` (or one of those) on any failure.
Detailed semantics in [`src/app/api/health/route.ts`](../src/app/api/health/route.ts).

```json
{
  "status": "ok",
  "failures": [],
  "timestamp": "2026-05-06T10:11:12.345Z",
  "version": "1.0.0",
  "environment": "production",
  "checks": [
    { "name": "backend", "status": "ok", "latencyMs": 28, "httpStatus": 200 },
    { "name": "oauth2",  "status": "ok", "latencyMs": 31, "httpStatus": 200 },
    { "name": "db",      "status": "skipped", "latencyMs": 0, "error": "no direct DB connection from this BFF" }
  ]
}
```

`db` is intentionally skipped — this is a BFF with no direct database
connection. The backend's own health surface owns DB visibility.

---

## Test Sentry

### `GET /api/_test/sentry?token=<SENTRY_TEST_TOKEN>`

**Auth:** shared secret in env. Verifies that an error thrown in a
server route reaches Sentry with the correlation ID, runtime tag,
release, and source-map-resolved stack frames.

Two modes via `?mode=`:

- `uncaught` (default) — throws on purpose; the route returns 500
  and `onRequestError` ships the error to Sentry.
- `captured` — uses `Sentry.captureException()` directly and returns 200.

Full procedure: [`docs/runbooks/sentry-e2e-verification.md`](runbooks/sentry-e2e-verification.md).
