/**
 * In-memory fixture store for MSW handlers. Kept in its own module (no
 * `msw` import) so tests can manipulate fixtures even when MSW itself
 * isn't installed — the no-op server in `./server.ts` then gates the
 * actual interception.
 */

type EntityRecord = Record<string, unknown> & { id: string }
const fixtures: Map<string, EntityRecord[]> = new Map()
let idCounter = 1

export const mswFixtures = {
  reset(): void {
    fixtures.clear()
    idCounter = 1
  },
  set(entity: string, records: EntityRecord[]): void {
    fixtures.set(entity, records)
  },
  get(entity: string): EntityRecord[] {
    if (!fixtures.has(entity)) fixtures.set(entity, [])
    return fixtures.get(entity)!
  },
  nextId(): string {
    return `mock-${idCounter++}`
  },
}

export type { EntityRecord }
