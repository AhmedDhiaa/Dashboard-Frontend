import { describe, it, expect } from "vitest"
import { resolveAbpEndpoint, toAbpListParams, abpParamsSerializer } from "../crud-params"

describe("resolveAbpEndpoint", () => {
  it("mounts a bare resource under /api/app", () => {
    expect(resolveAbpEndpoint("warehouse")).toBe("/api/app/warehouse")
  })

  it("mounts a leading-slash resource under /api/app", () => {
    expect(resolveAbpEndpoint("/warehouse")).toBe("/api/app/warehouse")
  })

  it("passes through absolute /api paths untouched", () => {
    expect(resolveAbpEndpoint("/api/identity/roles")).toBe("/api/identity/roles")
  })

  it("preserves nested resource segments", () => {
    expect(resolveAbpEndpoint("inventory/items")).toBe("/api/app/inventory/items")
  })
})

describe("toAbpListParams", () => {
  it("returns an empty object for undefined params", () => {
    expect(toAbpListParams()).toEqual({})
  })

  it("returns an empty object for empty params", () => {
    expect(toAbpListParams({})).toEqual({})
  })

  it("passes through explicit skipCount / maxResultCount", () => {
    expect(toAbpListParams({ skipCount: 20, maxResultCount: 10 })).toEqual({
      skipCount: 20,
      maxResultCount: 10,
    })
  })

  it("derives skipCount / maxResultCount from pageNumber / pageSize", () => {
    expect(toAbpListParams({ pageNumber: 2, pageSize: 25 })).toEqual({
      skipCount: 50,
      maxResultCount: 25,
    })
  })

  it("defaults page size to 10 when deriving skipCount without pageSize", () => {
    expect(toAbpListParams({ pageNumber: 3 })).toEqual({ skipCount: 30 })
  })

  it("prefers explicit skipCount over pageNumber", () => {
    expect(toAbpListParams({ skipCount: 5, pageNumber: 99, pageSize: 10 })).toMatchObject({
      skipCount: 5,
    })
  })

  it("maps searchKey to ABP `Term` by default", () => {
    expect(toAbpListParams({ searchKey: "acme" })).toEqual({ Term: "acme" })
  })

  it("falls back to `term` for the search value", () => {
    expect(toAbpListParams({ term: "acme" })).toEqual({ Term: "acme" })
  })

  it("honours `searchParam` override (e.g. Role endpoint uses Filter)", () => {
    expect(toAbpListParams({ searchKey: "admin", searchParam: "Filter" })).toEqual({
      Filter: "admin",
    })
  })

  it("uses an explicit `sorting` string verbatim", () => {
    expect(toAbpListParams({ sorting: "name desc" })).toEqual({ Sorting: "name desc" })
  })

  it("builds `Sorting` from sortBy + sortDirection", () => {
    expect(toAbpListParams({ sortBy: "createdAt", sortDirection: "desc" })).toEqual({
      Sorting: "createdAt desc",
    })
  })

  it("defaults sort direction to asc", () => {
    expect(toAbpListParams({ sortBy: "name" })).toEqual({ Sorting: "name asc" })
  })

  it("merges arbitrary custom filters (including arrays for multi-select)", () => {
    expect(toAbpListParams({ pageSize: 10, status: "active", documentStatus: [1, 2] })).toEqual({
      maxResultCount: 10,
      status: "active",
      documentStatus: [1, 2],
    })
  })
})

describe("abpParamsSerializer", () => {
  it("serializes scalar params", () => {
    expect(abpParamsSerializer({ skipCount: 0, maxResultCount: 10 })).toBe("skipCount=0&maxResultCount=10")
  })

  it("repeats keys for array values", () => {
    expect(abpParamsSerializer({ documentStatus: [1, 2] })).toBe("documentStatus=1&documentStatus=2")
  })

  it("skips null and undefined values", () => {
    expect(abpParamsSerializer({ a: 1, b: null, c: undefined })).toBe("a=1")
  })
})
