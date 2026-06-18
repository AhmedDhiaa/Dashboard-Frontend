import { beforeEach, afterEach, vi } from "vitest"
import { runAuthPortContract, runEnumPortContract } from "@/shared/test-utils/port-contracts"
import { restAuthPort } from "../auth.adapter"
import { restEnumPort } from "../enum.adapter"

/**
 * The reference REST adapter must satisfy the SAME neutral port contracts as ABP
 * and mock — proof the seam is genuinely backend-agnostic. A stubbed `fetch`
 * stands in for the REST backend (no network).
 */

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status < 400,
    status,
    statusText: "OK",
    text: async () => JSON.stringify(body),
    headers: new Headers(),
  } as unknown as Response
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const url = String(input)
      if (url.endsWith("/auth/login") || url.endsWith("/auth/refresh"))
        return jsonResponse({ token: "rest-access-token", refreshToken: "rest-refresh-token", expiresIn: 3600 })
      if (url.includes("/auth/forgot-password") || url.includes("/auth/reset-password")) return jsonResponse({})
      if (url.includes("/enums/status")) return jsonResponse([{ id: 1, name: "New", foreignName: "جديد" }])
      if (url.includes("/enums/")) return jsonResponse([])
      return jsonResponse({}, 404)
    }),
  )
})

afterEach(() => vi.unstubAllGlobals())

runAuthPortContract("rest", () => restAuthPort)
runEnumPortContract("rest", () => restEnumPort)
