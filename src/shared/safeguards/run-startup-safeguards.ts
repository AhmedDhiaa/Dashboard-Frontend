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

interface SafeguardCheck {
  name: string
  run: (env: NodeJS.ProcessEnv) => { ok: boolean; message?: string }
}

const CHECKS: readonly SafeguardCheck[] = [
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
