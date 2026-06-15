/**
 * Smoke tests for the Sentry verification probe.
 *
 * The route's whole point is to throw when called with the right
 * credentials, so the test mirrors that: token mismatch / unset →
 * polite 401/503, mode=captured → 200 + Sentry capture, default mode
 * → throws. We mock Sentry to assert capture/tag calls happen
 * without actually shipping events.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"

const sentry = vi.hoisted(() => ({
  setTag: vi.fn(),
  captureException: vi.fn(),
}))
vi.mock("@sentry/nextjs", () => sentry)

const ORIGINAL_TOKEN = process.env.SENTRY_TEST_TOKEN

beforeEach(() => {
  process.env.SENTRY_TEST_TOKEN = "test-secret"
  sentry.setTag.mockClear()
  sentry.captureException.mockClear()
})

afterEach(() => {
  process.env.SENTRY_TEST_TOKEN = ORIGINAL_TOKEN
})

function req(url: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(`http://localhost${url}`, { headers })
}

describe("GET /api/_test/sentry", () => {
  it("returns 503 when SENTRY_TEST_TOKEN is unset", async () => {
    delete process.env.SENTRY_TEST_TOKEN
    const { GET } = await import("../route")
    const res = await GET(req("/api/_test/sentry"))
    expect(res.status).toBe(503)
  })

  it("returns 401 when the token query param doesn't match", async () => {
    const { GET } = await import("../route")
    const res = await GET(req("/api/_test/sentry?token=wrong"))
    expect(res.status).toBe(401)
  })

  it("captured mode returns 200 and forwards the correlation id as a tag", async () => {
    const { GET } = await import("../route")
    const res = await GET(req("/api/_test/sentry?token=test-secret&mode=captured", { "x-correlation-id": "cid-1" }))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { probe: string; correlationId: string | null; mode: string }
    expect(body.probe).toBe("ok")
    expect(body.mode).toBe("captured")
    expect(body.correlationId).toBe("cid-1")
    expect(sentry.captureException).toHaveBeenCalledTimes(1)
    expect(sentry.setTag).toHaveBeenCalledWith("probe", "sentry-e2e")
    expect(sentry.setTag).toHaveBeenCalledWith("correlation_id", "cid-1")
  })

  it("default (uncaught) mode throws a SentryProbeError", async () => {
    const { GET } = await import("../route")
    await expect(GET(req("/api/_test/sentry?token=test-secret"))).rejects.toThrow(/uncaught mode/)
  })

  it("does not set the correlation tag when the header is absent", async () => {
    const { GET } = await import("../route")
    await GET(req("/api/_test/sentry?token=test-secret&mode=captured"))
    expect(sentry.setTag).toHaveBeenCalledWith("probe", "sentry-e2e")
    const cidCall = sentry.setTag.mock.calls.find(c => c[0] === "correlation_id")
    expect(cidCall).toBeUndefined()
  })
})
