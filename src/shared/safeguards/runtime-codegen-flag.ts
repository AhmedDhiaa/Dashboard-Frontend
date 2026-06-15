/**
 * Production startup safeguard for the runtime-codegen flag.
 *
 * `APP_ALLOW_RUNTIME_CODEGEN=true` lets any admin overwrite source
 * files on disk (entity-builder + widget-builder + runtime-builder
 * materialise pipelines all gate on this). It is meant for local dev
 * only — accidentally enabling it in production hands every admin a
 * remote file-write primitive.
 *
 * The override `APP_ALLOW_RUNTIME_CODEGEN_PROD_OVERRIDE` exists so a
 * deliberate production codegen build (e.g. an internal staging instance
 * with no real users) can opt in. The literal value is intentionally
 * verbose so it can't be set by accident — `true` / `1` / `yes` won't
 * unblock the gate.
 *
 * Pure function: takes env values as a plain object so unit tests can
 * exercise every combination without mutating `process.env`. The
 * instrumentation wrapper turns a `result.ok === false` into a fatal
 * log + `process.exit(1)`.
 */

export const RUNTIME_CODEGEN_FLAG = "APP_ALLOW_RUNTIME_CODEGEN"
export const RUNTIME_CODEGEN_OVERRIDE = "APP_ALLOW_RUNTIME_CODEGEN_PROD_OVERRIDE"
export const RUNTIME_CODEGEN_OVERRIDE_TOKEN = "i-understand-the-risks"

/** Subset of env vars the safeguard inspects. Everything else is ignored. */
export interface SafeguardEnv {
  NODE_ENV?: string | undefined
  [RUNTIME_CODEGEN_FLAG]?: string | undefined
  [RUNTIME_CODEGEN_OVERRIDE]?: string | undefined
}

export type SafeguardResult =
  | { ok: true; reason: "not-production" | "flag-disabled" | "override-acknowledged" }
  | { ok: false; reason: "production-without-override"; message: string }

/**
 * Returns `{ ok: true, reason }` when startup may proceed, or
 * `{ ok: false, ... }` when the runtime should refuse to start.
 *
 * The check fires only when ALL three are true:
 *   1. NODE_ENV === "production"
 *   2. APP_ALLOW_RUNTIME_CODEGEN === "true"
 *   3. APP_ALLOW_RUNTIME_CODEGEN_PROD_OVERRIDE !== the explicit token
 *
 * Anything else returns ok:true with a `reason` so the caller can audit
 * why startup proceeded.
 */
export function checkRuntimeCodegenFlag(env: SafeguardEnv): SafeguardResult {
  if (env.NODE_ENV !== "production") {
    return { ok: true, reason: "not-production" }
  }
  if (env[RUNTIME_CODEGEN_FLAG] !== "true") {
    return { ok: true, reason: "flag-disabled" }
  }
  if (env[RUNTIME_CODEGEN_OVERRIDE] === RUNTIME_CODEGEN_OVERRIDE_TOKEN) {
    return { ok: true, reason: "override-acknowledged" }
  }

  return {
    ok: false,
    reason: "production-without-override",
    message:
      `FATAL: ${RUNTIME_CODEGEN_FLAG}=true is set in production. ` +
      "This flag lets every admin overwrite source files on disk. " +
      `If this is intentional, also set ${RUNTIME_CODEGEN_OVERRIDE}=` +
      `"${RUNTIME_CODEGEN_OVERRIDE_TOKEN}". ` +
      "If it isn't, unset the flag in your secret store and redeploy.",
  }
}
