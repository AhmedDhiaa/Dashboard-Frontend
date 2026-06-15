# Frontend Template — Standalone Mock Mode (no backend)

This copy of the Acme dashboard can run **fully standalone, with no backend at
all**. Every page — KPI cards, lists, tables, maps, detail views, create/edit
forms, card views — comes alive on **seeded mock data**, with a working
**login** and **permission-based authorization**. A frontend developer can
`npm install`, `npm run dev`, sign in with **demo / demo**, and build UI against
a realistic dataset. Later, flipping one env flag connects the real backend with
zero code changes.

---

## 1. What this template is

The app is normally the web control plane for an **ABP Framework** backend
(orders, vehicles, stock, invoices, payments, tickets, geography, reports…),
talking to it over a single Axios instance + NextAuth OAuth2.

In **mock mode** that single HTTP layer is intercepted: instead of hitting the
network, every request is answered from an in-memory, deterministically-seeded
store. Authentication and the ABP `application-configuration` (permissions) are
faked too, so login and the whole permission-gated UI work offline.

Nothing about the production code path changes — the mock is entirely gated on
one flag and is skipped (and effectively absent) when the flag is off.

---

## 2. How to run it

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>, and log in:

| Field    | Value  |
| -------- | ------ |
| Username | `demo` |
| Password | `demo` |

> Any non-empty username/password works in mock mode — `demo / demo` is just the
> documented pair. You land on the dashboard as **"Demo Admin"** with **all
> permissions granted**, so every nav item and every create/edit/delete action
> is visible.

The toggle is already set in `.env`:

```dotenv
NEXT_PUBLIC_USE_MOCK_API=true
```

---

## 3. What is mocked

| Surface | Endpoint(s) | Mock |
| --- | --- | --- |
| **Login / tokens** | OAuth2 `connect/token` (password + refresh grant) | Fake token bundle; any non-empty credentials succeed. |
| **User + permissions** | `GET /api/abp/application-configuration` | "Demo Admin", role `admin`, **all `grantedPolicies` true**. |
| **Every entity (≈54)** | `GET/POST/PUT/DELETE /api/app/<entity>[/<id>]`, `/autocomplete` | Generic ABP CRUD over a per-entity in-memory store, seeded generically from the entity name + common ABP field patterns. |
| **Dashboard KPIs** | `GET /api/app/dashboard/*-count` | Plausible counts + status/geo/financial breakdowns for cards & charts. |
| **Tracking map** | `GET /api/app/report/order-on-map` | ~60 vehicle/order markers scattered around Iraqi cities (+ heading angle). |
| **Areas (polygons)** | `GET/POST/PUT/DELETE /api/app/area` | Polygons (≥3 boundary points) per city; "add area" persists + redraws. |
| **Enums** | `GET /api/app/enum/<type>` | Bilingual enum lists (status, types, etc.). |
| **Notifications** | `GET /api/app/notification/current-list` | Seeded notification rows. |
| **Autocomplete** | `GET /api/app/<entity>/autocomplete` | Light rows from the same entity store. |

Create / update / delete **persist in memory for the browser session**: a row
you add shows up in the list, an edit sticks, a delete removes it — until you
reload (which reseeds deterministically).

> Internal Next.js API routes (dashboard-canvas layout, widgets, runtime/admin
> tooling, i18n overrides) run on the app's own server and need no backend, so
> they are **not** mocked.

---

## 4. Where the mock lives

Everything is under **`src/infra/api/mock/`**:

```
src/infra/api/mock/
├── index.ts            # IS_MOCK flag + re-exports
├── prng.ts             # deterministic seedable PRNG (no Math.random)
├── seed-data.ts        # bilingual value pools (names, cities, IQD, coords…)
├── field-factory.ts    # derive a demo value for any column/field path
├── entity-store.ts     # per-entity in-memory CRUD store (generic seeding)
├── adapter.ts          # the axios adapter: routes every request → a handler
└── handlers/
    ├── auth.ts         # OAuth2 token + application-configuration (all perms)
    ├── dashboard.ts    # dashboard count endpoints
    ├── maps.ts         # order-on-map markers + area polygons
    └── enums.ts        # bilingual enum lists
```

