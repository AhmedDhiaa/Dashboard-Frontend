# Adding a backend

This app talks to its backend through a small set of **ports** — TypeScript
interfaces in [`src/shared/ports/backend.ts`](../src/shared/ports/backend.ts).
The current ABP integration is just the **default adapter**. To support a
different backend you implement the ports in a new adapter and select it in one
place. App code (services, hooks, NextAuth) never names a backend.

See [`BACKEND-ADAPTER-PLAN.md`](BACKEND-ADAPTER-PLAN.md) for the full migration map.

## The pieces

| Layer | Where | Role |
| --- | --- | --- |
| **Ports** | `src/shared/ports/backend.ts` | Neutral interfaces + DTOs (`Page<T>`, `CRUDListParams`, `AuthPort`, `EnumPort`, `ConfigPort`, …). No transport. |
| **Adapters** | `src/infra/api/adapters/<backend>/` | Concrete implementations. ABP lives in `adapters/abp/`; a **reference REST adapter** lives in `adapters/rest/`; mock in `adapters/mock/`. |
| **Composition root** | `src/infra/api/backend.ts` | Selects the active adapter and exports the ports (`authPort`, `enumPort`, `configPort`, `entity`). The only place a backend is named. |

## Reference adapter: REST (`adapters/rest/`)

A complete, contract-tested second backend ships as proof the seam is truly
backend-agnostic. It targets a conventional JSON REST API whose conventions are
nothing like ABP's, yet plugs into the **same ports**:

| Concern | ABP | REST reference |
| --- | --- | --- |
| Auth | OAuth2 `POST /connect/token` (grant) | `POST /auth/login` → `{ token, refreshToken }` |
| List | `?skipCount&maxResultCount&Sorting&Term` → `{ items, totalCount }` | `?_page&_limit&_sort&q` → `{ data, total }` |
| Resource URL | `/api/app/{name}` | `/{resource}` |
| Config | `/api/abp/application-configuration` (flatten `grantedPolicies`) | `/me` (already-flat `permissions`) |

App code (`features/`, `domains/`, `ui/`, hooks, NextAuth) sees none of this. The
REST adapter passes the **same** `runAuthPortContract` / `runEnumPortContract`
suites as ABP and mock (`adapters/rest/__tests__/`).

## How to add your own

1. **Implement the ports** in `src/infra/api/adapters/<backend>/` — copy
   `adapters/rest/` as the template. Map your backend's shapes to the neutral
   DTOs here; this is the *only* place that knows your URLs and payloads.
2. **Select it** in `src/infra/api/backend.ts` (already wired for `rest`):
   ```ts
   export const activeBackend = IS_MOCK ? "mock"
     : process.env.NEXT_PUBLIC_BACKEND === "rest" ? "rest" : "abp"
   ```
   Set `NEXT_PUBLIC_BACKEND=rest` (+ `NEXT_PUBLIC_REST_API_URL`) to run on it.
3. **Conformance-test it** by calling the shared contract suites from
   `@/shared/test-utils/port-contracts` against your adapter.
4. **Nothing else changes.** App code already depends on the ports via the
   composition root.

## Mock mode

`NEXT_PUBLIC_USE_MOCK_API=true` is served one layer below the ports today: the
axios adapter is swapped in [`client.ts`](../src/infra/api/client.ts), so every
`apiClient` call (and therefore every ABP adapter) is answered from seeded
in-memory data with no backend. A future step can promote mock to a port-level
adapter selected in the composition root alongside the others.

## What's still ABP-coupled (migration status)

Behind the ports now:

- **CRUD** — `EntityService<T>` (`BaseCRUDService` implements it; create services
  via the composition root's `entity()` factory). All ABP wire conventions live
  in `adapters/abp/`: `/api/app/{name}` resolution + `skipCount`/`Sorting`/
  `Term`|`Filter` encoding (`crud-params.ts`) and sub-resource/upload helpers
  (`crud-extras.ts`).
- **Identity** — role/user framework endpoints (`/api/identity/*`) in
  `adapters/abp/identity.adapter.ts`; the domain services are thin façades.
- **Config / permissions** — `ConfigPort.getApplicationConfig()` returns the
  neutral `ApplicationConfig`; the `grantedPolicies`→permissions + settings/
  features/roles/user normalization lives in `adapters/abp/config-normalize.ts`
  and is shared by `useAppConfig` and the NextAuth server callback.
- **Auth** — OAuth2 token grants **and** self-service account recovery
  (`/api/account/*`) behind `AuthPort` (`auth.adapter.ts` + `account.adapter.ts`).
- **Enums** — `EnumPort` (`enum.adapter.ts`).
- **Mock** — `mockAuthPort`/`mockEnumPort` are selected at the composition root
  when `NEXT_PUBLIC_USE_MOCK_API` is on. CRUD + the cached raw app-config fetch
  intentionally stay on the lower axios-adapter mock (heavy entity store + raw
  envelope — see the composition-root note).

Guardrails: `check-swagger-drift` now validates the ABP paths in both
`src/domains/**/*.service.ts` and `src/infra/api/adapters/abp/**`. The
`validate-architecture` rule still confines `apiClient` to `infra/` + service
files; the remaining non-adapter `apiClient` users are generic infrastructure
(entity-autocomplete, the page-builder data services) plus `security.service`
(permission-management), which a later pass can fold into adapters.
