import { describe, it, expect } from "vitest"
import { mapSwaggerToField, humanize } from "../field-mapper"
import type { ParsedProperty } from "../parser"

const prop = (over: Partial<ParsedProperty>): ParsedProperty => ({
  name: "x",
  type: "string",
  required: false,
  ...over,
})

describe("mapSwaggerToField — format priority", () => {
  it("date-time → datetime", () => {
    expect(mapSwaggerToField(prop({ format: "date-time" })).type).toBe("datetime")
  })
  it("date → date", () => {
    expect(mapSwaggerToField(prop({ format: "date" })).type).toBe("date")
  })
  it("email format → email", () => {
    expect(mapSwaggerToField(prop({ format: "email" })).type).toBe("email")
  })
  it("uri format → url", () => {
    expect(mapSwaggerToField(prop({ format: "uri" })).type).toBe("url")
  })
  it("binary → file", () => {
    expect(mapSwaggerToField(prop({ format: "binary" })).type).toBe("file")
  })
  it("password format → password (regardless of name)", () => {
    expect(mapSwaggerToField(prop({ name: "secret", format: "password" })).type).toBe("password")
  })
})

describe("mapSwaggerToField — type fallback", () => {
  it("boolean → boolean", () => {
    expect(mapSwaggerToField(prop({ type: "boolean" })).type).toBe("boolean")
  })
  it("integer → number", () => {
    expect(mapSwaggerToField(prop({ type: "integer" })).type).toBe("number")
  })
  it("$ref → autocomplete", () => {
    expect(mapSwaggerToField(prop({ ref: "#/components/schemas/Customer" })).type).toBe("autocomplete")
  })
  it("enum → select with options", () => {
    const result = mapSwaggerToField(prop({ enum: ["a", "b"] }))
    expect(result.type).toBe("select")
    expect(result.options?.map(o => o.value)).toEqual(["a", "b"])
  })
})

describe("mapSwaggerToField — name heuristics", () => {
  it("password name → password", () => {
    expect(mapSwaggerToField(prop({ name: "passwordHash" })).type).toBe("password")
  })
  it("phone name → phone", () => {
    expect(mapSwaggerToField(prop({ name: "phoneNumber" })).type).toBe("phone")
  })
  it("description name → textarea", () => {
    expect(mapSwaggerToField(prop({ name: "description" })).type).toBe("textarea")
  })
  it("color name → color", () => {
    expect(mapSwaggerToField(prop({ name: "primaryColor" })).type).toBe("color")
  })
  it("latitude / coordinates → map-location", () => {
    expect(mapSwaggerToField(prop({ name: "latitude" })).type).toBe("map-location")
    expect(mapSwaggerToField(prop({ name: "coordinates" })).type).toBe("map-location")
  })
  it("plain string with no hints → text", () => {
    expect(mapSwaggerToField(prop({ name: "title" })).type).toBe("text")
  })
})

describe("mapSwaggerToField — derived flags", () => {
  it("password is hidden in list views", () => {
    expect(mapSwaggerToField(prop({ name: "secret", format: "password" })).showInList).toBe(false)
  })
  it("plain text is shown in list views", () => {
    expect(mapSwaggerToField(prop({ name: "title" })).showInList).toBe(true)
  })
  it("validation passes through when present", () => {
    const result = mapSwaggerToField(prop({ name: "code", maxLength: 32, pattern: "^[A-Z]+$" }))
    expect(result.validation).toEqual({
      minLength: undefined,
      maxLength: 32,
      pattern: "^[A-Z]+$",
      min: undefined,
      max: undefined,
    })
  })
})

describe("humanize", () => {
  it("camelCase → Title Case", () => {
    expect(humanize("phoneInfoNumber")).toBe("Phone Info Number")
  })
  it("snake_case → Title Case", () => {
    expect(humanize("customer_name")).toBe("Customer Name")
  })
})
