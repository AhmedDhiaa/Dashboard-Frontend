# Acme — Frontend Dashboard

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![Tests](https://img.shields.io/badge/tests-1500%2B%20passing-success)](#-testing)
![License](https://img.shields.io/badge/License-Proprietary-red.svg)

An enterprise, **configuration-driven** admin dashboard for the Acme fleet/logistics + delivery **ERP**. It is the web control plane for an **ABP Framework** backend (`https://api.example.com`) — orders, vehicles, stock, invoices, payments, loyalty, tickets, HR/work-sessions, geography, and reports — with live tracking over SignalR, an interactive map engine, a runtime entity/page builder, and a live theme customizer. Fully bilingual (English / العربية) with first-class RTL.

> **Scope:** the dashboard covers all 50 web-facing API modules (54 entity configs). The ~33 `Mobile*` API tags are the field-app surface and intentionally have no dashboard UI.

> 🧪 **Standalone mock mode (no backend required).** This copy ships with
> `NEXT_PUBLIC_USE_MOCK_API=true`, so every page — KPI cards, tables, maps,
> forms, card views — runs on seeded in-memory data with a working **demo /
> demo** login and full permissions. Run `npm install && npm run dev`, sign in,
> and explore. Flip the flag to `false` to connect a real backend. Full guide:
> **[docs/FRONTEND-TEMPLATE.md](docs/FRONTEND-TEMPLATE.md)**.

---

## 📑 Table of Contents
- [Tech stack](#-tech-stack)
- [Architecture](#-architecture)
- [Project structure](#-project-structure)
- [Features](#-features)
- [Getting started](#-getting-started)
- [Environment variables](#-environment-variables)
- [npm scripts](#-npm-scripts)
- [Quality gate](#-quality-gate)
- [Developing](#-developing)
- [Internationalization & theming](#-internationalization--theming)
- [Testing](#-testing)
- [Deployment](#-deployment)
- [Conventions](#-conventions)
- [Documentation](#-documentation)

---

## 🧰 Tech stack

| Area | Technology |
| :--- | :--- |
| **Framework** | Next.js `16` (App Router, `output: standalone`) · React `19` · TypeScript `6` (strict + `noUncheckedIndexedAccess`) |
| **Auth** | NextAuth `5` (beta) → ABP OAuth2 (password + refresh-token grant), JWT session (8 h) |
| **Data fetching** | TanStack Query `5` · Axios `1` (single instance w/ auth + refresh + retry interceptors) |
| **Tables** | TanStack Table `8` + TanStack Virtual (server pagination/sort/filter, virtualization, Excel export) |
| **Forms / validation** | React Hook Form `7` · Zod `4` · `@hookform/resolvers` |
| **UI / styling** | Tailwind CSS `4` (OKLCH design tokens) · Radix UI primitives · CVA · `tailwind-merge` · `lucide-react` icons · `sonner` toasts · `cmdk` command palette |
| **Charts** | Recharts `3` (theme-token driven) |
| **Realtime** | `@microsoft/signalr` `10` (lazy singleton, auto-reconnect) |
| **Maps** | `@googlemaps/js-api-loader` + marker clusterer (provider-agnostic engine) |
| **i18n** | `next-intl` `4` (path-aware lazy namespaces) · `next-themes` |
| **Drag & drop** | `@dnd-kit` (page/widget builders) |
| **Files** | `exceljs` (export) · `react-dropzone` + `react-easy-crop` (uploads) |
| **Observability** | Sentry `@sentry/nextjs` `10` + structured error reporter |
| **Testing** | Vitest `4` + Testing Library + `vitest-axe` + MSW · Playwright (RTL screenshots) |
| **Tooling** | ESLint `9` (+ custom plugin) · Prettier · Plop (scaffolding) · Husky + lint-staged + commitlint · standard-version |

**Runtime:** Node `22+`, npm `10+`.

---

## 🏗 Architecture

A strict **7-layer "clean sandwich"** — `App → Features → Domains → Core → Infra → UI → Shared` — with build-time-enforced import boundaries. Full rules and the allowed-import matrix live in **[ARCHITECTURE.md](ARCHITECTURE.md)**; they are enforced by:

- **`scripts/validate-architecture.ts`** — an import-graph analyzer (run by `npm run validate`) with a zero-exception forbidden-imports matrix, plus a rule that confines `apiClient` to `infra/` and `*.service.ts` files only.
- **`eslint-plugin-custom/`** — IDE/CI rules: feature isolation (`domain-boundary-enforcement`), `no-manual-crud-columns`, `no-manual-form-fields`, `require-entity-config`, `no-string-permission-key`, `no-physical-direction` (RTL), `no-static-heavy-import` (bundle budget), `max-lines-per-page`, plus complexity/`no-console`/hardcoded-color bans.

### Config-driven CRUD (the core idea)
One typed `EntityConfig` object is the single source of truth for an entity. It declares the `service`, `listColumns`, `detailSections`, `formFields` + Zod `createSchema`/`updateSchema`, `translations`, `features` flags, `permissionKey`, and routing. Generic renderers in `core/crud` (`ConfigDrivenListPage` / `DetailPage` / `EditPage`) consume it, so a route page is a ~3-line shell:

```tsx
// src/app/(dashboard)/brands/page.tsx
<PagePermissionGuard entityName="brand" action="view">
  <ConfigDrivenListPage entityConfigName="brand" />
</PagePermissionGuard>
```

Entity configs are **lazily registered** and validated at load. The registry file `src/core/entities/configs/init.ts` is **auto-generated** by `scripts/generate-entity-init.ts` (never hand-edit it).

### Static vs runtime entities (dual-track)
- **Static** — typed `*.config.tsx` in `src/domains`, registered at build, served at `/<plural>`.
- **Runtime** — JSON schema created in the `/builder` UI (no deploy), served by `runtime/[entity]`. A gated **"materialize"** pipeline can promote a runtime entity into typed source, protected by **seven safety gates** (env kill-switch, CI scan, permission, rate-limit, safe-path allowlist, sandbox `tsc`, backup + audit).

---

## 📁 Project structure

```text
src/
├── app/                     # Next.js App Router
│   ├── (dashboard)/         # all authenticated dashboard routes (thin shells)
│   ├── auth/                # /auth/login, session-expired
│   ├── api/                 # route handlers: runtime, admin, i18n, theme, health
│   └── 403/                 # forbidden page
├── core/                    # framework-agnostic engine
│   ├── auth/                # PermissionContext, PagePermissionGuard, guards
│   ├── crud/                # ConfigDriven{List,Detail,Edit}Page + CRUDListPage
│   ├── data-table/          # table column factory + helpers
│   ├── entities/            # EntityConfig types, registry, generated init.ts
│   ├── enums/               # ABP enum loader (/api/app/enum/*)
│   └── forms/               # schema-driven form renderer
├── domains/                 # 14 domain groups · 54 entity configs (config+service+schema+types)
│   ├── business/            #   order, business-partner
│   ├── inventory/           #   item, brand, category, unit, price-list, stock-*, warehouse, …
│   ├── finance/             #   payment, receive, currency, wallet-top-up
│   ├── sales-invoice/  purchase-invoice/
│   ├── fleet/  operations/  #   maintenance, vehicle, vehicle-park
│   ├── geography/           #   country, city, area
│   ├── employee/            #   employee, work-session, settlement, reports
│   ├── tickets/  notifications/  documents/  system/  user/
├── features/                # 12 cross-entity feature modules (isolated)
│   ├── dashboard/  kpis/  reports/  orders/  work-sessions/
│   ├── maps/  tracking/     #   provider-agnostic map engine + live tracking
│   ├── runtime-builder/  admin-tools/   #   entity-builder, page-builder, widget-builder, git-bridge
│   ├── chat/  navigation/  settings/
├── infra/                   # external adapters
│   ├── api/                 # axios client, BaseCRUDService, QueryProvider
│   ├── auth/                # NextAuth config, ABP OAuth2 service, app-config
│   ├── socket/              # SignalR singleton + lifecycle + SocketProvider
│   ├── observability/       # error reporter
│   └── ratelimit/           # per-IP limiter (Redis-backed)
├── ui/                      # design system & renderers
│   ├── design-system/       #   Radix + CVA primitives (token-only, no hardcoded colors)
│   ├── data-table/          #   TanStack table orchestrator
│   ├── layout/              #   DashboardLayout, Sidebar, Header (RTL-aware)
│   ├── theme/  theme-presets/  #   live ThemeCustomizer + 5 presets
│   ├── application/  skeletons/
├── shared/                  # config, hooks, logger, safeguards, types, utils, widgets
└── i18n/                    # next-intl request config + path-aware namespace loader
```

`server.ts` is a custom IIS/Azure-aware HTTP server used for both `dev` and `start`; it validates env at startup and sanitizes malformed/host-polluted URLs.

---

## ✨ Features

- **Config-driven CRUD** for 54 entities (list / detail / edit / create) with server search (`Term`/`Filter`), sorting, multi-select filters, optimistic delete + undo.
- **Orders workflow** — create → assign → schedule → track → cancel → archive.
- **Live tracking & maps** — provider-agnostic map engine with marker clustering; real-time driver/ticket updates over a single auto-reconnecting SignalR connection.
- **Dashboard & KPIs** — count tiles + order-on-map KPI.
- **Reports** — leave/stock/sales-invoice/employee report surfaces (filter form + Excel export).
- **Runtime builder** — admins build ad-hoc CRUD entities and compose pages (`/builder`, `/admin/page-builder` → `/pages/[id]`) without a deploy, with an optional gated "materialize to source" pipeline.
- **Permissions** — page-entry guards + per-action button gating + per-column/field gating; role/user permission-grant editors.
- **Live theme customizer** — edit colors, radius, shadow, glass, spacing, motion, and per-component styles at runtime (persisted, versioned, export/import JSON); 5 built-in presets.
- **i18n + RTL** — English/Arabic with perfect key parity and full RTL via logical CSS properties.

---

## 🚀 Getting started

**Prerequisites:** Node `22+`, npm `10+`.

```bash
# 1. install
npm install

# 2. environment (copies .env.example if missing)
setup-env.bat        # Windows
./setup-env.sh       # macOS / Linux
#   then fill in NEXT_PUBLIC_API_URL, AUTH_SECRET/NEXTAUTH_SECRET (≥32 chars),
#   OAuth2 client id/secret/issuer (see below)

# 3. generate the entity registry
npm run init-entities

# 4. run
npm run dev          # custom tsx server.ts (Turbopack) on http://localhost:3000
# npm run dev:next   # alternative: plain next dev --turbopack
```

---

## 🔐 Environment variables

Validated by `src/shared/config/env.ts` (soft warning at load; **strict at server start** — production refuses to boot on a missing API URL or a short secret).

| Variable | Required | Description |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | ✅ | Public ABP backend URL (browser calls) |
| `API_URL` | prod | **Private** backend URL for server-side calls (avoids hairpin-NAT in Docker/IIS) |
| `AUTH_SECRET` / `NEXTAUTH_SECRET` | ✅ | NextAuth signing key, ≥32 chars (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | prod | Canonical auth URL · `AUTH_TRUST_HOST=true` for proxy setups |
| `NEXT_PUBLIC_CLIENT_ID`, `OAUTH2_CLIENT_SECRET`, `OAUTH2_ISSUER` | ✅ | ABP OAuth2 client credentials |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | maps | Google Maps key (restrict by HTTP referrer) |
| `NEXT_PUBLIC_SOCKET_URL` | realtime | SignalR hub URL (defaults to API URL) |
| `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_DSN` (+ `SENTRY_*`) | optional | Observability; traces sampled at 10% by default |
| `NEXT_PUBLIC_ENABLE_CHAT`, `NEXT_PUBLIC_ENABLE_MAPS` | optional | Feature flags |
| `NEXT_PUBLIC_RUNTIME_BACKEND` | optional | `server` (shared, default) or `local` (per-browser localStorage) |
| `APP_ALLOW_RUNTIME_CODEGEN` | **dev only** | Arms the materialize file-write pipeline — **keep OFF in production** |

`.env` is git-ignored; never commit real secrets. See `.env.example` for the full annotated list.

---

## 📜 npm scripts

| Script | Purpose |
| :--- | :--- |
| `dev` / `dev:next` | Dev server (custom `tsx server.ts` / `next dev --turbopack`) |
| `build` | `init-entities → quality → next build --webpack → leaked-secret scan` (standalone output) |
| `start` | Production server (`node .next/standalone/server.js`) |
| `init-entities` | Regenerate `src/core/entities/configs/init.ts` from `src/domains` |
| `validate` | `init-entities` + architecture boundary validator |
| `type-check` / `lint` / `lint:fix` | `tsc --noEmit` / ESLint (`--max-warnings 0`) / autofix |
| `quality` | The full gate (see below) |
| `test` / `test:ui` / `test:coverage` | Vitest |
| `test:e2e:rtl` | Playwright RTL screenshot suite |
| `check:bundle-budget` | Per-route gzip budgets (`bundle-budgets.json`) |
| `check:dead-code` | Knip unused-export/file scan |
| `analyze` | Bundle analyzer (`ANALYZE=true` build) |
| `plop` | Scaffold an entity / feature / component / hook |
| `release[:major\|minor\|patch]` | standard-version |

---

## ✅ Quality gate

`npm run quality` runs (each must pass; lint is `--max-warnings 0`):

```
type-check → lint → validate (architecture)
  → check:next-auth-pin    → check:leaked-secrets   → check:codegen-flag
  → check:i18n-parity      → check:i18n-usage       → check:rsc-boundaries
  → check:swagger-drift    → check:color-fn
```

- **swagger-drift** — fails if a hand-written service path is absent from the committed API spec snapshot.
- **color-fn** — fails on `hsl()/rgb()` wrapping an OKLCH token var (`hsl(var(--x))` is invalid → transparent).
- **i18n-parity / i18n-usage** — en/ar key parity + no missing `t()` keys.
- **rsc-boundaries / codegen-flag / leaked-secrets / next-auth-pin** — server/client boundary safety, codegen kill-switch, secret scan, pinned auth version.

`build` additionally runs `check:bundle-budget`. Husky + lint-staged run lint/format on commit; commits follow Conventional Commits.

---

## 🧑‍💻 Developing

**Add a CRUD entity** — `npm run plop -- entity`. Plop scaffolds `src/domains/<area>/<name>/{types,schema,service,config}.ts`, three route shells, i18n keys, regenerates the registry, and lint-fixes. Then flesh out the config (`listColumns`, `formFields`, `detailSections`, Zod schemas) and set `permissionKey: "Api.<Entity>"`. **Never** hand-write CRUD columns/form fields in a page — lint enforces the `ConfigDriven*` components.

**Add a feature** — `npm run plop -- feature` (also registers it for feature-isolation enforcement). A feature may import `core/ui/infra/shared` but **not** `@/app` or a sibling feature.

**Layer rules** — `shared` imports nothing app-internal; `ui` can't reach `infra/domains/features`; only `infra` files and `*.service.ts` may import `apiClient` (everything else goes through a service). ABP list params: `Term`/`Filter` (search), `Sorting`, `SkipCount`, `MaxResultCount`. Fully-qualified permission keys live in `src/shared/auth/permission-keys.ts`. Heavy client libs (recharts/exceljs/framer-motion/jspdf/maps) must be dynamically imported.

Always finish with `npm run quality` green.

---

## 🌐 Internationalization & theming

- **i18n** — `next-intl` with **path-aware lazy namespace loading** (a route loads only the namespaces it needs). 18 namespaces, **perfect en/ar key parity**, admin runtime overrides under `messages/_overrides/`. Use `useT("ns")` / `useLocale()` from `@/shared/config`; use logical CSS (`start`/`end`, `ms-`/`me-`) and `useLocale().isRTL`.
- **Theming** — OKLCH design tokens in `globals.css` (light/dark), **zero hardcoded colors** (lint-enforced). The live **ThemeCustomizer** edits brand/semantic colors, radius, shadow, glass, spacing, motion, and per-component styles (radius/height/size/padding/weight/color) — applied instantly as CSS variables, persisted to `localStorage`, versioned, export/import as JSON. 5 presets ship in `ui/theme-presets`.

---

## 🧪 Testing

- **Unit/integration** — Vitest + Testing Library + `vitest-axe` (a11y) + MSW. **1,500+ tests** across 144 files. `npm test` / `npm run test:coverage`.
- **E2E** — Playwright RTL screenshot regression (`npm run test:e2e:rtl`).

---

## 🚢 Deployment

`output: standalone` → `node .next/standalone/server.js`.

1. **Node** — `npm run build && npm run start` (use PM2 or similar).
2. **IIS + iisnode** — `server.ts` handles `IISNODE_VERSION`/pipe ports; point `web.config` at the transpiled `server.js`; set `NODE_ENV=production`.
3. **Docker** — `node:22-alpine`; set `API_URL` to the internal service name to avoid hairpin-NAT during SSR.

In production, startup safeguards refuse to boot if the runtime-codegen flag is armed without the explicit prod override. `/api/health` reports backend connectivity.

---

## 📐 Conventions

- **Config over code** — entities are configs, not hand-written pages.
- **Strict layering** — enforced at build; no exceptions baseline.
- **Tokens only** — no hardcoded colors; reference `var(--token)` (OKLCH), never `hsl(var(--token))`.
- **i18n parity** — every user-facing string is translated in both `en` and `ar`.
- **Generated registry** — regenerate `init.ts` via `npm run init-entities`; never hand-edit.
- **Quality-green = done** — `npm run quality` must pass before any change is complete.

---

## 📚 Documentation

- **[docs/FEATURES.md](docs/FEATURES.md)** — **feature catalog with examples**: every capability (CRUD engine, builders, theme, i18n, maps, mock mode, security…) with a concrete usage example and where it lives.
- **[docs/FRONTEND-TEMPLATE.md](docs/FRONTEND-TEMPLATE.md)** — **run this app with NO backend**: standalone mock mode, demo login, what's mocked, where it lives, and how to connect a real backend.
- **[docs/SYSTEM.md](docs/SYSTEM.md)** — **the source of truth**: a verified, deep
  reference for the entire system (CRUD engine, builder platform, i18n, security,
  performance, deploy, and current state). Start here when README isn't enough.
- **[ARCHITECTURE.md](ARCHITECTURE.md)** — layer matrix, entity system, dual-track static/runtime, codegen safety gates, bundle budgets.
- **[CONTRIBUTING.md](CONTRIBUTING.md)** — standards, quality suite, PR workflow.
- **[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)** — adding entities & features.
- **[docs/API-REFERENCE.md](docs/API-REFERENCE.md)** · **[docs/ADMIN-TOOLS.md](docs/ADMIN-TOOLS.md)** · **[docs/runbooks/](docs/runbooks)**.
- **Page Builder** — [user guide](docs/page-builder/user-guide.md) (EN+AR) · [architecture](docs/page-builder/architecture.md) · [extending](docs/page-builder/extending.md) · [schema](docs/page-builder/schema.md).
- **[CHANGELOG.md](CHANGELOG.md)**.

---
© 2026 Acme IQ. All rights reserved. Proprietary and Confidential.
