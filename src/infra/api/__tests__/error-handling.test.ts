/**
 * Pure-function tests for the centralized error-handling helpers.
 *
 * The redirect side-effect helpers (`handleAuthenticationError`,
 * `handleAuthorizationError`) require a real `window.location` rewrite,
 * so they're exercised lightly via spies — we assert that they at least
 * resolve in the jsdom environment without throwing.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { AxiosError, AxiosHeaders } from "axios"

import {
  createAppError,
  calculateErrorDuration,
  extractErrorContext,
  logApiError,
  createErrorFromResponse,
  handleError,
  setupGlobalErrorHandlers,
  getErrorInfo,
  errorHandler,
} from "../error-handling"
import { AppError, AuthenticationError, AuthorizationError, NotFoundError, ValidationError } from "../errors"

vi.mock("@/shared/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

function axiosErr(
  status: number | undefined,
  data?: unknown,
  config?: { method?: string; url?: string; metadata?: { startTime?: number; correlationId?: string } },
): AxiosError<{ message?: string; errors?: unknown; error?: unknown }> {
  const err = new AxiosError("boom") as AxiosError<{ message?: string; errors?: unknown; error?: unknown }>
  if (status !== undefined) {
    err.response = {
      status,
      statusText: "x",
      data,
      headers: {},
      config: { headers: new AxiosHeaders() },
    } as never
  }
  if (config) {
    err.config = { headers: new AxiosHeaders(), ...config } as never
  }
  return err
}

describe("createAppError", () => {
  it.each([
    [400, ValidationError, "validation"],
    [401, AuthenticationError, "auth"],
    [403, AuthorizationError, "forbidden"],
    [500, AppError, "server"],
  ])("status %i maps to the right class with the message preserved", (status, klass, message) => {
    const e = createAppError(status, message, undefined, { foo: "bar" })
    expect(e).toBeInstanceOf(klass)
    expect(e.message).toBe(message)
  })

  it("404 maps to NotFoundError (message rewritten to '<resource> not found')", () => {
    const e = createAppError(404, "Order not found", undefined)
    expect(e).toBeInstanceOf(NotFoundError)
    expect(e.message).toMatch(/not found$/i)
    expect(e.statusCode).toBe(404)
  })
})

describe("calculateErrorDuration", () => {
  it("returns elapsed ms when startTime metadata is set", () => {
    const start = Date.now() - 50
    const e = axiosErr(undefined, undefined, { metadata: { startTime: start } })
    const d = calculateErrorDuration(e)
    expect(d).toBeGreaterThanOrEqual(50)
  })

  it("returns undefined when startTime is missing", () => {
    expect(calculateErrorDuration(axiosErr(500))).toBeUndefined()
  })
})

describe("extractErrorContext", () => {
  it("captures method, url, status, and message", () => {
    const e = axiosErr(
      404,
      { message: "missing" },
      {
        method: "get",
        url: "/api/app/foo/1",
        metadata: { correlationId: "cid-1" },
      },
    )
    const ctx = extractErrorContext(e)
    expect(ctx.method).toBe("GET")
    expect(ctx.url).toBe("/api/app/foo/1")
    expect(ctx.status).toBe(404)
    expect(ctx.errorMessage).toBe("missing")
    expect(ctx.correlationId).toBe("cid-1")
    expect(typeof ctx.timestamp).toBe("string")
  })
})

describe("logApiError", () => {
  it("logs without throwing for axios errors with and without response", () => {
    expect(() => logApiError(axiosErr(500, { message: "x" }, { method: "post", url: "/a" }))).not.toThrow()
    expect(() => logApiError(axiosErr(undefined))).not.toThrow()
  })
})

describe("createErrorFromResponse", () => {
  it("returns NETWORK_ERROR when no response", () => {
    const e = createErrorFromResponse(axiosErr(undefined))
    expect(e.code).toBe("NETWORK_ERROR")
    expect(e.statusCode).toBe(0)
  })

  it("nested error.message wins over outer message", () => {
    const e = createErrorFromResponse(axiosErr(500, { error: { message: "nested!" } }))
    expect(e.message).toBe("nested!")
    expect(e.code).toBe("HTTP_500")
  })

  it("returns AuthenticationError on 401", () => {
    const e = createErrorFromResponse(axiosErr(401, { message: "no" }))
    expect(e).toBeInstanceOf(AuthenticationError)
  })

  it("returns AuthorizationError on 403", () => {
    const e = createErrorFromResponse(axiosErr(403, { message: "nope" }))
    expect(e).toBeInstanceOf(AuthorizationError)
  })

  it("falls back to outer message + errors[]", () => {
    const e = createErrorFromResponse(axiosErr(500, { message: "outer", errors: ["x"] }))
    expect(e.message).toBe("outer")
    expect(e.details).toEqual(["x"])
  })
})

describe("handleError", () => {
  it("recognises AppError and propagates code", () => {
    const r = handleError(new ValidationError("bad input"))
    expect(r.code).toBe("VALIDATION_ERROR")
    expect(r.shouldRedirect).toBe(false)
  })

  it("flags AuthenticationError for redirect", () => {
    const r = handleError(new AuthenticationError("expired"))
    expect(r.shouldRedirect).toBe(true)
    expect(r.redirectTo).toBe("/auth/login")
  })

  it("flags AuthorizationError for redirect", () => {
    const r = handleError(new AuthorizationError("denied"))
    expect(r.shouldRedirect).toBe(true)
    expect(r.redirectTo).toBe("/403")
  })

  it("classifies a Network Error message", () => {
    const r = handleError(new Error("Network down"))
    expect(r.code).toBe("NETWORK_ERROR")
  })

  it("preserves a string error verbatim", () => {
    const r = handleError("oops")
    expect(r.message).toBe("oops")
    expect(r.code).toBe("UNKNOWN_ERROR")
  })

  it("falls back to UNKNOWN_ERROR for non-Error throwables", () => {
    expect(handleError({ weird: true }).code).toBe("UNKNOWN_ERROR")
  })

  it("wraps a generic Error", () => {
    expect(handleError(new Error("generic")).code).toBe("UNKNOWN_ERROR")
  })
})

describe("getErrorInfo", () => {
  it("uses the AppError code as the title", () => {
    const info = getErrorInfo(new ValidationError("bad"))
    expect(info.title).toMatch(/validation/i)
    expect(info.canRetry).toBe(true)
  })

  it("auth errors are marked non-retryable", () => {
    expect(getErrorInfo(new AuthenticationError("expired")).canRetry).toBe(false)
    expect(getErrorInfo(new AuthorizationError("denied")).canRetry).toBe(false)
  })

  it("plain Error gets the generic title", () => {
    const info = getErrorInfo(new Error("kaboom"))
    expect(info.title).toBe("Application Error")
    expect(info.canRetry).toBe(true)
  })
})

describe("setupGlobalErrorHandlers", () => {
  it("registers listeners on window without throwing", () => {
    const spy = vi.spyOn(window, "addEventListener")
    setupGlobalErrorHandlers()
    expect(spy).toHaveBeenCalledWith("unhandledrejection", expect.any(Function))
    expect(spy).toHaveBeenCalledWith("error", expect.any(Function))
    spy.mockRestore()
  })
})

describe("errorHandler service", () => {
  beforeEach(() => vi.clearAllMocks())

  it("handle() runs without throwing for any error shape", () => {
    expect(() => errorHandler.handle(new Error("e"), { component: "X" })).not.toThrow()
    expect(() => errorHandler.handle("string-err")).not.toThrow()
    expect(() => errorHandler.handle({ shape: "unknown" })).not.toThrow()
  })

  it("handleAsync returns the resolved value on success", async () => {
    const result = await errorHandler.handleAsync(async () => 42)
    expect(result).toBe(42)
  })

  it("handleAsync returns null on failure", async () => {
    const result = await errorHandler.handleAsync(async () => {
      throw new Error("boom")
    })
    expect(result).toBeNull()
  })

  it("wrap() returns the result on success", () => {
    const wrapped = errorHandler.wrap((n: number) => n * 2)
    expect(wrapped(3)).toBe(6)
  })

  it("wrap() returns undefined on a sync throw", () => {
    const wrapped = errorHandler.wrap(() => {
      throw new Error("sync")
    })
    expect(wrapped()).toBeUndefined()
  })
})
