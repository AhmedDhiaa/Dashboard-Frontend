import { describe, it, expect } from "vitest"
import {
  flattenAbpPermissions,
  isAbpPermissionGranted,
  abpSettingValues,
  abpFeatureValues,
  toApplicationConfig,
} from "../config-normalize"
import type { ApplicationConfiguration } from "@/shared/types/application-config.types"

describe("flattenAbpPermissions", () => {
  it("returns granted keys only", () => {
    expect(flattenAbpPermissions({ auth: { grantedPolicies: { a: true, b: false, c: true } } })).toEqual(["a", "c"])
  })

  it("falls back to `policies` when grantedPolicies is absent", () => {
    expect(flattenAbpPermissions({ auth: { policies: { x: true, y: false } } })).toEqual(["x"])
  })

  it("returns [] for null / empty", () => {
    expect(flattenAbpPermissions(null)).toEqual([])
    expect(flattenAbpPermissions({})).toEqual([])
  })
})

describe("isAbpPermissionGranted", () => {
  it("is true only for a granted key", () => {
    const cfg = { auth: { grantedPolicies: { a: true, b: false } } }
    expect(isAbpPermissionGranted(cfg, "a")).toBe(true)
    expect(isAbpPermissionGranted(cfg, "b")).toBe(false)
    expect(isAbpPermissionGranted(cfg, "missing")).toBe(false)
  })

  it("is false for null config", () => {
    expect(isAbpPermissionGranted(null, "a")).toBe(false)
  })
})

describe("abpSettingValues / abpFeatureValues", () => {
  it("returns the values map or empty", () => {
    expect(abpSettingValues({ setting: { values: { Theme: "dark" } } })).toEqual({ Theme: "dark" })
    expect(abpSettingValues(null)).toEqual({})
    expect(abpFeatureValues({ features: { values: { Chat: "true" } } })).toEqual({ Chat: "true" })
    expect(abpFeatureValues({})).toEqual({})
  })
})

describe("toApplicationConfig", () => {
  const raw = {
    currentUser: {
      isAuthenticated: true,
      id: "u1",
      tenantId: "t1",
      userName: "admin",
      name: "Admin",
      surName: null,
      email: "admin@example.com",
      roles: ["admin", "user"],
    },
    auth: { grantedPolicies: { "Acme.Orders": true, "Acme.Hidden": false } },
    setting: { values: { Theme: "dark" } },
    features: { values: { Chat: "true" } },
  } as unknown as ApplicationConfiguration

  it("maps the raw ABP config to the neutral shape", () => {
    const cfg = toApplicationConfig(raw)
    expect(cfg.permissions).toEqual(["Acme.Orders"])
    expect(cfg.settings).toEqual({ Theme: "dark" })
    expect(cfg.features).toEqual({ Chat: "true" })
    expect(cfg.roles).toEqual(["admin", "user"])
    expect(cfg.user).toMatchObject({
      id: "u1",
      name: "Admin",
      email: "admin@example.com",
      roles: ["admin", "user"],
      tenantId: "t1",
      permissions: ["Acme.Orders"],
    })
  })

  it("yields a null user when unauthenticated", () => {
    const anon = { ...raw, currentUser: { ...raw.currentUser, isAuthenticated: false } } as ApplicationConfiguration
    expect(toApplicationConfig(anon).user).toBeNull()
  })
})
