/**
 * Tests for the /api/health readiness probe.
 *
 * Each test runs with a fresh sandbox cwd so the storage probe writes its
 * `.health-probe-*` file under a temp `messages/_overrides/` we control,
 * never the real source tree. The backend probe is driven by mocking
 * `fetch` per case (success, non-2xx, network error, missing API_URL).
 *
 * Body contract (deliberately narrow): `{ status, checks: { backend, storage } }`.
 * Tests assert that no extra fields leak through — stack traces and env
 * values stay on the server.
 */

import { mkdtempSync, rmSync, mkdirSync, readdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

type HealthBody = {
  status: "ok" | "degraded" | "down"
  checks: { backend: "ok" | "fail"; storage: "ok" | "fail" }
}

const ORIGINAL_CWD = process.cwd()
const ORIGINAL_API_URL = process.env.API_URL
let sandbox: string
let fetchSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), "health-test-"))
  process.chdir(sandbox)
  process.env.API_URL = "https://api.test.local"
  // Drop any cached evaluation that captured the prior cwd via STORAGE_DIR.
  vi.resetModules()
  fetchSpy = vi.spyOn(globalThis, "fetch")
})

afterEach(() => {
  fetchSpy.mockRestore()
  process.chdir(ORIGINAL_CWD)
  process.env.API_URL = ORIGINAL_API_URL
  rmSync(sandbox, { recursive: true, force: true })
})

async function callRoute() {
  const mod = await import("../route")
  return mod.GET()
}

async function jsonBody(res: Response): Promise<HealthBody> {
  return res.json() as Promise<HealthBody>
}

describe("GET /api/health", () => {
  it("returns 200 with both checks ok when backend responds 200 and storage is writable", async () => {
    fetchSpy.mockResolvedValue(new Response("{}", { status: 200 }))
    const res = await callRoute()
    expect(res.status).toBe(200)
    const body = await jsonBody(res)
    expect(body).toEqual({ status: "ok", checks: { backend: "ok", storage: "ok" } })
    // Body must contain ONLY the two declared keys — no env values, no
    // version, no timestamps, no diagnostic addendum.
    expect(Object.keys(body).sort()).toEqual(["checks", "status"])
    expect(Object.keys(body.checks).sort()).toEqual(["backend", "storage"])
  })

  it("calls the ABP application-configuration endpoint specifically", async () => {
    fetchSpy.mockResolvedValue(new Response("{}", { status: 200 }))
    await callRoute()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy.mock.calls[0]?.[0]).toBe("https://api.test.local/api/abp/application-configuration")
    const init = fetchSpy.mock.calls[0]?.[1]
    expect(init?.method).toBe("GET")
    expect(init?.cache).toBe("no-store")
    // AbortSignal must be present so a hung backend doesn't hold the route.
    expect(init?.signal).toBeInstanceOf(AbortSignal)
  })

  it("returns 503 with backend:'fail' on a non-2xx response", async () => {
    fetchSpy.mockResolvedValue(new Response("server error", { status: 500 }))
    const res = await callRoute()
    expect(res.status).toBe(503)
    const body = await jsonBody(res)
    expect(body.status).toBe("down")
    expect(body.checks.backend).toBe("fail")
  })

  it("returns 503 with backend:'fail' on a network error and never leaks the message", async () => {
    fetchSpy.mockRejectedValue(new Error("ECONNREFUSED 10.0.0.1:443"))
    const res = await callRoute()
    expect(res.status).toBe(503)
    const body = await jsonBody(res)
    expect(body.checks.backend).toBe("fail")
    // Error message must NOT leak into the response.
    expect(JSON.stringify(body)).not.toContain("ECONNREFUSED")
  })

  it("returns 503 with backend:'fail' when API_URL is unset (no surprise success)", async () => {
    delete process.env.API_URL
    const res = await callRoute()
    expect(res.status).toBe(503)
    const body = await jsonBody(res)
    expect(body.checks.backend).toBe("fail")
    // We must not have attempted a fetch with an empty URL.
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("reports backend:'ok' WITHOUT a fetch in standalone mock mode", async () => {
    // In mock mode there is no upstream to reach — every request is served
    // from seeded data — so the probe must not 503 (which would pull the
    // container out of the LB pool forever) and must not even attempt a fetch.
    process.env.NEXT_PUBLIC_USE_MOCK_API = "true"
    try {
      const res = await callRoute()
      expect(res.status).toBe(200)
      const body = await jsonBody(res)
      expect(body).toEqual({ status: "ok", checks: { backend: "ok", storage: "ok" } })
      expect(fetchSpy).not.toHaveBeenCalled()
    } finally {
      delete process.env.NEXT_PUBLIC_USE_MOCK_API
    }
  })

  it("stays READY (200 'degraded') when storage is unwritable but the backend is up", async () => {
    // Storage is advisory: a read-only-rootfs deploy can't write the override
    // volume, but the app still serves — so readiness must NOT 503 on it.
    fetchSpy.mockResolvedValue(new Response("{}", { status: 200 }))
    // Pre-create the overrides path AS A FILE so mkdir({recursive}) fails
    // with EEXIST/ENOTDIR — same trick used in the audit-storage tests.
    mkdirSync(join(sandbox, "messages"), { recursive: true })
    writeFileSync(join(sandbox, "messages", "_overrides"), "i am a file")

    const res = await callRoute()
    expect(res.status).toBe(200)
    const body = await jsonBody(res)
    expect(body.status).toBe("degraded")
    expect(body.checks.backend).toBe("ok")
    expect(body.checks.storage).toBe("fail")
  })

  it("storage probe cleans up its .health-probe file on success", async () => {
    fetchSpy.mockResolvedValue(new Response("{}", { status: 200 }))
    await callRoute()
    // After the probe, the overrides directory should have NO
    // .health-probe-* file left behind.
    const dir = join(sandbox, "messages", "_overrides")
    const entries = readdirSync(dir).filter(n => n.startsWith(".health-probe"))
    expect(entries).toEqual([])
  })

  it("returns 503 'down' when the backend is unreachable (regardless of storage)", async () => {
    fetchSpy.mockRejectedValue(new Error("net down"))
    mkdirSync(join(sandbox, "messages"), { recursive: true })
    writeFileSync(join(sandbox, "messages", "_overrides"), "i am a file")

    const res = await callRoute()
    expect(res.status).toBe(503)
    expect(await jsonBody(res)).toEqual({
      status: "down",
      checks: { backend: "fail", storage: "fail" },
    })
  })

  it("sets Cache-Control: no-store so an upstream proxy can't pin a stale 200", async () => {
    fetchSpy.mockResolvedValue(new Response("{}", { status: 200 }))
    const res = await callRoute()
    expect(res.headers.get("Cache-Control")).toContain("no-store")
  })
})
