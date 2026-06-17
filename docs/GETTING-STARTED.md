# Getting started — a new project in minutes

This platform is a **config-driven, white-label admin engine** for an ABP backend.
Starting a new project means: rebrand it, point it at your API, and declare your
entities. No fork-and-rewrite.

---

## 1 · Run it (≈2 minutes)

```bash
npm install

# Standalone demo (no backend — seeded data, demo / demo123 login):
npm run setup

# …or wire it straight to your ABP backend:
npm run setup -- \
  --name "My Company" \
  --domain mycompany.com \
  --api-url https://api.mycompany.com \
  --client-id Api_App

npm run dev          # http://localhost:3000
```

`npm run setup` copies `.env.example` → `.env`, **generates a secure
`AUTH_SECRET`** (no `openssl` needed, Windows-friendly), and flips mock mode off
the moment you pass `--api-url`. Re-run with `--force` to regenerate.

For a real backend, also fill `OAUTH2_CLIENT_SECRET` and `OAUTH2_ISSUER` in `.env`.

## 2 · Rebrand (≈2 minutes)

Everything reads from config — no find-and-replace:

| What | Where |
| :--- | :--- |
| App name (UI, titles, emails) | `NEXT_PUBLIC_APP_NAME` |
| Primary domain (emails, image allow-list) | `NEXT_PUBLIC_BRAND_DOMAIN` |
| Logo / favicon | replace `src/app/icon.svg` |
| Colors, radius, shadows, motion | `/settings/theme` (live customizer) or pick a preset in `src/ui/theme-presets/` |
| Default language | `messages/` (`en` / `ar`, full RTL) |

## 3 · Add your first entity

Two paths — both produce the same list / detail / create / edit experience with
search, sorting, filters, permissions, and i18n:

### A · Typed config (ships in source, reviewed in a PR)

```bash
npm run plop -- entity         # scaffolds types/schema/service/config + routes + i18n keys
```

Then flesh out the generated `src/domains/<area>/<name>/<name>.config.tsx`:
`listColumns`, `formFields`, `detailSections`, Zod `createSchema`/`updateSchema`,
and `permissionKey: "Api.<Entity>"`. Regenerate the registry if needed with
`npm run init-entities`. The route page stays a 3-line shell:

```tsx
<PagePermissionGuard entityName="product" action="view">
  <ConfigDrivenListPage entityConfigName="product" />
</PagePermissionGuard>
```

See [`DEVELOPMENT.md`](DEVELOPMENT.md) for the full walkthrough, and the 8 worked
examples under `src/domains/` (`example`, `ticket`, `user`, `notification`, …).

### B · No-code builder (no deploy)

Sign in as an admin → **`/builder`** → define fields → Save. The entity is live at
`/runtime/<id>` immediately. When it stabilizes, **materialize** it into typed
source (the same files `plop` would write) from `/admin/entity-builder` — gated by
seven safety checks (see [`../ARCHITECTURE.md`](../ARCHITECTURE.md) §8).

## 4 · Dashboards, pages, permissions

- **Dashboard tiles** (KPI / chart / table / map): `/admin/widget-builder` → mount on `/dashboard/canvas`.
- **Composed pages**: `/admin/page-builder` → served at `/pages/[id]`.
- **Permissions**: page-entry guards + per-action button gating + per-field gating, all driven by the entity's `permissionKey` and the central map in `src/shared/auth/permission-keys.ts`.

## 5 · Ship it

`npm run build && npm run start`, or the multi-stage `Dockerfile`. Before you
deploy to a real backend, walk the
[**production deploy checklist**](runbooks/production-deploy-checklist.md) — the
one gotcha to remember is that `NEXT_PUBLIC_*` are baked at **build** time
(Docker `--build-arg` / CI Variables), not injected at runtime.

---

**Where to go next:** [`README.md`](../README.md) (full tour) ·
[`ARCHITECTURE.md`](../ARCHITECTURE.md) (layers + safety model) ·
[`FEATURES.md`](FEATURES.md) (capability catalog) ·
[`FRONTEND-TEMPLATE.md`](FRONTEND-TEMPLATE.md) (mock mode deep-dive).
