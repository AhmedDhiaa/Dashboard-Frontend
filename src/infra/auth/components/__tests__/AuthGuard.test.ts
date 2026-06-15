import { describe, it, expect, vi, beforeEach } from "vitest"

// Stub the route-permission helper so the derivation runs in isolation.
vi.mock("@/shared/config/route-permissions", () => ({
  getRequiredPermission: vi.fn(() => null as string | null),
}))

import { deriveAuthState } from "../AuthGuard"
import { getRequiredPermission } from "@/shared/config/route-permissions"

const baseInput = {
  pathname: "/dashboard",
  status: "authenticated" as const,
  permissions: new Set<string>(),
  isAdmin: false,
  permLoading: false,
}

describe("deriveAuthState", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getRequiredPermission).mockReturnValue(null as never)
  })

  it("authorizes public paths regardless of session status", () => {
    expect(deriveAuthState({ ...baseInput, pathname: "/auth/login", status: "unauthenticated" })).toBe("authorized")
  })

  it("stays in 'checking' while NextAuth resolves the session", () => {
    // The access token lives in the HttpOnly cookie and cannot be peeked
    // at from JS — the skeleton holds until status flips off "loading".
    expect(deriveAuthState({ ...baseInput, status: "loading" })).toBe("checking")
  })

  it("redirects to login when NextAuth resolved unauthenticated", () => {
    expect(deriveAuthState({ ...baseInput, status: "unauthenticated" })).toBe("redirect-login")
  })

  it("authorizes admins regardless of route permission requirements", () => {
    vi.mocked(getRequiredPermission).mockReturnValue("admin.things" as never)
    expect(deriveAuthState({ ...baseInput, isAdmin: true })).toBe("authorized")
  })

  it("forbids when the required permission is missing", () => {
    vi.mocked(getRequiredPermission).mockReturnValue("brands.View" as never)
    expect(deriveAuthState({ ...baseInput, permissions: new Set(["other.thing"]) })).toBe("forbidden")
  })

  it("authorizes when the required permission is in the granted set", () => {
    vi.mocked(getRequiredPermission).mockReturnValue("brands.View" as never)
    expect(deriveAuthState({ ...baseInput, permissions: new Set(["brands.View"]) })).toBe("authorized")
  })

  it("authorizes through (no enforcement) while permissions are still loading", () => {
    vi.mocked(getRequiredPermission).mockReturnValue("brands.View" as never)
    expect(deriveAuthState({ ...baseInput, permLoading: true })).toBe("authorized")
  })
})
