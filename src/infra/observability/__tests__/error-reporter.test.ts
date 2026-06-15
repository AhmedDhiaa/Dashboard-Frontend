/**
 * Tests for the default ErrorReporter.
 *
 * The reporter is the choke point that every "exceptional" error flows
 * through (axios errors, render errors, future Sentry-like adapters). Lock
 * down its contract: never throws, always passes correlation IDs, plays
 * nicely with the unified logger.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { createDefaultErrorReporter } from "../error-reporter"

// Mock the unified logger so we can assert on its calls without polluting
// real console output during the test run.
vi.mock("@/shared/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe("DefaultErrorReporter", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("captureException forwards to logger.error with the error name + message", async () => {
    const { logger } = await import("@/shared/logger")
    const reporter = createDefaultErrorReporter()
    const err = new Error("boom")

    reporter.captureException(err)

    expect(logger.error).toHaveBeenCalledTimes(1)
    const [msg, ctx] = vi.mocked(logger.error).mock.calls[0]!
    expect(msg).toContain("Error: boom")
    expect(ctx).toMatchObject({ stack: expect.any(String) })
  })

  it("includes correlationId in the logger payload when supplied", async () => {
    const { logger } = await import("@/shared/logger")
    const reporter = createDefaultErrorReporter()

    reporter.captureException(new Error("x"), { correlationId: "abc123" })

    const [, ctx] = vi.mocked(logger.error).mock.calls[0]!
    expect(ctx).toMatchObject({ correlationId: "abc123" })
  })

  it("captureMessage forwards to logger.warn", async () => {
    const { logger } = await import("@/shared/logger")
    const reporter = createDefaultErrorReporter()

    reporter.captureMessage("test event", {
      correlationId: "deadbeef",
      tags: { source: "unit-test" },
    })

    expect(logger.warn).toHaveBeenCalledTimes(1)
    const [msg, ctx] = vi.mocked(logger.warn).mock.calls[0]!
    expect(msg).toContain("test event")
    expect(ctx).toMatchObject({
      correlationId: "deadbeef",
      tags: { source: "unit-test" },
    })
  })

  it("handles non-Error values without throwing", () => {
    const reporter = createDefaultErrorReporter()
    expect(() => reporter.captureException("just a string")).not.toThrow()
    expect(() => reporter.captureException(42)).not.toThrow()
    expect(() => reporter.captureException({ shape: "object" })).not.toThrow()
    expect(() => reporter.captureException(null)).not.toThrow()
  })

  it("does not throw if the configured fetch endpoint rejects", async () => {
    // Stand up a fetch that always rejects, simulating a broken endpoint.
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("network down"))),
    )
    // The endpoint is read at construction time, so we have to override
    // the env var BEFORE constructing the reporter.
    vi.stubEnv("NEXT_PUBLIC_ERROR_REPORT_ENDPOINT", "https://reports.example.test/in")

    const reporter = createDefaultErrorReporter()
    expect(() => reporter.captureException(new Error("boom"))).not.toThrow()

    // Give the fire-and-forget promise a tick to settle.
    await new Promise(resolve => setTimeout(resolve, 0))
  })

  it("POSTs structured payload to the configured endpoint", async () => {
    const fetchMock = vi.fn((_url: string, _init?: RequestInit) => Promise.resolve(new Response(null, { status: 200 })))
    vi.stubGlobal("fetch", fetchMock)
    vi.stubEnv("NEXT_PUBLIC_ERROR_REPORT_ENDPOINT", "https://reports.example.test/in")

    const reporter = createDefaultErrorReporter()
    reporter.captureException(new Error("boom"), { correlationId: "xyz" })

    // Allow microtask queue to flush.
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const call = fetchMock.mock.calls[0]
    expect(call).toBeDefined()
    const [url, init] = call!
    expect(url).toBe("https://reports.example.test/in")
    expect(init).toMatchObject({
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
    })
    const body = JSON.parse(init!.body as string)
    expect(body).toMatchObject({
      kind: "exception",
      name: "Error",
      message: "boom",
      correlationId: "xyz",
    })
  })

  it("does not POST when no endpoint is configured", async () => {
    const fetchMock = vi.fn((_url: string, _init?: RequestInit) => Promise.resolve(new Response()))
    vi.stubGlobal("fetch", fetchMock)
    vi.stubEnv("NEXT_PUBLIC_ERROR_REPORT_ENDPOINT", "")

    const reporter = createDefaultErrorReporter()
    reporter.captureException(new Error("boom"))

    await new Promise(resolve => setTimeout(resolve, 0))
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
