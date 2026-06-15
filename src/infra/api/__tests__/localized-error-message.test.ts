import { describe, it, expect, vi } from "vitest"
import {
  AppError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
  getErrorTranslationKey,
  getLocalizedErrorMessage,
} from "../errors"

const t = (key: string) => `T:${key}`

describe("getErrorTranslationKey", () => {
  it("maps NETWORK_ERROR → network_error", () => {
    expect(getErrorTranslationKey(new AppError("x", "NETWORK_ERROR", 0))).toBe("network_error")
  })

  it("maps AuthenticationError → unauthorized", () => {
    expect(getErrorTranslationKey(new AuthenticationError())).toBe("unauthorized")
  })

  it("maps AuthorizationError → forbidden", () => {
    expect(getErrorTranslationKey(new AuthorizationError())).toBe("forbidden")
  })

  it("maps NotFoundError → not_found", () => {
    expect(getErrorTranslationKey(new NotFoundError("Order"))).toBe("not_found")
  })

  it("maps ValidationError → validation_failed", () => {
    expect(getErrorTranslationKey(new ValidationError("Bad input"))).toBe("validation_failed")
  })

  it("maps 5xx AppError → server_error", () => {
    expect(getErrorTranslationKey(new AppError("Boom", "HTTP_500", 500))).toBe("server_error")
    expect(getErrorTranslationKey(new AppError("Bad gateway", "HTTP_502", 502))).toBe("server_error")
  })

  it("returns null for non-AppError values", () => {
    expect(getErrorTranslationKey(new Error("plain"))).toBeNull()
    expect(getErrorTranslationKey("string-error")).toBeNull()
    expect(getErrorTranslationKey(undefined)).toBeNull()
  })
})

describe("getLocalizedErrorMessage", () => {
  it("translates known error codes through the supplied t function", () => {
    expect(getLocalizedErrorMessage(new AuthenticationError(), t)).toBe("T:unauthorized")
  })

  it("falls back to the embedded message for unmapped errors", () => {
    expect(getLocalizedErrorMessage(new Error("custom message"), t)).toBe("custom message")
  })

  it("falls back to a generic message when error has no readable shape", () => {
    const spy = vi.fn(t)
    const result = getLocalizedErrorMessage(undefined, spy)
    // unmapped — caller fallback chain runs without consulting `t`
    expect(spy).not.toHaveBeenCalled()
    expect(typeof result).toBe("string")
    expect(result.length).toBeGreaterThan(0)
  })
})
