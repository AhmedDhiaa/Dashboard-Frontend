/**
 * Permission gates for runtime-builder routes. Thin wrappers around the
 * shared helper so call sites read like intent.
 */

import { requireAnyPermission, requirePermission } from "@/app/api/_lib/require-permission"
import { RUNTIME_MANAGE_PERMISSION, RUNTIME_WRITE_PERMISSION } from "./constants"

/** Required to mutate the schema (entities, pages, dashboards). */
export const requireRuntimeManager = () => requirePermission(RUNTIME_MANAGE_PERMISSION)

/**
 * Required to mutate records. Looser than manager — a CSR can add a customer
 * row without being able to redefine the customer schema.
 */
export const requireRuntimeWriter = () => requirePermission(RUNTIME_WRITE_PERMISSION)

/**
 * Required to READ records. Either grant suffices: the schema *manager* (who
 * can view the runtime data page, gated on RUNTIME_MANAGE) and the data
 * *writer* (who can already mutate records) should both be able to read. Plain
 * authenticated users must not — runtime entities can hold tenant business
 * records (customers, inventory).
 */
export const requireRuntimeReader = () =>
  requireAnyPermission([RUNTIME_WRITE_PERMISSION, RUNTIME_MANAGE_PERMISSION])
