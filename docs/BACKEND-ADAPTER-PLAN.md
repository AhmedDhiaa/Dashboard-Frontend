# Backend-Adapter Decoupling — Plan

**Goal:** put every ABP-specific assumption behind a single **backend port** so a
different backend can be supported by writing one adapter, without touching
`features/`, `domains/`, `ui/`, or `core/`. The current ABP integration becomes the
**default adapter**; the existing mock layer becomes a **second adapter** of the same
port. Behavior stays byte-identical throughout.

This document is the map + the phased plan. It is built from a full read-only audit of
the codebase.

---

## 1. Where ABP coupling lives (the map)

| Area | Files (key) | The ABP assumption | Consumers |
| --- | --- | --- | --- |
| **Auth / OAuth2** | `infra/auth/oauth2.service.ts`, `infra/auth/server.ts`, `infra/auth/account.service.ts` | `/connect/token` password+refresh grant; `client_id`/scope; `/api/abp/application-configuration` for profile + `auth.grantedPolicies`; `{error,error_description}`; `RefreshAccessTokenError` | NextAuth `authorize`/`jwt`/`session`, login/reset pages |
| **Transport + envelope + CRUD** | `infra/api/{client,crud-service,error-handling,errors}.ts` | axios; list envelope `{ items, totalCount }`; `/api/app/{name}` path rule; params `skipCount`/`maxResultCount`/`Sorting`/`Term`\|`Filter`; ABP error shapes | `core/entities/types.ts` (spine), `CRUDListPage`, `DataTable`, every `*.service.ts`, `NotificationBell`, `RoleMembersList`, page-builder blocks |
| **Enums** | `core/enums/enum.service.ts:11-19` | `GET /api/app/enum/<type>` → bare `EnumValue[]` | `EnumSelectField`, `EnumBadge`, `FilterDrawer`, table/detail renderers |
| **Permissions + settings** | `infra/auth/application-config.service.ts`, `infra/auth/server.ts:fetchUserProfile`, `app/api/_lib/require-permission.ts` | `/api/abp/application-configuration` → `grantedPolicies`/`setting.values`/`features.values`; flat `Module.Action` keys; admin = role `"admin"` | `useAppConfig`, `PermissionContext`, `usePermissions`, server permission gate |
| **Mock layer** | `infra/api/mock/**` | swaps the axios adapter (`client.ts:142-154`) and returns ABP-shaped data | everything, transparently, when `NEXT_PUBLIC_USE_MOCK_API=true` |
| **ABP-bound gates** | `scripts/check-swagger-drift.mjs` (+ `swagger-paths.json`), `scripts/validate-architecture.ts` (apiClient rule) | `/api/app/*` path convention; ABP swagger snapshot | CI `quality` gate |

**Highest-leverage point:** `core/entities/types.ts` imports `CRUDListParams` from
`@/infra/api` and types every entity service as `Promise<{ items; totalCount }>`. Fixing
this one type + the adapter mapping resolves most downstream envelope leaks.

---

## 2. Target architecture

```
src/shared/ports/backend.ts        ← the PORT: neutral interfaces + DTOs (no transport)
        ▲ imported by core / domains / features / ui / app
        │
src/infra/api/adapters/abp/**      ← ABP adapter (default): axios, /api/app, {items,totalCount}
src/infra/api/adapters/mock/**     ← Mock adapter: today's mock handlers, same port
        │
src/infra/api/backend.ts           ← composition root: selects adapter (abp | mock)
```

- **Port lives in `src/shared/`** — the only layer every consumer may import (`ui`
  cannot import `infra`). Pure types/interfaces, zero transport dependency.
- **All ABP names** (`/api/app`, `{items,totalCount}`, `skipCount`/`Sorting`/`Term`,
  `grantedPolicies`, `/connect/token`) live **only** in the ABP adapter.
- **Selection** is one composition root; `NEXT_PUBLIC_USE_MOCK_API` chooses the mock
  adapter — generalizing today's `IS_MOCK` axios swap.

### Port surface (summary)
- **CRUD/transport:** `list(resource, ListParams) → Page<T>`, `get/create/update/delete`,
  `autocomplete`, a neutral `request()`, and the existing `AppError` hierarchy (already
  transport-free in `shared/types/errors.ts`) as the error contract.
- **Auth:** `login`, `refresh`, `getProfile`, `requestPasswordReset`, `resetPassword`,
  `buildAuthHeaders`, typed errors (`InvalidCredentials|ServerError|SessionExpired|Forbidden`).
- **Config/permissions:** `getApplicationConfig() → { permissions[], settings, features, roles, user }`.
- **Enums:** `getEnumValues(type) → EnumValue[]`.

---

## 3. Phased migration (ordered by risk; verify after each)

> Each phase ends green: `npm run quality` + `npx vitest run` + `npx next build --webpack`,
> and **mock mode still boots**. Stop at any green checkpoint.

- **Phase 0 — Foundation (this change).** Create `src/shared/ports/backend.ts` with the
  neutral interfaces + DTOs. No consumer migration yet → non-breaking. Write this plan.
- **Phase 1 — Envelope + list types.** Move `ListParams` + `Page<T>` into the port;
  re-export from `@/infra/api` for compat; re-point `core/entities/types.ts` and
  `CRUDListPage`/`DataTable` to the port. ABP adapter maps `{items,totalCount}`↔`Page<T>`.
- **Phase 2 — CRUD service → port.** `BaseCRUDService` + `/api/app` normalization +
  param encoding move into `adapters/abp`; `core`/`domains` depend on an `EntityService<T>`
  port interface. Error parsing moves adapter-side (consumers already use `AppError`).
- **Phase 3 — Enums.** `enum.service.ts:11-19` becomes the ABP enum adapter behind an
  `EnumPort`; provider/hooks unchanged.
- **Phase 4 — Permissions/config.** `application-config.service.ts` + `fetchUserProfile`
  behind a `ConfigPort.getApplicationConfig()`; `useAppConfig`/`PermissionContext` already
  consume a normalized view.
- **Phase 5 — Auth (riskiest, last).** `login`/`refresh`/`getProfile`/account ops behind
  an `AuthPort`; NextAuth keeps owning the session, calling the port for the 5 ABP sites.
- **Phase 6 — Mock as a port adapter + gate scoping.** Re-wrap the mock handlers to
  implement the port directly. Retarget `check-swagger-drift` and the `validate-architecture`
  apiClient rule to `infra/api/adapters/abp/**` so a non-ABP adapter doesn't trip them.
- **Phase 7 — Prove the seam.** Add a stub second adapter that the composition root can
  select without editing any feature code; write `docs/BACKEND-ADAPTER.md` (how to add a backend).

---

## 4. Acceptance (final, across all phases)

- `features/domains/ui/core` contain **zero** direct ABP/axios/`/connect/token`/
  `{items,totalCount}`/`skipCount` references (all via the port) — provable by grep.
- ABP adapter: all 11 gates + ~1613 tests + build green.
- Mock mode boots + works through the mock adapter (no backend).
- `check-swagger-drift` scoped to the ABP adapter.
- A second stub adapter registers without touching feature code.

---

## 5. Status

- **Phase 0: DONE** — port scaffold (`src/shared/ports/backend.ts`) + this plan. Green,
  non-breaking (no consumers migrated yet).
- Phases 1–7: pending, to be done incrementally with per-phase verification.
