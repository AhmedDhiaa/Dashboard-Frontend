/**
 * Backend port contract suites.
 *
 * Reusable, implementation-agnostic test batteries: hand them a factory for any
 * `AuthPort` / `EnumPort` implementation and they assert it honours the neutral
 * contract in `@/shared/ports/backend`. New backend adapters get conformance
 * coverage for free by calling these from their own `*.test.ts`.
 *
 * Not a spec file itself (no `.test.ts`), so vitest only executes it through the
 * adapter tests that invoke these functions.
 */

import { describe, it, expect } from "vitest"
import type { AuthPort, Credentials, EnumPort } from "@/shared/ports/backend"

export function runAuthPortContract(
  label: string,
  makePort: () => AuthPort,
  credentials: Credentials = { username: "demo", password: "demo" },
): void {
  describe(`AuthPort contract: ${label}`, () => {
    it("login resolves to a TokenSet with a non-empty accessToken", async () => {
      const tokens = await makePort().login(credentials)
      expect(typeof tokens.accessToken).toBe("string")
      expect(tokens.accessToken.length).toBeGreaterThan(0)
    })

    it("refresh resolves to a TokenSet with a non-empty accessToken", async () => {
      const tokens = await makePort().refresh("a-refresh-token")
      expect(typeof tokens.accessToken).toBe("string")
      expect(tokens.accessToken.length).toBeGreaterThan(0)
    })

    it("sendPasswordResetCode resolves to void", async () => {
      await expect(makePort().sendPasswordResetCode({ email: "demo@example.com" })).resolves.toBeUndefined()
    })

    it("resetPassword resolves to void", async () => {
      await expect(
        makePort().resetPassword({ userId: "1", resetToken: "token", password: "secret" }),
      ).resolves.toBeUndefined()
    })
  })
}

export function runEnumPortContract(label: string, makePort: () => EnumPort, knownType = "status"): void {
  describe(`EnumPort contract: ${label}`, () => {
    it("getEnumValues returns an array of { id, name, foreignName }", async () => {
      const values = await makePort().getEnumValues(knownType)
      expect(Array.isArray(values)).toBe(true)
      for (const value of values) {
        expect(typeof value.id).toBe("number")
        expect(typeof value.name).toBe("string")
        expect(typeof value.foreignName).toBe("string")
      }
    })

    it("returns an array (never null/undefined) for an unknown type", async () => {
      const values = await makePort().getEnumValues("definitely-not-a-real-enum-type")
      expect(Array.isArray(values)).toBe(true)
    })
  })
}
