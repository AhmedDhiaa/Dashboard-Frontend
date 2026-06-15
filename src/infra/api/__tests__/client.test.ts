/* eslint-disable max-lines-per-function */
import { describe, it, expect } from "vitest"
import { buildQueryParams } from "../client"

describe("buildQueryParams", () => {
  it("should build query params from object", () => {
    const params = {
      page: 1,
      size: 10,
      search: "test",
    }

    const result = buildQueryParams(params)

    expect(result.toString()).toBe("page=1&size=10&search=test")
  })

  it("should skip undefined values", () => {
    const params = {
      page: 1,
      size: undefined,
      search: "test",
    }

    const result = buildQueryParams(params)

    expect(result.toString()).toBe("page=1&search=test")
    expect(result.has("size")).toBe(false)
  })

  it("should skip null values", () => {
    const params = {
      page: 1,
      size: null,
      search: "test",
    }

    const result = buildQueryParams(params)

    expect(result.toString()).toBe("page=1&search=test")
    expect(result.has("size")).toBe(false)
  })

  it("should skip empty string values", () => {
    const params = {
      page: 1,
      search: "",
      filter: "active",
    }

    const result = buildQueryParams(params)

    expect(result.toString()).toBe("page=1&filter=active")
    expect(result.has("search")).toBe(false)
  })

  it("should convert numbers to strings", () => {
    const params = {
      page: 1,
      size: 20,
      count: 0,
    }

    const result = buildQueryParams(params)

    expect(result.get("page")).toBe("1")
    expect(result.get("size")).toBe("20")
    expect(result.get("count")).toBe("0")
  })

  it("should convert booleans to strings", () => {
    const params = {
      active: true,
      deleted: false,
    }

    const result = buildQueryParams(params)

    expect(result.get("active")).toBe("true")
    expect(result.get("deleted")).toBe("false")
  })

  it("should handle empty object", () => {
    const result = buildQueryParams({})

    expect(result.toString()).toBe("")
  })

  it("should handle special characters in values", () => {
    const params = {
      search: "test & value",
      filter: "name=John",
    }

    const result = buildQueryParams(params)

    expect(result.get("search")).toBe("test & value")
    expect(result.get("filter")).toBe("name=John")
  })

  it("should handle array-like string values", () => {
    const params = {
      ids: "1,2,3",
      tags: "tag1,tag2",
    }

    const result = buildQueryParams(params)

    expect(result.get("ids")).toBe("1,2,3")
    expect(result.get("tags")).toBe("tag1,tag2")
  })

  it("should handle all parameter types together", () => {
    const params = {
      page: 1,
      active: true,
      search: "test",
      empty: "",
      undef: undefined,
      nil: null,
      zero: 0,
    }

    const result = buildQueryParams(params)

    expect(result.has("page")).toBe(true)
    expect(result.has("active")).toBe(true)
    expect(result.has("search")).toBe(true)
    expect(result.has("empty")).toBe(false)
    expect(result.has("undef")).toBe(false)
    expect(result.has("nil")).toBe(false)
    expect(result.has("zero")).toBe(true)
    expect(result.get("zero")).toBe("0")
  })

  it("should preserve parameter order", () => {
    const params = {
      a: "first",
      b: "second",
      c: "third",
    }

    const result = buildQueryParams(params)

    expect(result.toString()).toBe("a=first&b=second&c=third")
  })

  it("should handle numeric zero correctly", () => {
    const params = {
      count: 0,
      page: 0,
      offset: 0,
    }

    const result = buildQueryParams(params)

    expect(result.get("count")).toBe("0")
    expect(result.get("page")).toBe("0")
    expect(result.get("offset")).toBe("0")
  })

  it("should handle boolean false correctly", () => {
    const params = {
      active: false,
      deleted: false,
      enabled: false,
    }

    const result = buildQueryParams(params)

    expect(result.get("active")).toBe("false")
    expect(result.get("deleted")).toBe("false")
    expect(result.get("enabled")).toBe("false")
  })

  it("should URL encode special characters", () => {
    const params = {
      search: "test+value",
      filter: "id>100",
    }

    const result = buildQueryParams(params)

    // URLSearchParams handles encoding automatically
    expect(result.get("search")).toBe("test+value")
    expect(result.get("filter")).toBe("id>100")
  })

  it("should handle very long strings", () => {
    const longString = "a".repeat(1000)
    const params = {
      longValue: longString,
    }

    const result = buildQueryParams(params)

    expect(result.get("longValue")).toBe(longString)
  })

  it("should handle unicode characters", () => {
    const params = {
      search: "测试",
      name: "مرحبا",
      greeting: "👋",
    }

    const result = buildQueryParams(params)

    expect(result.get("search")).toBe("测试")
    expect(result.get("name")).toBe("مرحبا")
    expect(result.get("greeting")).toBe("👋")
  })

  it("should handle mixed type values", () => {
    const params = {
      str: "hello",
      num: 42,
      bool: true,
      zero: 0,
      falsy: false,
    }

    const result = buildQueryParams(params)

    expect(result.get("str")).toBe("hello")
    expect(result.get("num")).toBe("42")
    expect(result.get("bool")).toBe("true")
    expect(result.get("zero")).toBe("0")
    expect(result.get("falsy")).toBe("false")
  })
})
