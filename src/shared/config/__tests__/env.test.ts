import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

describe("env validation", () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    Object.keys(process.env).forEach(k => {
      if (!(k in originalEnv)) delete process.env[k]
    })
    Object.assign(process.env, originalEnv)
  })

  it("loads without throwing even when AUTH_SECRET is missing", async () => {
    delete process.env["AUTH_SECRET"]
    const { env } = await import("../env")
    expect(env).toBeDefined()
  })

  it("defaults NEXT_PUBLIC_API_URL when not set", async () => {
    delete process.env["NEXT_PUBLIC_API_URL"]
    const { env } = await import("../env")
    // In non-production, falls back to localhost:3000
    expect(env.NEXT_PUBLIC_API_URL).toBeTruthy()
  })

  it("defaults log level to info", async () => {
    delete process.env["NEXT_PUBLIC_LOG_LEVEL"]
    const { env } = await import("../env")
    expect(env.NEXT_PUBLIC_LOG_LEVEL).toBe("info")
  })

  it("validateEnvironmentVariables warns in non-production with short secret", async () => {
    process.env["AUTH_SECRET"] = "short"
    process.env["NEXT_PUBLIC_API_URL"] = "https://api.example.com"
    const { validateEnvironmentVariables } = await import("../env")
    // Should warn, not throw, in non-production
    expect(() => validateEnvironmentVariables()).not.toThrow()
  })

  it("THROWS in production when no AUTH_SECRET/NEXTAUTH_SECRET is set (fail-fast at startup)", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.com")
    delete process.env["AUTH_SECRET"]
    delete process.env["NEXTAUTH_SECRET"]
    const { validateEnvironmentVariables } = await import("../env")
    expect(() => validateEnvironmentVariables()).toThrow(/AUTH_SECRET/)
  })

  it("passes in production when a 32+ char secret is present", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.com")
    vi.stubEnv("AUTH_SECRET", "a".repeat(32))
    const { validateEnvironmentVariables } = await import("../env")
    expect(() => validateEnvironmentVariables()).not.toThrow()
  })
})
