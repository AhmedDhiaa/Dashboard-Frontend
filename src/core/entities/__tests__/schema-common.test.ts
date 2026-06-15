/**
 * Tests for the shared zod field-builder primitives. These power every
 * entity schema in the registry, so a regression here affects every
 * CRUD form in the app — making them fast to test is high-leverage.
 */

import { describe, it, expect } from "vitest"
import { commonFields, getOptionalString, getNameField, getBooleanField, getEmailField } from "../schema-common"

describe("commonFields.code", () => {
  it("accepts uppercase alphanumeric within the length range", () => {
    expect(commonFields.code().safeParse("ABC123").success).toBe(true)
  })

  it("rejects lowercase letters", () => {
    expect(commonFields.code().safeParse("abc").success).toBe(false)
  })

  it("rejects strings over 10 characters", () => {
    expect(commonFields.code().safeParse("ABCDEFGHIJK").success).toBe(false)
  })

  it("required=false makes the field optional", () => {
    expect(commonFields.code(false).safeParse(undefined).success).toBe(true)
  })
})

describe("commonFields.name + foreignName", () => {
  it("accepts non-empty strings ≤ 100 chars", () => {
    expect(commonFields.name().safeParse("Alice").success).toBe(true)
    expect(commonFields.foreignName().safeParse("علي").success).toBe(true)
  })

  it("rejects empty strings when required", () => {
    expect(commonFields.name().safeParse("").success).toBe(false)
  })

  it("rejects strings over 100 chars", () => {
    expect(commonFields.name().safeParse("a".repeat(101)).success).toBe(false)
  })

  it("optional shapes accept undefined", () => {
    expect(commonFields.name(false).safeParse(undefined).success).toBe(true)
    expect(commonFields.foreignName(false).safeParse(undefined).success).toBe(true)
  })
})

describe("commonFields.note", () => {
  it("accepts strings up to 500 chars", () => {
    expect(commonFields.note().safeParse("a".repeat(500)).success).toBe(true)
  })

  it("rejects > 500 chars", () => {
    expect(commonFields.note().safeParse("a".repeat(501)).success).toBe(false)
  })

  it("accepts undefined (always optional)", () => {
    expect(commonFields.note().safeParse(undefined).success).toBe(true)
  })
})

describe("commonFields.id", () => {
  it("default 'number' shape requires a positive integer", () => {
    expect(commonFields.id().safeParse(1).success).toBe(true)
    expect(commonFields.id().safeParse(0).success).toBe(false)
    expect(commonFields.id().safeParse(-3).success).toBe(false)
    expect(commonFields.id().safeParse(1.5).success).toBe(false)
  })

  it("'string' shape requires a non-empty string", () => {
    expect(commonFields.id("string").safeParse("abc").success).toBe(true)
    expect(commonFields.id("string").safeParse("").success).toBe(false)
  })
})

describe("commonFields.parentId + orderNo", () => {
  it("parentId accepts positive integers, null, undefined", () => {
    expect(commonFields.parentId().safeParse(5).success).toBe(true)
    expect(commonFields.parentId().safeParse(null).success).toBe(true)
    expect(commonFields.parentId().safeParse(undefined).success).toBe(true)
    expect(commonFields.parentId().safeParse(-1).success).toBe(false)
  })

  it("orderNo same rules as parentId", () => {
    expect(commonFields.orderNo().safeParse(10).success).toBe(true)
    expect(commonFields.orderNo().safeParse(null).success).toBe(true)
  })
})

describe("commonFields.boolean", () => {
  it("uses the supplied default", () => {
    const r = commonFields.boolean(true).safeParse(undefined)
    expect(r.success).toBe(true)
    if (r.success) expect(r.data).toBe(true)
  })

  it("rejects non-boolean values", () => {
    expect(commonFields.boolean().safeParse("yes" as unknown).success).toBe(false)
  })
})

describe("commonFields.email", () => {
  it("accepts valid emails", () => {
    expect(commonFields.email().safeParse("a@b.co").success).toBe(true)
  })

  it("rejects invalid shapes", () => {
    expect(commonFields.email().safeParse("not-an-email").success).toBe(false)
  })
})

describe("commonFields.phone", () => {
  it("accepts plus-prefixed numbers, dashes, spaces, parentheses", () => {
    expect(commonFields.phone().safeParse("+1 (555) 123-4567").success).toBe(true)
  })

  it("rejects letters in the number", () => {
    expect(commonFields.phone().safeParse("call me").success).toBe(false)
  })

  it("optional by default", () => {
    expect(commonFields.phone().safeParse(undefined).success).toBe(true)
  })
})

describe("commonFields.url", () => {
  it("accepts well-formed URLs", () => {
    expect(commonFields.url(true).safeParse("https://example.com").success).toBe(true)
  })

  it("rejects garbage", () => {
    expect(commonFields.url(true).safeParse("not a url").success).toBe(false)
  })
})

describe("commonFields.boundaries", () => {
  it("accepts a list of lat/lng/sequence triples", () => {
    const r = commonFields.boundaries().safeParse([
      { latitude: 33.3, longitude: 44.4, sequence: 0 },
      { latitude: 33.31, longitude: 44.41 },
    ])
    expect(r.success).toBe(true)
  })

  it("rejects out-of-range latitudes", () => {
    expect(commonFields.boundaries().safeParse([{ latitude: 95, longitude: 0 }]).success).toBe(false)
  })
})

describe("legacy helpers (backward-compat shims)", () => {
  it("getOptionalString respects maxLength", () => {
    expect(getOptionalString(3).safeParse("abc").success).toBe(true)
    expect(getOptionalString(3).safeParse("abcd").success).toBe(false)
  })

  it("getNameField default required", () => {
    expect(getNameField().safeParse("hi").success).toBe(true)
    expect(getNameField().safeParse("").success).toBe(false)
  })

  it("getBooleanField default falls through", () => {
    const r = getBooleanField(true).safeParse(undefined)
    if (r.success) expect(r.data).toBe(true)
  })

  it("getEmailField required by default", () => {
    expect(getEmailField().safeParse("a@b.co").success).toBe(true)
    expect(getEmailField().safeParse("nope").success).toBe(false)
  })
})
