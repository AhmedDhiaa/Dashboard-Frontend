/**
 * Production startup safeguard for the standalone mock-API flag.
 *
 * `NEXT_PUBLIC_USE_MOCK_API=true` swaps the entire backend for an in-memory
 * mock that accepts ANY login and grants a demo user ALL permissions (see
 * src/infra/api/mock/handlers/auth.ts). It exists for the backend-free
 * demo/template mode. Shipping it to a real production deploy silently
 * bypasses both the real backend AND all authorization — every visitor
 * becomes a full admin operating on throwaway in-memory data that resets on
 * restart.
 *
 * The override `NEXT_PUBLIC_USE_MOCK_API_PROD_OVERRIDE` lets a DELIBERATE
 * public demo deploy opt in. The literal token is intentionally verbose so it
 * can't be set by accident — `true` / `1` / `yes` won't unblock the gate.
 *
 * Pure function: takes env values as a plain object so unit tests can exercise
 * every combination without mutating `process.env`. The instrumentation
 * wrapper (run-startup-safeguards.ts) turns `result.ok === false` into a fatal
 * log + `process.exit(1)`. Mirrors the shape of {@link checkRuntimeCodegenFlag}.
 */

export const MOCK_API_FLAG = "NEXT_PUBLIC_USE_MOCK_API"
export const MOCK_API_OVERRIDE = "NEXT_PUBLIC_USE_MOCK_API_PROD_OVERRIDE"
export const MOCK_API_OVERRIDE_TOKEN = "i-understand-this-is-a-public-demo"

/** Subset of env vars the safeguard inspects. Everything else is ignored. */
export interface MockApiSafeguardEnv {
  NODE_ENV?: string | undefined
  [MOCK_API_FLAG]?: string | undefined
  [MOCK_API_OVERRIDE]?: string | undefined
}

export type MockApiSafeguardResult =
  | { ok: true; reason: "not-production" | "flag-disabled" | "override-acknowledged" }
  | { ok: false; reason: "production-without-override"; message: string }

/**
 * Returns `{ ok: true, reason }` when startup may proceed, or `{ ok: false }`
 * when the runtime should refuse to start.
 *
 * The check fires only when ALL three are true:
 *   1. NODE_ENV === "production"
 *   2. NEXT_PUBLIC_USE_MOCK_API === "true"
 *   3. NEXT_PUBLIC_USE_MOCK_API_PROD_OVERRIDE !== the explicit token
 */
export function checkMockApiFlag(env: MockApiSafeguardEnv): MockApiSafeguardResult {
  if (env.NODE_ENV !== "production") {
    return { ok: true, reason: "not-production" }
  }
  if (env[MOCK_API_FLAG] !== "true") {
    return { ok: true, reason: "flag-disabled" }
  }
  if (env[MOCK_API_OVERRIDE] === MOCK_API_OVERRIDE_TOKEN) {
    return { ok: true, reason: "override-acknowledged" }
  }

  return {
    ok: false,
    reason: "production-without-override",
    message:
      `FATAL: ${MOCK_API_FLAG}=true is set in production. ` +
      "This replaces the real backend with an in-memory mock that accepts any " +
      "login and grants every visitor full admin access to throwaway data. " +
      `If this is a deliberate public demo, also set ${MOCK_API_OVERRIDE}=` +
      `"${MOCK_API_OVERRIDE_TOKEN}". ` +
      "Otherwise set NEXT_PUBLIC_USE_MOCK_API=false in your secret store and redeploy.",
  }
}
