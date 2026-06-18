import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { restEntity, toRestQuery } from "../crud.adapter"
import { restConfigPort } from "../config.adapter"

/**
 * The REST adapter's job is translation: neutral `CRUDListParams` → REST query
 * conventions, and the REST `{ data, total }` / `/me` shapes → the neutral
 * `Page<T>` / `ApplicationConfig`. These lock that mapping.
 */

let calls: string[]

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
  calls = []
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const url = String(input)
      calls.push(url)
      if (url.includes("/me"))
        return jsonResponse({
          user: { id: "u1", name: "Admin", email: "a@x.io", roles: ["admin"], tenantId: "t1" },
          permissions: ["Orders.View"],
          settings: { Theme: "dark" },
          features: { Chat: "true" },
          roles: ["admin"],
        })
      if (/\/widgets\/\w+/.test(url)) return jsonResponse({ id: 1, name: "Widget" })
      if (url.includes("/widgets")) return jsonResponse({ data: [{ id: 1 }, { id: 2 }], total: 50 })
      return jsonResponse({}, 404)
    }),
  )
})

afterEach(() => vi.unstubAllGlobals())

describe("toRestQuery", () => {
  it("maps pageNumber/pageSize → 1-based _page + _limit", () => {
    expect(toRestQuery({ pageNumber: 2, pageSize: 10 })).toBe("?_page=3&_limit=10")
  })

  it("derives _page from ABP-style skipCount/maxResultCount", () => {
    expect(toRestQuery({ skipCount: 20, maxResultCount: 10 })).toBe("?_page=3&_limit=10")
  })

  it("maps search + sort to REST conventions", () => {
    expect(toRestQuery({ term: "acme", sortBy: "name", sortDirection: "desc" })).toBe("?q=acme&_sort=name&_order=desc")
  })

  it("is empty for empty params", () => {
    expect(toRestQuery()).toBe("")
    expect(toRestQuery({})).toBe("")
  })
})

describe("restEntity list envelope", () => {
  it("maps { data, total } → Page<T> and hits the REST query URL", async () => {
    const svc = restEntity<{ id: number }>("widgets")
    const page = await svc.getList({ pageNumber: 0, pageSize: 10 })
    expect(page).toEqual({ items: [{ id: 1 }, { id: 2 }], totalCount: 50 })
    expect(calls[0]).toContain("/widgets?_page=1&_limit=10")
  })
})

describe("restConfigPort", () => {
  it("maps /me → neutral ApplicationConfig", async () => {
    const cfg = await restConfigPort.getApplicationConfig()
    expect(cfg.permissions).toEqual(["Orders.View"])
    expect(cfg.settings).toEqual({ Theme: "dark" })
    expect(cfg.features).toEqual({ Chat: "true" })
    expect(cfg.roles).toEqual(["admin"])
    expect(cfg.user).toMatchObject({ id: "u1", roles: ["admin"], permissions: ["Orders.View"], tenantId: "t1" })
  })
})
