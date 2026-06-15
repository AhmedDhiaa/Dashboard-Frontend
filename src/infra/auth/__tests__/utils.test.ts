/**
 * Pure-function tests for the auth utility helpers.
 * `getSession`/`getAccessToken` are thin wrappers around NextAuth's
 * `auth()` and need its full server context, so they're covered via the
 * integration paths in `server.ts` rather than here.
 */

import { describe, it, expect, vi, afterEach } from "vitest"
import {
  getUserDisplayName,
  getUserInitials,
  isTokenExpired,
  getTokenExpirationTime,
  formatAuthHeader,
  extractTokenFromHeader,
} from "../utils"
import type { User } from "@/shared/types"

vi.mock("@/infra/auth/server", () => ({
  auth: vi.fn(),
}))

afterEach(() => vi.useRealTimers())

describe("getUserDisplayName", () => {
  it("uses first + last when both present", () => {
    expect(getUserDisplayName({ firstName: "Ada", lastName: "Lovelace" } as User)).toBe("Ada Lovelace")
  })

  it("falls back to firstName, then name, then email, then 'User'", () => {
    expect(getUserDisplayName({ firstName: "Ada" } as User)).toBe("Ada")
    expect(getUserDisplayName({ name: "Just-Name" } as User)).toBe("Just-Name")
    expect(getUserDisplayName({ email: "x@y.z" } as User)).toBe("x@y.z")
    expect(getUserDisplayName({} as User)).toBe("User")
  })

  it("returns 'Guest' for null/undefined", () => {
    expect(getUserDisplayName(null)).toBe("Guest")
    expect(getUserDisplayName(undefined)).toBe("Guest")
  })
})

describe("getUserInitials", () => {
  it("returns the first two upper-case initials of the display name", () => {
    expect(getUserInitials({ firstName: "Ada", lastName: "Lovelace" } as User)).toBe("AL")
  })

  it("works on a single-name fallback", () => {
    expect(getUserInitials({ name: "alpha" } as User)).toBe("A")
  })

  it("returns 'G' for the guest fallback (single-word display name)", () => {
    expect(getUserInitials(null)).toBe("G")
  })
})

describe("isTokenExpired", () => {
  it("returns true for past timestamps", () => {
    expect(isTokenExpired(Date.now() - 1000)).toBe(true)
  })

  it("returns false for future timestamps", () => {
    expect(isTokenExpired(Date.now() + 60_000)).toBe(false)
  })
})

describe("getTokenExpirationTime", () => {
  it("returns now + expiresIn seconds", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"))
    expect(getTokenExpirationTime(60)).toBe(new Date("2026-01-01T00:01:00Z").getTime())
  })
})

describe("formatAuthHeader", () => {
  it("defaults to Bearer", () => {
    expect(formatAuthHeader("tok")).toBe("Bearer tok")
  })

  it("respects custom token type", () => {
    expect(formatAuthHeader("tok", "Token")).toBe("Token tok")
  })
})

describe("extractTokenFromHeader", () => {
  it("returns the token after 'Bearer '", () => {
    expect(extractTokenFromHeader("Bearer abc123")).toBe("abc123")
  })

  it("is case-insensitive on the scheme", () => {
    expect(extractTokenFromHeader("bearer abc123")).toBe("abc123")
  })

  it("returns null on malformed headers", () => {
    expect(extractTokenFromHeader("Basic abc")).toBeNull()
    expect(extractTokenFromHeader("Bearer")).toBeNull()
    expect(extractTokenFromHeader("Bearer a b")).toBeNull()
  })
})
