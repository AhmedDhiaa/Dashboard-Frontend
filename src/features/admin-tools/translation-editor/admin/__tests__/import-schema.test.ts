/**
 * Shape-detection + flattening tests for the translations import flow.
 *
 * The dialog itself is thin glue — the interesting branching logic lives in
 * `interpretImport` and `flattenSource`. Testing those directly covers the
 * three required cases without booting jsdom file pickers.
 */

import { describe, expect, it } from "vitest"
import { flattenSource, interpretImport, interpretRawNamespace } from "../import-schema"

describe("interpretImport: flat shape", () => {
  it("flat shape still works", () => {
    const raw = {
      locale: "en",
      overrides: {
        "common.greeting": "Hi",
        "auth.signIn": "Sign in",
      },
    }

    const result = interpretImport(raw, { sourceWriteEnabled: false })

    expect(result.kind).toBe("flat")
    if (result.kind !== "flat") throw new Error("kind narrowed wrong")
    expect(result.locale).toBe("en")
    expect(result.overrides).toEqual({
      "common.greeting": "Hi",
      "auth.signIn": "Sign in",
    })
  })

  it("flat shape works regardless of the source-write flag", () => {
    const raw = { locale: "ar", overrides: { "common.greeting": "مرحبا" } }
    // Flat imports route through the override store, which is always
    // available — the gate only affects source-shape imports.
    const off = interpretImport(raw, { sourceWriteEnabled: false })
    const on = interpretImport(raw, { sourceWriteEnabled: true })
    expect(off.kind).toBe("flat")
    expect(on.kind).toBe("flat")
  })
})

describe("interpretImport / flattenSource: source shape", () => {
  it("source shape flattens correctly", () => {
    const raw = {
      locale: "en",
      namespace: "common",
      source: {
        greeting: "Hello",
        status: {
          active: "Active",
          inactive: "Inactive",
        },
        deeply: {
          nested: {
            leaf: "Deep value",
          },
        },
      },
    }

    const result = interpretImport(raw, { sourceWriteEnabled: true })
    expect(result.kind).toBe("source")
    if (result.kind !== "source") throw new Error("kind narrowed wrong")
    expect(result.locale).toBe("en")
    expect(result.namespace).toBe("common")
    expect(result.flattened).toEqual([
      { keyPath: "greeting", value: "Hello" },
      { keyPath: "status.active", value: "Active" },
      { keyPath: "status.inactive", value: "Inactive" },
      { keyPath: "deeply.nested.leaf", value: "Deep value" },
    ])
  })

  it("flattenSource skips empty objects and rejects non-string leaves", () => {
    expect(flattenSource({ empty: {}, present: "x" })).toEqual([{ keyPath: "present", value: "x" }])
    expect(() => flattenSource({ bad: 42 })).toThrow(/Source value at "bad"/)
    expect(() => flattenSource({ wrapped: { kids: [1, 2] } })).toThrow(/Source value at "wrapped.kids"/)
    expect(() => flattenSource({ nope: null })).toThrow(/null is not a translation value/)
  })

  it("source shape rejected when SOURCE_WRITE_ENABLED is false", () => {
    const raw = {
      locale: "en",
      namespace: "common",
      source: { greeting: "Hi" },
    }

    const result = interpretImport(raw, { sourceWriteEnabled: false })

    expect(result.kind).toBe("error")
    if (result.kind !== "error") throw new Error("kind narrowed wrong")
    expect(result.error).toMatch(/source-write mode/i)
    expect(result.error).toMatch(/NEXT_PUBLIC_APP_ALLOW_RUNTIME_CODEGEN/)
  })
})

describe("interpretRawNamespace: raw messages file fallback", () => {
  it("flattens a raw namespace object using the passed locale + namespace", () => {
    const raw = {
      greeting: "Hello",
      status: { active: "Active" },
    }
    const result = interpretRawNamespace(raw, "ar", "common")
    expect(result.kind).toBe("source")
    if (result.kind !== "source") throw new Error("kind narrowed wrong")
    expect(result.locale).toBe("ar")
    expect(result.namespace).toBe("common")
    expect(result.flattened).toEqual([
      { keyPath: "greeting", value: "Hello" },
      { keyPath: "status.active", value: "Active" },
    ])
  })

  it("rejects non-object, array, and empty-namespace inputs", () => {
    expect(interpretRawNamespace(null, "en", "common").kind).toBe("error")
    expect(interpretRawNamespace([1, 2], "en", "common").kind).toBe("error")
    expect(interpretRawNamespace("string", "en", "common").kind).toBe("error")
    expect(interpretRawNamespace({ a: "x" }, "en", "").kind).toBe("error")
  })

  it("surfaces flatten errors (non-string leaves)", () => {
    const result = interpretRawNamespace({ bad: 42 }, "en", "common")
    expect(result.kind).toBe("error")
    if (result.kind !== "error") throw new Error("kind narrowed wrong")
    expect(result.error).toMatch(/Source value at "bad"/)
  })
})

describe("interpretImport: mixed / invalid shapes", () => {
  it("refuses payloads with both overrides and source (strict mode rejects extras)", () => {
    const raw = {
      locale: "en",
      overrides: { "common.greeting": "Hi" },
      namespace: "common",
      source: { greeting: "Hi" },
    }
    const result = interpretImport(raw, { sourceWriteEnabled: true })
    expect(result.kind).toBe("error")
  })

  it("refuses payloads with neither overrides nor source", () => {
    expect(interpretImport({ locale: "en" }, { sourceWriteEnabled: true }).kind).toBe("error")
    expect(interpretImport({ overrides: {} }, { sourceWriteEnabled: true }).kind).toBe("error")
    expect(interpretImport(null, { sourceWriteEnabled: true }).kind).toBe("error")
  })

  it("refuses source shape with an empty namespace", () => {
    const raw = { locale: "en", namespace: "", source: { greeting: "Hi" } }
    expect(interpretImport(raw, { sourceWriteEnabled: true }).kind).toBe("error")
  })
})