**The toggle.** `src/infra/api/mock/index.ts` exports:

```ts
export const IS_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_API === "true"
```

**Wiring.** In `src/infra/api/client.ts`, right after the Axios instance is
created:

```ts
if (IS_MOCK) {
  apiClient.defaults.adapter = mockAdapter // never touches the network
}
```

The two server-side auth calls that use raw `fetch` (not Axios) are short-
circuited the same way:

- `src/infra/auth/oauth2.service.ts` → `login()` / `refreshToken()` return the
  fake token bundle when `IS_MOCK`.
- `src/infra/auth/server.ts` → `fetchUserProfile()` returns the demo profile
  when `IS_MOCK`.

---

## 5. How the generic CRUD mock seeds rows

This is the part that keeps tables from being empty. The mock seeds **generically**:
it does **not** read each entity's config (`*.config.ts`). That decoupling is
deliberate — the entity-config layer transitively imports client modules
(`useEnum` → `useEffect`), and the store is reachable from the server-only auth
path, so importing configs (even dynamically) makes Turbopack 500 every route
with "useEffect in a Server Component". Seeding from the **entity name + a broad
superset of common ABP field patterns** sidesteps that entirely and keeps
`entity-store.ts` synchronous (no imports at seed time).

For each entity, `entity-store.ts` builds every row from two generic sources
(in `buildRow`):

1. **A scalar superset** (`COMMON_SCALAR_FIELDS`) — the field names ABP entities
   in this app overwhelmingly use: `id`, `name`, `displayName`, `code`,
   `number`/`documentNum`, `title`, `description`, `status` (+ a numeric status),
   `isActive`, `creationTime`/`createdAt`/`date`, `lastModificationTime`,
   `amount`/`netAmount`/`totalAmount`/`price`/`balance` (IQD), `quantity`,
   `phone`/`phoneNumber`, `email`, `address`, `latitude`/`longitude`, `color`.
2. **Nested ABP relation shapes** (`RELATION_PREFIXES`) — for a handful of common
   relation prefixes (`businessPartnerInfo`, `salesPersonalInfo`,
   `vehicleNumberCountryInfo`, `cityInfo`, `areaInfo`, `categoryInfo`,
   `brandInfo`, `unitInfo`, `currencyInfo`, `warehouseInfo`, `employeeInfo`,
   `deliveryInfo`, `amountInfo`) it attaches `{ id, entity: { id, name, code } }`
   so dotted accessors like `salesPersonalInfo.entity.name` resolve to real text.
   `amountInfo` also carries `netAmount`/`totalAmount`/`amount`, and
   `deliveryInfo` carries an `address`.

For each field path, `field-factory.ts` picks the value by:
- the column **`type`** when known (`date` → ISO date, `currency` → IQD amount,
  `badge-status` → enum id, `boolean` → bool, …), else
- the **field name** matched against ABP conventions (`name`, `reference`,
  `*amount*`, `*phone*`, `creationTime`, `*Info.entity.name` relations, …).

Because the seed is a generous superset, **most tables render something** for
whatever entity is requested. Some rows will carry fields a given entity doesn't
actually use — that's harmless (extra keys are ignored by the columns). If you
want the *exact* columns for a specific entity, refine its per-entity seed in
`entity-store.ts` (`COMMON_SCALAR_FIELDS` / `RELATION_PREFIXES` / `buildRow`) or
add richer value pools in `seed-data.ts`.

Everything is **deterministic**: values come from a seeded PRNG
(`prng.ts`, mulberry32 + string hash) keyed by `entity:rowIndex:fieldPath`, and
demo values are **picked from arrays by index/hash** — never `Math.random()`.
The same row therefore renders identically across re-renders, navigations, and
reloads. Values are realistic and bilingual-ish (Arabic names, Iraqi cities,
IQD amounts).

