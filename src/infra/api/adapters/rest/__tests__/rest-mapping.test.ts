import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { restEntity, toRestQuery } from "../crud.adapter"
import { restConfigPort } from "../config.adapter"
import { restEnumPort } from "../enum.adapter"

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
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = String(input)
      const method = init?.method ?? "GET"
      calls.push(`${method} ${url}`)
      if (url.includes("/me"))
        return jsonResponse({
          user: { id: "u1", name: "Admin", email: "a@x.io", roles: ["admin"], tenantId: "t1" },
          permissions: ["Orders.View"],
          settings: { Theme: "dark" },
          features: { Chat: "true" },
          roles: ["admin"],
        })
      if (url.includes("/enums/")) return jsonResponse(null) // exercises the `?? []` fallback
      if (/\/widgets\/[\w-]+/.test(url)) return jsonResponse({ id: 1, name: "Widget" }) // getById/update/delete
      if (url.includes("/widgets") && method === "POST") return jsonResponse({ id: 99, name: "Created" })
      if (url.includes("/widgets")) return jsonResponse({ data: [{ id: 1 }, { id: 2 }], total: 50 }) // list/autocomplete
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

describe("restEntity CRUD", () => {
  it("getList maps { data, total } → Page<T> and hits the REST query URL", async () => {
    const svc = restEntity<{ id: number }>("widgets")
    const page = await svc.getList({ pageNumber: 0, pageSize: 10 })
    expect(page).toEqual({ items: [{ id: 1 }, { id: 2 }], totalCount: 50 })
    expect(calls[0]).toContain("GET /widgets?_page=1&_limit=10")
  })

  it("getById GETs /{resource}/{id}", async () => {
    const svc = restEntity<{ id: number; name: string }>("widgets")
    expect(await svc.getById(1)).toEqual({ id: 1, name: "Widget" })
    expect(calls[0]).toContain("GET /widgets/1")
  })

  it("create POSTs the payload to the collection", async () => {
    const svc = restEntity<{ id: number; name: string }>("widgets")
    expect(await svc.create({ name: "X" })).toEqual({ id: 99, name: "Created" })
    expect(calls[0]).toContain("POST /widgets")
  })

  it("update PUTs to /{resource}/{id}", async () => {
    const svc = restEntity<{ id: number; name: string }>("widgets")
    await svc.update(1, { name: "Y" })
    expect(calls[0]).toContain("PUT /widgets/1")
  })

  it("delete DELETEs /{resource}/{id}", async () => {
    const svc = restEntity<{ id: number }>("widgets")
    await svc.delete(1)
    expect(calls[0]).toContain("DELETE /widgets/1")
  })

  it("autocomplete unwraps the list envelope to an array", async () => {
    const svc = restEntity<{ id: number }>("widgets")
    expect(await svc.autocomplete({ term: "a", maxResultCount: 5 })).toEqual([{ id: 1 }, { id: 2 }])
    expect(calls[0]).toContain("q=a")
  })
})

describe("restEnumPort fallback", () => {
  it("returns [] when the backend yields null", async () => {
    expect(await restEnumPort.getEnumValues("status")).toEqual([])
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
