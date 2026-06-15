/**
 * Permission-keys patcher: unit tests + a byte-preservation gate.
 *
 * The patcher's contract is "no change to any byte outside the insertion
 * site." The "no-op on existing entry" test below is the strongest
 * statement of that contract — an idempotent call must produce a string
 * literally identical to the input.
 */

import { describe, expect, it } from "vitest"
import { applyPermissionKeyPatch, PatchFailedError, PermissionKeyCollisionError } from "../permission-keys-patcher"

const FIXTURE = `export const PERMISSIONS = {
  ADMIN_ENTITY_BUILDER: "Api.Admin.EntityBuilder",
  ADMIN_PAGE_BUILDER: "Api.Admin.PageBuilder",
  THEME_MANAGE: "Api.Theme.Manage",
} as const
`

describe("applyPermissionKeyPatch — happy path", () => {
  it("appends a new entry just before the `} as const` anchor", () => {
    const r = applyPermissionKeyPatch(FIXTURE, { identifier: "BRAND_APPROVE", value: "Api.Brand.Approve" })
    expect(r.changed).toBe(true)
    expect(r.content).toContain(`  BRAND_APPROVE: "Api.Brand.Approve",`)
    // Existing lines preserved byte-for-byte.
    expect(r.content).toContain(`  ADMIN_ENTITY_BUILDER: "Api.Admin.EntityBuilder",`)
    expect(r.content).toContain(`  THEME_MANAGE: "Api.Theme.Manage",`)
    // The closing anchor is still there exactly once.
    expect(r.content.match(/} as const/g)?.length).toBe(1)
  })

  it("inherits the existing entries' indentation", () => {
    const r = applyPermissionKeyPatch(FIXTURE, { identifier: "X_Y", value: "Api.X.Y" })
    // Two-space indent — the same as the existing entries.
    expect(r.content).toMatch(/^  X_Y: "Api\.X\.Y",$/m)
  })
})

describe("applyPermissionKeyPatch — idempotency / collisions", () => {
  it("is a no-op when the identifier already exists with the same value", () => {
    const r = applyPermissionKeyPatch(FIXTURE, {
      identifier: "THEME_MANAGE",
      value: "Api.Theme.Manage",
    })
    expect(r.changed).toBe(false)
    // Byte-identical.
    expect(r.content).toBe(FIXTURE)
  })

  it("refuses when the identifier exists with a different value", () => {
    expect(() =>
      applyPermissionKeyPatch(FIXTURE, { identifier: "THEME_MANAGE", value: "Api.Theme.DifferentValue" }),
    ).toThrow(PermissionKeyCollisionError)
  })
})

describe("applyPermissionKeyPatch — input validation", () => {
  it("refuses an identifier that isn't UPPER_SNAKE_CASE", () => {
    for (const bad of ["lowercase", "Camel", "9START", "has space", "kebab-case"]) {
      expect(() => applyPermissionKeyPatch(FIXTURE, { identifier: bad, value: "Api.X.Y" }), bad).toThrow(
        PatchFailedError,
      )
    }
  })

  it("refuses a 2-segment prefix value (e.g. Api.Brand) — those belong on the entity config, not PERMISSIONS", () => {
    expect(() => applyPermissionKeyPatch(FIXTURE, { identifier: "BRAND", value: "Api.Brand" })).toThrow(
      PatchFailedError,
    )
  })

  it("refuses values that don't start with Api.", () => {
    expect(() => applyPermissionKeyPatch(FIXTURE, { identifier: "X", value: "Custom.Foo.Bar" })).toThrow(
      PatchFailedError,
    )
  })

  it("refuses values with shell metacharacters (defence in depth — Zod already rejects, but pin here)", () => {
    for (const bad of ["Api.X; rm -rf /", "Api.X`evil`", "Api.X${alert(1)}", 'Api.X"y']) {
      expect(() => applyPermissionKeyPatch(FIXTURE, { identifier: "X", value: bad }), bad).toThrow(PatchFailedError)
    }
  })
})

describe("applyPermissionKeyPatch — anchor failures", () => {
  it("throws PatchFailedError when the `} as const` anchor is missing", () => {
    const broken = `export const PERMISSIONS = {\n  X: "Api.X.Y",\n}\n`
    expect(() => applyPermissionKeyPatch(broken, { identifier: "Y_Z", value: "Api.Y.Z" })).toThrow(PatchFailedError)
  })
})
