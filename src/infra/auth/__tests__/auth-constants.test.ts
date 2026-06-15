import { describe, it, expect } from "vitest"
import { isPublicPath, isMiddlewareBypassPath, PUBLIC_PATHS, MIDDLEWARE_BYPASS_PATHS } from "../auth-constants"

describe("isPublicPath", () => {
  it.each(["/auth/login", "/auth/login?redirectTo=/dashboard", "/auth/session-expired", "/403", "/404"])(
    "returns true for public path %s",
    p => {
      expect(isPublicPath(p)).toBe(true)
    },
  )

  it.each(["/", "/dashboard", "/orders", "/api/orders"])("returns false for protected path %s", p => {
    expect(isPublicPath(p)).toBe(false)
  })
})

describe("isMiddlewareBypassPath", () => {
  it.each(["/auth/login", "/api/auth/callback/credentials", "/_next/static/foo.js", "/favicon.ico"])(
    "returns true for bypass path %s",
    p => {
      expect(isMiddlewareBypassPath(p)).toBe(true)
    },
  )

  it.each(["/dashboard", "/api/orders", "/cities"])("returns false for non-bypass path %s", p => {
    expect(isMiddlewareBypassPath(p)).toBe(false)
  })
})

describe("path constants", () => {
  it("MIDDLEWARE_BYPASS_PATHS is a superset of PUBLIC_PATHS", () => {
    for (const p of PUBLIC_PATHS) {
      expect(MIDDLEWARE_BYPASS_PATHS.includes(p as never)).toBe(true)
    }
  })
})
