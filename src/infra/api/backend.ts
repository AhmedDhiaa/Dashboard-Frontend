/**
 * Backend composition root.
 *
 * The single place that selects which backend implementation the app uses. App
 * code (services, hooks, NextAuth) imports the PORTS from here — never a
 * specific adapter — so swapping backends is a one-file change: implement the
 * `@/shared/ports/backend` interfaces in a new adapter and select it below.
 *
 * Today only the ABP adapter exists, so selection is static. When a second
 * backend is added, switch on an env flag (e.g. `NEXT_PUBLIC_BACKEND`) here and
 * nowhere else.
 *
 * Mock mode (`NEXT_PUBLIC_USE_MOCK_API`) is selected RIGHT HERE for the auth and
 * enum ports — `mockAuthPort`/`mockEnumPort` serve seeded data with no network.
 * The CRUD `entity()` factory and the cached raw application-config fetch stay on
 * the lower axios-adapter mock (`client.ts` `IS_MOCK`): the entity store is heavy
 * and must not enter this composition root's server graph, and the config cache
 * needs the raw ABP envelope. See `docs/BACKEND-ADAPTER.md`.
 */

import type { AuthPort, ConfigPort, EnumPort, EntityService, BackendKind } from "@/shared/ports/backend"
import { abpAuthPort } from "./adapters/abp/auth.adapter"
import { abpEnumPort } from "./adapters/abp/enum.adapter"
import { abpConfigPort } from "./adapters/abp/config.adapter"
import { mockAuthPort } from "./adapters/mock/auth.adapter"
import { mockEnumPort } from "./adapters/mock/enum.adapter"
import { restAuthPort } from "./adapters/rest/auth.adapter"
import { restEnumPort } from "./adapters/rest/enum.adapter"
import { restConfigPort } from "./adapters/rest/config.adapter"
import { restEntity } from "./adapters/rest/crud.adapter"
import { createCRUDService } from "./crud-service"
import { IS_MOCK } from "./mock"

/**
 * Active backend. `mock` (standalone demo) wins when on; otherwise `NEXT_PUBLIC_BACKEND`
 * selects the real backend — `abp` (default) or the reference `rest` adapter. This
 * env flag is read HERE and nowhere else.
 */
export const activeBackend: BackendKind = IS_MOCK ? "mock" : process.env.NEXT_PUBLIC_BACKEND === "rest" ? "rest" : "abp"

export const authPort: AuthPort =
  activeBackend === "mock" ? mockAuthPort : activeBackend === "rest" ? restAuthPort : abpAuthPort

export const enumPort: EnumPort =
  activeBackend === "mock" ? mockEnumPort : activeBackend === "rest" ? restEnumPort : abpEnumPort

export const configPort: ConfigPort = activeBackend === "rest" ? restConfigPort : abpConfigPort

/**
 * Create a port-typed CRUD service for a logical resource. New code should use
 * this instead of `BaseCRUDService`/`createCRUDService` directly, so the backend
 * stays swappable. ABP resolves the resource to an `/api/app/*` URL with
 * `skipCount`/`Sorting`/`Term` encoding; the reference REST adapter uses
 * `/{resource}` with `_page`/`_limit`/`q` — and consumers see neither.
 */
export function entity<TEntity extends { id: string | number }, TCreate = Partial<TEntity>, TUpdate = Partial<TEntity>>(
  resource: string,
): EntityService<TEntity, TCreate, TUpdate> {
  return activeBackend === "rest"
    ? restEntity<TEntity, TCreate, TUpdate>(resource)
    : createCRUDService<TEntity, TCreate, TUpdate>(resource)
}
