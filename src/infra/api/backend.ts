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
 * NOTE: mock mode is currently served one layer lower — the axios adapter swap
 * in `client.ts` (`IS_MOCK`) answers every `apiClient` call from seeded data, so
 * each ABP adapter transparently works in mock mode too. A future step can move
 * mock up to a port-level adapter selected right here. See
 * `docs/BACKEND-ADAPTER-PLAN.md` (phase 6) and `docs/BACKEND-ADAPTER.md`.
 */

import type { AuthPort, EnumPort, EntityService, BackendKind } from "@/shared/ports/backend"
import { abpAuthPort } from "./adapters/abp/auth.adapter"
import { abpEnumPort } from "./adapters/abp/enum.adapter"
import { createCRUDService } from "./crud-service"

/** Active backend. Static for now (only ABP exists); env-switch this when a second adapter lands. */
export const activeBackend: BackendKind = "abp"

export const authPort: AuthPort = abpAuthPort
export const enumPort: EnumPort = abpEnumPort

/**
 * Create a port-typed CRUD service for a logical resource. New code should use
 * this instead of `BaseCRUDService`/`createCRUDService` directly, so the backend
 * stays swappable. The ABP adapter resolves the resource to an `/api/app/*` (or
 * framework) URL and maps the envelope; a different backend implements
 * `EntityService<T>` its own way.
 */
export function entity<TEntity extends { id: string | number }, TCreate = Partial<TEntity>, TUpdate = Partial<TEntity>>(
  resource: string,
): EntityService<TEntity, TCreate, TUpdate> {
  return createCRUDService<TEntity, TCreate, TUpdate>(resource)
}
