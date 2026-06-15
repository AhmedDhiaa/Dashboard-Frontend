/**
 * Mock API — public entrypoint
 * ============================
 *
 * This module is the single switch that turns the whole dashboard into a
 * **standalone, backend-free** application. When `NEXT_PUBLIC_USE_MOCK_API`
 * is `"true"`, the axios instance in `src/infra/api/client.ts` swaps its
 * network adapter for {@link mockAdapter}, and the OAuth2 / NextAuth layer
 * short-circuits to a fake-but-consistent demo session.
 *
 * Nothing here runs (and nothing is imported into the hot path) unless
 * {@link IS_MOCK} is true, so production behaviour is byte-for-byte identical
 * when the flag is off/unset.
 *
 * Layout of `src/infra/api/mock/`:
 *   - index.ts          — this file: the `IS_MOCK` flag (light, no heavy re-exports).
 *   - prng.ts           — deterministic, seedable pseudo-random helpers.
 *   - seed-data.ts      — bilingual value pools (names, cities, amounts…).
 *   - field-factory.ts  — derives a demo value for any column/field path.
 *   - entity-store.ts   — per-entity in-memory CRUD store (session-persistent).
 *   - adapter.ts        — the axios adapter: routes every request to a handler.
 *   - handlers/         — bespoke handlers (auth, dashboard, maps, enums…).
 *
 * @see docs/FRONTEND-TEMPLATE.md for the full developer handoff.
 */

/**
 * Master toggle. `true` only when the env flag is the literal string `"true"`.
 * Everything mock-related is gated on this so the real backend path is never
 * touched when the flag is off.
 */
export const IS_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_API === "true"

// IMPORTANT: keep this module LIGHT. Do NOT statically re-export `adapter`,
// `entity-store`, or any handler that transitively imports the entity-config
// registry. `server.ts` imports `IS_MOCK` from here on the server-only auth
// path; a static `export ... from "./adapter"` would drag the config registry
// (and the client modules it pulls in, e.g. `useEnum` → useEffect) into the
// server graph and make Turbopack 500 every route. The adapter is attached to
// axios via a DYNAMIC import inside `client.ts`'s `IS_MOCK` branch instead.
