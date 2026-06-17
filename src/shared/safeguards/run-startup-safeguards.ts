/**
 * Node-only startup safeguards. Kept in its own module so the
 * `process.exit` reference never appears in the Edge runtime bundle —
 * `instrumentation.ts` dynamic-imports this file only when
 * `NEXT_RUNTIME === "nodejs"`.
 *
 * Each safeguard is a pure function returning `{ ok, message? }`; this
 * module is the single place that bridges them to a fatal exit. Add a
 * new check by importing its checker and inserting one entry into
 * `CHECKS`.
 */

import { checkRuntimeCodegenFlag } from "./runtime-codegen-flag"
import { checkRateLimitBackend } from "./ratelimit-backend-flag"
import { checkMockApiFlag } from "./mock-api-flag"
import { validateEnvironmentVariables } from "@/shared/config/env"

interface SafeguardCheck {
  name: string
  run: (env: NodeJS.ProcessEnv) => { ok: boolean; message?: string }
}

// Env validation lives in `server.ts` too, but `output: "standalone"` runs
// Next's generated server.js (NOT server.ts), so in Docker/k8s that call never
// fires. `instrumentation.ts` DOES run on the standalone path, so routing the
// strict check (AUTH_SECRET present + ≥32 chars, valid API URL) through here
// guarantees a fast, loud failure on a misconfigured prod boot everywhere.
const checkEnvValidation = (): { ok: boolean; message?: string } => {
  try {
    validateEnvironmentVariables()
    return { ok: true }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) }
  }
}

const CHECKS: readonly SafeguardCheck[] = [
  { name: "env-validation", run: () => checkEnvValidation() },
  { name: "runtime-codegen-flag", run: env => checkRuntimeCodegenFlag(env) },
  { name: "ratelimit-backend", run: env => checkRateLimitBackend(env) },
  { name: "mock-api-flag", run: env => checkMockApiFlag(env) },
]

export function runStartupSafeguards(): void {
  for (const check of CHECKS) {
    const result = check.run(process.env)
    if (result.ok) continue
    console.error(`\n[startup-safeguard:${check.name}] ${result.message ?? "failed"}\n`)
    process.exit(1)
  }
}
