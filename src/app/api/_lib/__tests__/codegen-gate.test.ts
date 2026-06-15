/**
 * `codegenAllowed()` is the belt-and-braces gate for the source-writing codegen
 * routes (entity-builder generate, widget-builder generate, runtime materialize,
 * snapshot restore). It must be true ONLY when the env flag is on AND we are not
 * in a production build — so a builder-permission holder can never reach the
 * arbitrary-source-write path on a prod box even if the startup override token
 * was used.
 */

import { afterEach, describe, expect, it, vi } from "vitest"
import { codegenAllowed } from "../codegen-gate"

describe("codegenAllowed", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("is false when the flag is unset (regardless of env)", () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("APP_ALLOW_RUNTIME_CODEGEN", "")
    expect(codegenAllowed()).toBe(false)
  })

  it("is true with the flag on outside production", () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("APP_ALLOW_RUNTIME_CODEGEN", "true")
    expect(codegenAllowed()).toBe(true)
  })

  it("is FALSE in production even with the flag on (the security-critical case)", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("APP_ALLOW_RUNTIME_CODEGEN", "true")
    expect(codegenAllowed()).toBe(false)
  })

  it("only accepts the exact string 'true', not other truthy values", () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("APP_ALLOW_RUNTIME_CODEGEN", "1")
    expect(codegenAllowed()).toBe(false)
  })
})
