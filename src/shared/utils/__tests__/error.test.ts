import { describe, it, expect } from "vitest"
import { extractApiErrorParts } from "../error"

/**
 * Covers every shape the ABP backend (and the axios interceptor) may hand to
 * `extractApiErrorParts(error.details)`, so the toast layer can reliably surface
 * the server's real message + details instead of a generic fallback.
 */
describe("extractApiErrorParts", () => {
  it("reads the ABP envelope { error: { message, details } }", () => {
    expect(
      extractApiErrorParts({
        error: { code: "App:Validation", message: "طلبك غير صحيح!", details: "اسم المستخدم مطلوب" },
      }),
    ).toEqual({ message: "طلبك غير صحيح!", detail: "اسم المستخدم مطلوب" })
  })

  it("reads the inner ABP error object passed directly", () => {
    expect(extractApiErrorParts({ code: "X", message: "Not allowed" })).toEqual({
      message: "Not allowed",
      detail: undefined,
    })
  })

  it("joins validationErrors (array of objects) into the detail", () => {
    expect(
      extractApiErrorParts({
        error: {
          message: "Your request is not valid!",
          validationErrors: [{ message: "Name is required" }, { message: "Email is invalid" }],
        },
      }),
    ).toEqual({ message: "Your request is not valid!", detail: "Name is required · Email is invalid" })
  })

  it("joins validationErrors (array of strings)", () => {
    expect(extractApiErrorParts({ error: { message: "Bad", validationErrors: ["A", "B"] } })).toEqual({
      message: "Bad",
      detail: "A · B",
    })
  })

  it("flattens an ASP.NET ModelState map under `errors`", () => {
    expect(
      extractApiErrorParts({ message: "Validation failed", errors: { Name: ["Required"], Age: ["Too small", "NaN"] } }),
    ).toEqual({ message: "Validation failed", detail: "Required · Too small · NaN" })
  })

  it("prefers the server's human-readable details string over synthesized ones", () => {
    expect(
      extractApiErrorParts({ error: { message: "Bad", details: "Use a stronger password", validationErrors: ["x"] } }),
    ).toEqual({ message: "Bad", detail: "Use a stronger password" })
  })

  it("handles a 500-style message with no details (message only, no detail)", () => {
    expect(extractApiErrorParts({ error: { message: "Internal server error" } })).toEqual({
      message: "Internal server error",
      detail: undefined,
    })
  })

  it("de-duplicates repeated validation messages", () => {
    expect(extractApiErrorParts({ error: { message: "m", validationErrors: ["Dup", "Dup", "Other"] } })).toEqual({
      message: "m",
      detail: "Dup · Other",
    })
  })

  it("returns {} for empty / non-object payloads", () => {
    expect(extractApiErrorParts(null)).toEqual({})
    expect(extractApiErrorParts(undefined)).toEqual({})
    expect(extractApiErrorParts("oops")).toEqual({})
    expect(extractApiErrorParts({})).toEqual({ message: undefined, detail: undefined })
  })
})
