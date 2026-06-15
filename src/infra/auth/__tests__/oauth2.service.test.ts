/**
 * Tests for the OAuth2 password-grant + refresh-token flows.
 *
 * `fetch` is mocked per-case to avoid hitting MSW or the network — the
 * service formats the request body, picks the right error message out of
 * a few possible response shapes, and retries 5xx exactly once. All
 * three behaviours are verifiable from the mocked fetch's calls.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { login, refreshToken } from "../oauth2.service"

const TOKEN_URL_RE = /\/connect\/token$/

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  })
}

let fetchSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  fetchSpy = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(jsonResponse({ access_token: "a", refresh_token: "r", expires_in: 60, token_type: "Bearer" }))
})

afterEach(() => {
  fetchSpy.mockRestore()
})

describe("login()", () => {
  it("posts a form-encoded password grant to /connect/token", async () => {
    const tokens = await login({ username: "u", password: "p" })
    expect(tokens.access_token).toBe("a")
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, opts] = fetchSpy.mock.calls[0]!
    expect(String(url)).toMatch(TOKEN_URL_RE)
    expect(String((opts as RequestInit).body)).toContain("grant_type=password")
    expect(String((opts as RequestInit).body)).toContain("username=u")
    expect(String((opts as RequestInit).body)).toContain("password=p")
  })

  it("falls back to credentials.email when username is missing", async () => {
    await login({ email: "user@example.com", password: "p" })
    const body = String((fetchSpy.mock.calls[0]![1] as RequestInit).body)
    expect(body).toContain("username=user%40example.com")
  })

  it("retries once on 5xx then returns the body", async () => {
    fetchSpy
      .mockResolvedValueOnce(jsonResponse({ message: "boom" }, { status: 503 }))
      .mockResolvedValueOnce(jsonResponse({ access_token: "after-retry" }))
    const tokens = await login({ username: "u", password: "p" })
    expect(tokens.access_token).toBe("after-retry")
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it("throws using error_description when the server provides one", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({ error: "invalid_grant", error_description: "Bad creds" }, { status: 400 }),
    )
    await expect(login({ username: "u", password: "p" })).rejects.toThrow("Bad creds")
  })

  it("falls back to a generic Server error when the body isn't JSON", async () => {
    // Login retries 5xx once, so both attempts must return the same error
    // for the throw branch to fire — otherwise the retry hits our default
    // success mock and resolves.
    const errResp = () => new Response("oops", { status: 500, statusText: "Server Error" })
    fetchSpy.mockResolvedValueOnce(errResp()).mockResolvedValueOnce(errResp())
    await expect(login({ username: "u", password: "p" })).rejects.toThrow(/Server error/i)
  })
})

describe("refreshToken()", () => {
  it("posts a refresh_token grant", async () => {
    await refreshToken({ refresh_token: "rt" })
    const body = String((fetchSpy.mock.calls[0]![1] as RequestInit).body)
    expect(body).toContain("grant_type=refresh_token")
    expect(body).toContain("refresh_token=rt")
  })

  it("does NOT retry on 5xx (refresh failures should fail fast)", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ message: "x" }, { status: 503 }))
    await expect(refreshToken({ refresh_token: "rt" })).rejects.toThrow()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it("propagates error_description on 4xx", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({ error: "invalid_grant", error_description: "Refresh expired" }, { status: 400 }),
    )
    await expect(refreshToken({ refresh_token: "rt" })).rejects.toThrow("Refresh expired")
  })

  it("falls back to 'Token refresh failed' when the body has neither error_description nor error", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({}, { status: 401 }))
    await expect(refreshToken({ refresh_token: "rt" })).rejects.toThrow(/refresh failed/i)
  })
})
