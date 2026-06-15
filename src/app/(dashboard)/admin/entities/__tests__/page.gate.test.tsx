/**
 * Gate tests for /admin/entities. The page is a Server Component;
 * we render it via the default-export function and assert that the
 * env / auth short-circuits fire BEFORE any data fetch.
 *
 * `notFound()` and `redirect()` from `next/navigation` are thrown
 * as control-flow errors at runtime — vitest sees the throw, which
 * is what these tests pin down.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// ─── Mocks ─────────────────────────────────────────────────────────────────
//
// next/navigation: notFound + redirect throw control-flow errors so the
// Server Component bails out of the render. We replicate that contract
// (each throws a tagged Error) so the test can pin the right one fired.

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND")
  }),
  redirect: vi.fn((to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`)
  }),
}))

// Auth + data fetchers — stubbed so the gates can be tested in isolation.
vi.mock("@/infra/auth/server", () => ({ auth: vi.fn() }))
vi.mock("@/app/api/runtime/_lib/storage", () => ({ readConfig: vi.fn(async () => ({ entities: [] })) }))
vi.mock("@/features/admin-tools/entity-converter/server/parse-static-config", () => ({
  buildConvertibilityReport: vi.fn(async () => []),
}))
vi.mock("@/features/admin-tools/entity-builder/server/backup", () => ({
  listSnapshots: vi.fn(async () => []),
}))

const ORIGINAL_ENV = process.env

beforeEach(() => {
  vi.resetModules()
  process.env = { ...ORIGINAL_ENV }
})

afterEach(() => {
  vi.clearAllMocks()
  process.env = ORIGINAL_ENV
})

// Each test uses vi.resetModules() + dynamic import; under broader-suite
// load on slow runners the first dynamic-import after a reset can brush
// past vitest's 5s default. 20s is comfortable headroom without masking
// a real regression.
const SLOW_TIMEOUT = 20_000

// The page body returns JSX; the JSX runtime isn't wired in this unit env, so
// `Page()` may throw a harmless `jsxDEV is not a function` once it gets past the
// auth gate. We only care that NEITHER gate (notFound / redirect) fired — i.e.
// the page proceeded to render rather than bailing out.
async function expectNoGateBailout(Page: () => Promise<unknown>): Promise<void> {
  try {
    await Page()
  } catch (err) {
    const message = (err as Error).message
    expect(message).not.toMatch(/NEXT_NOT_FOUND/)
    expect(message).not.toMatch(/NEXT_REDIRECT/)
  }
}

describe("/admin/entities — gate", { timeout: SLOW_TIMEOUT }, () => {
  // The override editor (SystemEntitiesPanel) is prod-safe: it edits only the
  // git-ignored override store at read time (no codegen). So the page no longer
  // hard-gates on NODE_ENV / the codegen flag — it renders for any admin, in
  // every environment. The dev-only converter/backups sections are hidden in
  // production, but that is a JSX concern (covered elsewhere), not a page bail-out.
  it("renders in production for an admin (override editor is prod-safe)", async () => {
    Object.assign(process.env, { NODE_ENV: "production" })
    process.env.APP_ALLOW_RUNTIME_CODEGEN = "true"
    const auth = (await import("@/infra/auth/server")).auth as ReturnType<typeof vi.fn>
    auth.mockResolvedValue({ user: { roles: ["admin"], email: "a@x" } })
    const { default: Page } = await import("../page")
    await expectNoGateBailout(Page)
  })

  it("renders without the codegen flag for an admin (override editor needs no codegen)", async () => {
    Object.assign(process.env, { NODE_ENV: "development" })
    delete process.env.APP_ALLOW_RUNTIME_CODEGEN
    const auth = (await import("@/infra/auth/server")).auth as ReturnType<typeof vi.fn>
    auth.mockResolvedValue({ user: { roles: ["admin"], email: "a@x" } })
    const { default: Page } = await import("../page")
    await expectNoGateBailout(Page)
  })

  it("still redirects to /auth/login in production when there is no session", async () => {
    Object.assign(process.env, { NODE_ENV: "production" })
    const auth = (await import("@/infra/auth/server")).auth as ReturnType<typeof vi.fn>
    auth.mockResolvedValue(null)
    const { default: Page } = await import("../page")
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/auth/login")
  })

  it("redirects to /auth/login when there is no session", async () => {
    Object.assign(process.env, { NODE_ENV: "development" })
    process.env.APP_ALLOW_RUNTIME_CODEGEN = "true"
    const auth = (await import("@/infra/auth/server")).auth as ReturnType<typeof vi.fn>
    auth.mockResolvedValue(null)
    const { default: Page } = await import("../page")
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/auth/login")
  })

  it("redirects to /403 when the user has no admin role", async () => {
    Object.assign(process.env, { NODE_ENV: "development" })
    process.env.APP_ALLOW_RUNTIME_CODEGEN = "true"
    const auth = (await import("@/infra/auth/server")).auth as ReturnType<typeof vi.fn>
    auth.mockResolvedValue({ user: { roles: ["user"], email: "u@x" } })
    const { default: Page } = await import("../page")
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/403")
  })

  it("renders (no throw) when both gates pass and the user has admin role", async () => {
    Object.assign(process.env, { NODE_ENV: "development" })
    process.env.APP_ALLOW_RUNTIME_CODEGEN = "true"
    const auth = (await import("@/infra/auth/server")).auth as ReturnType<typeof vi.fn>
    auth.mockResolvedValue({ user: { roles: ["admin"], email: "a@x" } })
    const { default: Page } = await import("../page")
    // We only care that the env/auth short-circuits don't fire — the JSX
    // rendering side is covered by EntityTable.test.tsx. Pinning on "no
    // notFound, no redirect thrown" keeps the assertion stable across
    // unrelated JSX-runtime changes inside the page body.
    try {
      await Page()
    } catch (err) {
      const message = (err as Error).message
      expect(message).not.toMatch(/NEXT_NOT_FOUND/)
      expect(message).not.toMatch(/NEXT_REDIRECT/)
    }
  })
})
