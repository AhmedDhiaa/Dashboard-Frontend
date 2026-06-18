import { describe, it, expect } from "vitest"
import { authPort, enumPort, configPort, entity } from "@/infra/api/backend"

/**
 * The composition root must expose every port with the shape app code relies on.
 * This locks the wiring: drop a port method or mis-wire an adapter and it fails
 * here, independent of any single feature's tests.
 */
describe("backend composition root", () => {
  it("exposes auth/enum/config ports with the contract method shape", () => {
    expect(typeof authPort.login).toBe("function")
    expect(typeof authPort.refresh).toBe("function")
    expect(typeof authPort.sendPasswordResetCode).toBe("function")
    expect(typeof authPort.resetPassword).toBe("function")
    expect(typeof enumPort.getEnumValues).toBe("function")
    expect(typeof configPort.getApplicationConfig).toBe("function")
  })

  it("entity() builds an EntityService exposing the full CRUD surface", () => {
    const service = entity("/widget")
    for (const method of ["getList", "getById", "create", "update", "delete", "autocomplete"] as const) {
      expect(typeof service[method]).toBe("function")
    }
  })
})