**Adding more:**
- A **new entity** needs nothing — the generic handler serves it from the broad
  superset automatically.
- A **new bespoke endpoint** (non-CRUD) = add one branch in
  `adapter.ts → routeRequest` and a small handler under `handlers/`.

---

## 6. How auth + authorization are mocked

`handlers/auth.ts` provides three things:

- **`mockTokenResponse()`** — an opaque fake `{ access_token, refresh_token,
  expires_in, token_type }`. NextAuth stores it in the JWT/session like a real
  one; the session exposes a stable mock `accessToken`.
- **`mockApplicationConfiguration()`** — the ABP payload with a `Demo Admin`
  `currentUser` (role `admin`) and an **all-true `grantedPolicies` map** built
  from the central `PERMISSIONS` registry plus synthesized
  `Api.<Entity>.Create|.Update|.Delete|.View` keys for every known entity. This
  flows into `PermissionContext`, so every nav item and CRUD action is allowed.
- **`mockUserProfile()`** — the slim profile the NextAuth server callback builds
  its session from.

Because the demo user has the `admin` role, the permission system's admin-bypass
also keeps everything visible — the explicit all-true map is belt-and-suspenders.

---

## 7. How the map & dashboard seeds work

- **Dashboard** (`handlers/dashboard.ts`): each `dashboard/*-count` endpoint
  returns a payload matching the exact response type the widget consumes
  (`EntityStatusStats`, geo breakdowns, financial `count`/`amount`, etc.), with
  numbers seeded per-endpoint so cards and the small charts are populated and
  stable.
- **Tracking map** (`handlers/maps.ts → orderOnMapResponse`): ~60 markers
  scattered around Iraqi city centres with a heading angle, filterable by
  status/term/paging. `addOrderPoint()` mutates the live store, so "add point"
  updates and re-renders the map.
- **Areas** (`handlers/maps.ts → areaListResponse` + `addArea`): one polygon per
  city (≥3 boundary points) returned through the `area` entity. Adding an area
  persists the new polygon in memory and the map redraws it.

---

## 8. Connecting a real backend

No code changes — just env:

1. **Turn off mock mode**

   ```dotenv
   NEXT_PUBLIC_USE_MOCK_API=false
   ```

2. **Point at the real ABP API**

   ```dotenv
   NEXT_PUBLIC_API_URL=https://your-abp-api.example.com
   API_URL=https://your-abp-api.example.com          # internal/server-side URL (optional)
   NEXT_PUBLIC_SOCKET_URL=https://your-abp-api.example.com/service-system-hub
   ```

3. **Set the real OAuth2 client + auth secret**

   ```dotenv
   NEXT_PUBLIC_CLIENT_ID=Api_App                     # your ABP OAuth2 client id
   AUTH_SECRET=<32+ char secret>                     # openssl rand -base64 32
   NEXTAUTH_URL=http://localhost:3000
   ```

4. **(Optional) Maps key** — `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=...`.

5. Restart `npm run dev`.

With `NEXT_PUBLIC_USE_MOCK_API` falsy, `apiClient` keeps its default network
adapter, the OAuth2/profile short-circuits are skipped, and the app behaves
exactly as it did against the live backend. Real credentials and real
permissions now apply.

---

## 9. Notes & limitations

- The **SignalR socket** still tries to connect (for live tracking / push
  permission updates). With no backend it just retries quietly and the app
  degrades gracefully — no functional impact in mock mode.
- Mock data is **session-scoped**: a reload reseeds deterministically (your
  in-session creates/edits/deletes reset). This is intentional for a template.
- The seed count per entity (`DEFAULT_SEED_COUNT` in `entity-store.ts`) and the
  artificial latency (150–400 ms in `adapter.ts`, so loading skeletons show) are
  easy knobs to tune.
