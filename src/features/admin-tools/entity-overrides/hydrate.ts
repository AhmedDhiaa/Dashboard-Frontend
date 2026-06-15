/**
 * Server-side helper that loads the entity-override map from disk and
 * pushes it into the registry. Idempotent on cache hits — the storage
 * module memoises file reads, so calling this once per RootLayout SSR
 * pass adds a single Map lookup to the request hot path.
 *
 * Call this from any server entry that needs `getEntityConfig` to
 * reflect admin overrides — RootLayout for page routes, route handlers
 * that look up entity metadata without going through a layout.
 */

import "server-only"
import { setEntityOverrideMap } from "@/core/entities/registry"
import { readEntityOverrides } from "./storage"

export async function hydrateEntityOverrides(): Promise<void> {
  const map = await readEntityOverrides()
  setEntityOverrideMap(map)
}
