/**
 * Node-side MSW server for vitest. Boots in `setup.ts` and intercepts
 * every fetch made by code under test. Tests can `server.use(...)` to
 * inject per-test handlers.
 *
 * MSW is an optional devDep — `npm install` (or a CI cache hit) brings
 * it in. Until then, the suite degrades to a no-op stub so the rest of
 * the tests can still run.
 */

interface ServerLike {
  listen: (opts?: { onUnhandledRequest?: "bypass" | "warn" | "error" }) => void
  resetHandlers: () => void
  close: () => void
  use: (...handlers: unknown[]) => void
}

function createNoopServer(): ServerLike {
  return {
    listen: () => undefined,
    resetHandlers: () => undefined,
    close: () => undefined,
    use: () => undefined,
  }
}

function tryCreateRealServer(): ServerLike {
  try {
    // Resolve msw/node at runtime so a missing dep doesn't break test loading.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const node = require("msw/node") as { setupServer: (...h: unknown[]) => ServerLike }
    // Lazily require the handlers module too — it imports `msw` for `http`,
    // which lives in the same package.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { handlers } = require("./handlers") as { handlers: unknown[] }
    return node.setupServer(...handlers)
  } catch {
    return createNoopServer()
  }
}

export const server: ServerLike = tryCreateRealServer()
