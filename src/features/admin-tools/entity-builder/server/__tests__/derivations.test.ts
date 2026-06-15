/**
 * Coverage for the pure name-derivation helpers used by the codegen pipeline,
 * the materialize endpoint, and the runtime builder's mapper. These are the
 * single source of truth for how an entity name maps to its API endpoint and
 * permission key — small, but a regression here breaks every freshly
 * generated entity.
 */

import { describe, it, expect } from "vitest"
import { deriveEndpoint, derivePermissionKey, pluralizeEnglish, toKebabCase, toPascalCase } from "../derivations"

describe("pluralizeEnglish", () => {
  it("returns empty string for empty input (no edge crash)", () => {
    expect(pluralizeEnglish("")).toBe("")
  })

  it("appends -es to sibilant endings (s, x, z, ch, sh)", () => {
    expect(pluralizeEnglish("box")).toBe("boxes")
    expect(pluralizeEnglish("dish")).toBe("dishes")
    expect(pluralizeEnglish("buzz")).toBe("buzzes")
    expect(pluralizeEnglish("watch")).toBe("watches")
    expect(pluralizeEnglish("bus")).toBe("buses")
  })

  it("turns consonant-y into -ies", () => {
    expect(pluralizeEnglish("city")).toBe("cities")
    expect(pluralizeEnglish("party")).toBe("parties")
  })

  it("keeps vowel-y intact and just appends s", () => {
    expect(pluralizeEnglish("day")).toBe("days")
    expect(pluralizeEnglish("toy")).toBe("toys")
  })

  it("appends s to plain singulars", () => {
    expect(pluralizeEnglish("customer")).toBe("customers")
    expect(pluralizeEnglish("order")).toBe("orders")
  })
})

describe("toKebabCase", () => {
  it("converts camelCase and PascalCase to kebab-case", () => {
    expect(toKebabCase("customerOrder")).toBe("customer-order")
    expect(toKebabCase("CustomerOrder")).toBe("customer-order")
  })

  it("collapses whitespace and underscores into a single hyphen", () => {
    expect(toKebabCase("Customer  Order")).toBe("customer-order")
    expect(toKebabCase("customer_order_item")).toBe("customer-order-item")
  })

  it("trims leading/trailing hyphens and dedups internal runs", () => {
    expect(toKebabCase("--customer--order--")).toBe("customer-order")
  })

  it("keeps digits attached to the preceding word", () => {
    expect(toKebabCase("address1Line")).toBe("address1-line")
  })
})

describe("toPascalCase", () => {
  it("PascalCases hyphen-, underscore-, and space-separated input", () => {
    expect(toPascalCase("customer-order")).toBe("CustomerOrder")
    expect(toPascalCase("customer_order")).toBe("CustomerOrder")
    expect(toPascalCase("customer order")).toBe("CustomerOrder")
  })

  it("normalizes mixed casing to canonical Pascal form", () => {
    expect(toPascalCase("CUSTOMER-Order")).toBe("CustomerOrder")
  })

  it("returns empty string for empty / separator-only input", () => {
    expect(toPascalCase("")).toBe("")
    expect(toPascalCase("---")).toBe("")
  })
})

describe("deriveEndpoint", () => {
  it("builds an /api/app/<kebab> endpoint", () => {
    expect(deriveEndpoint("CustomerOrder")).toBe("/api/app/customer-order")
    expect(deriveEndpoint("brand")).toBe("/api/app/brand")
  })

  it("returns empty string for empty input rather than '/api/app/'", () => {
    // Empty endpoint is the signal upstream that no derivation was possible —
    // hard-coding "/api/app/" would silently route to a wildcard handler.
    expect(deriveEndpoint("")).toBe("")
  })
})

describe("derivePermissionKey", () => {
  it("builds Api.<Pascal> from any-case input", () => {
    expect(derivePermissionKey("customer-order")).toBe("Api.CustomerOrder")
    expect(derivePermissionKey("brand")).toBe("Api.Brand")
  })

  it("returns empty string for empty input", () => {
    expect(derivePermissionKey("")).toBe("")
  })
})
