import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { useBlockData } from "../useBlockData"

// vi.mock factories are hoisted; use vi.hoisted() so the mocks are in scope.
const mocks = vi.hoisted(() => ({
  runDataSourceFetch: vi.fn(),
  resolveSwaggerOperation: vi.fn(),
  ensureEntityConfig: vi.fn(),
  getEntityConfig: vi.fn(),
}))

vi.mock("../data-source.service", () => ({
  runDataSourceFetch: mocks.runDataSourceFetch,
  resolveSwaggerOperation: mocks.resolveSwaggerOperation,
}))

vi.mock("@/core/entities/registry", () => ({
  ensureEntityConfig: mocks.ensureEntityConfig,
  getEntityConfig: mocks.getEntityConfig,
}))

vi.mock("@/infra/observability/error-reporter", () => ({
  errorReporter: { captureException: vi.fn(), captureMessage: vi.fn() },
}))

beforeEach(() => {
  mocks.runDataSourceFetch.mockReset()
  mocks.resolveSwaggerOperation.mockReset()
  mocks.ensureEntityConfig.mockReset()
  mocks.getEntityConfig.mockReset()
})

describe("useBlockData — entity source", () => {
  it("calls service.getList when no params.entityId is present", async () => {
    const getList = vi.fn().mockResolvedValueOnce({ items: [{ id: 1 }, { id: 2 }], totalCount: 2 })
    mocks.ensureEntityConfig.mockResolvedValueOnce(undefined)
    mocks.getEntityConfig.mockReturnValueOnce({ service: { getList, getById: vi.fn() } })

    const { result } = renderHook(() => useBlockData({ type: "entity", entityName: "order" }))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(getList).toHaveBeenCalledOnce()
    expect(result.current.data).toEqual({ items: [{ id: 1 }, { id: 2 }], totalCount: 2 })
    expect(result.current.error).toBeNull()
  })

  it("calls service.getById when params.entityId is present", async () => {
    const getById = vi.fn().mockResolvedValueOnce({ id: 42, name: "X" })
    mocks.ensureEntityConfig.mockResolvedValueOnce(undefined)
    mocks.getEntityConfig.mockReturnValueOnce({ service: { getList: vi.fn(), getById } })

    const { result } = renderHook(() =>
      useBlockData({ type: "entity", entityName: "order" }, { params: { entityId: 42 } }),
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(getById).toHaveBeenCalledWith(42)
    expect(result.current.data).toEqual({ id: 42, name: "X" })
  })

  it("surfaces error when ensureEntityConfig rejects", async () => {
    mocks.ensureEntityConfig.mockRejectedValueOnce(new Error("not registered"))
    const { result } = renderHook(() => useBlockData({ type: "entity", entityName: "ghost" }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error?.message).toBe("not registered")
  })
})

describe("useBlockData — api source", () => {
  it("delegates to runDataSourceFetch with the schema's endpoint+method", async () => {
    mocks.runDataSourceFetch.mockResolvedValueOnce({ ok: true })
    const { result } = renderHook(() =>
      useBlockData({
        type: "api",
        endpoint: "/orders",
        method: "GET",
        itemsPath: "items",
        totalCountPath: "totalCount",
      }),
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mocks.runDataSourceFetch).toHaveBeenCalledOnce()
    const callArg = mocks.runDataSourceFetch.mock.calls[0]![0]
    expect(callArg).toMatchObject({ endpoint: "/orders", method: "GET" })
  })

  it("surfaces fetch errors via state.error", async () => {
    mocks.runDataSourceFetch.mockRejectedValueOnce(new Error("network down"))
    const { result } = renderHook(() =>
      useBlockData({
        type: "api",
        endpoint: "/x",
        method: "GET",
        itemsPath: "items",
        totalCountPath: "totalCount",
      }),
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error?.message).toBe("network down")
    expect(result.current.data).toBeNull()
  })
})

describe("useBlockData — swagger source", () => {
  it("resolves the operation through the proxy and routes through the api branch", async () => {
    mocks.resolveSwaggerOperation.mockResolvedValueOnce({ endpoint: "/api/app/order", method: "GET" })
    mocks.runDataSourceFetch.mockResolvedValueOnce({ items: [{ id: 1 }] })
    const { result } = renderHook(() =>
      useBlockData({
        type: "swagger",
        swaggerUrl: "https://api.example.com/swagger.json",
        operationId: "list_OrderDto",
      }),
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mocks.resolveSwaggerOperation).toHaveBeenCalledOnce()
    expect(mocks.runDataSourceFetch).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: "/api/app/order", method: "GET" }),
    )
    expect(result.current.data).toEqual({ items: [{ id: 1 }] })
  })
})

describe("useBlockData — refetch + enabled", () => {
  it("does not fetch when enabled=false", async () => {
    mocks.runDataSourceFetch.mockResolvedValue({ ok: true })
    renderHook(() =>
      useBlockData(
        { type: "api", endpoint: "/x", method: "GET", itemsPath: "items", totalCountPath: "totalCount" },
        { enabled: false },
      ),
    )
    // Give effects a microtask. Without a tick, even disabled hooks may
    // appear "not yet fetched"; this asserts the fetch never fires.
    await new Promise(r => setTimeout(r, 10))
    expect(mocks.runDataSourceFetch).not.toHaveBeenCalled()
  })

  it("refetch() re-fires the fetcher", async () => {
    mocks.runDataSourceFetch.mockResolvedValue({ ok: true })
    const { result } = renderHook(() =>
      useBlockData({
        type: "api",
        endpoint: "/x",
        method: "GET",
        itemsPath: "items",
        totalCountPath: "totalCount",
      }),
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    await result.current.refetch()
    expect(mocks.runDataSourceFetch).toHaveBeenCalledTimes(2)
  })
})
