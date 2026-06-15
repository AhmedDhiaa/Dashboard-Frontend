import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { BaseCRUDService } from "../crud-service"
import { apiClient } from "../client"
import type { PaginatedResponse } from "../client"

// Mock the api client
vi.mock("../client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

interface TestEntity {
  id: number
  name: string
  description?: string
}

describe("BaseCRUDService", () => {
  let service: BaseCRUDService<TestEntity>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockApiClient = apiClient as any // Test mock - mocked API client

  beforeEach(() => {
    vi.clearAllMocks()
    service = new BaseCRUDService<TestEntity>("test-entity")
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("getList", () => {
    const mockResponse: PaginatedResponse<TestEntity> = {
      items: [
        { id: 1, name: "Test 1" },
        { id: 2, name: "Test 2" },
      ],
      totalCount: 2,
    }

    it("should fetch list without parameters", async () => {
      mockApiClient.get.mockResolvedValue({ data: mockResponse })

      const result = await service.getList()

      expect(mockApiClient.get).toHaveBeenCalledWith("/api/app/test-entity", expect.objectContaining({ params: {} }))
      expect(result).toEqual(mockResponse)
    })

    it("should normalize pageNumber to skipCount", async () => {
      mockApiClient.get.mockResolvedValue({ data: mockResponse })

      await service.getList({ pageNumber: 20, pageSize: 10 })

      // pageNumber * pageSize = skipCount (ABP convention)
      expect(mockApiClient.get).toHaveBeenCalledWith(
        "/api/app/test-entity",
        expect.objectContaining({ params: { skipCount: 200, maxResultCount: 10 } }),
      )
    })

    it("should normalize pageSize to maxResultCount", async () => {
      mockApiClient.get.mockResolvedValue({ data: mockResponse })

      await service.getList({ pageSize: 25 })

      expect(mockApiClient.get).toHaveBeenCalledWith(
        "/api/app/test-entity",
        expect.objectContaining({ params: { maxResultCount: 25 } }),
      )
    })

    it("should prefer skipCount over pageNumber", async () => {
      mockApiClient.get.mockResolvedValue({ data: mockResponse })

      await service.getList({ skipCount: 30, pageNumber: 20 })

      expect(mockApiClient.get).toHaveBeenCalledWith(
        "/api/app/test-entity",
        expect.objectContaining({ params: { skipCount: 30 } }),
      )
    })

    it("should prefer maxResultCount over pageSize", async () => {
      mockApiClient.get.mockResolvedValue({ data: mockResponse })

      await service.getList({ maxResultCount: 50, pageSize: 25 })

      expect(mockApiClient.get).toHaveBeenCalledWith(
        "/api/app/test-entity",
        expect.objectContaining({ params: { maxResultCount: 50 } }),
      )
    })

    it("should map searchKey to ABP Term", async () => {
      mockApiClient.get.mockResolvedValue({ data: mockResponse })

      await service.getList({ searchKey: "test search" })

      expect(mockApiClient.get).toHaveBeenCalledWith(
        "/api/app/test-entity",
        expect.objectContaining({ params: { Term: "test search" } }),
      )
    })

    it("should map term to ABP Term", async () => {
      mockApiClient.get.mockResolvedValue({ data: mockResponse })

      await service.getList({ term: "search term" })

      expect(mockApiClient.get).toHaveBeenCalledWith(
        "/api/app/test-entity",
        expect.objectContaining({ params: { Term: "search term" } }),
      )
    })

    it("should map searchKey to a custom searchParam (Role uses Filter) and not forward searchParam", async () => {
      mockApiClient.get.mockResolvedValue({ data: mockResponse })

      await service.getList({ searchKey: "admin", searchParam: "Filter" })

      expect(mockApiClient.get).toHaveBeenCalledWith(
        "/api/app/test-entity",
        expect.objectContaining({ params: { Filter: "admin" } }),
      )
    })

    it("should map sortBy and sortDirection to ABP Sorting", async () => {
      mockApiClient.get.mockResolvedValue({ data: mockResponse })

      await service.getList({ sortBy: "name", sortDirection: "desc" })

      expect(mockApiClient.get).toHaveBeenCalledWith(
        "/api/app/test-entity",
        expect.objectContaining({ params: { Sorting: "name desc" } }),
      )
    })

    it("should default sort direction to asc when only sortBy is given", async () => {
      mockApiClient.get.mockResolvedValue({ data: mockResponse })

      await service.getList({ sortBy: "name" })

      expect(mockApiClient.get).toHaveBeenCalledWith(
        "/api/app/test-entity",
        expect.objectContaining({ params: { Sorting: "name asc" } }),
      )
    })

    it("should pass an explicit sorting string through as ABP Sorting", async () => {
      mockApiClient.get.mockResolvedValue({ data: mockResponse })

      await service.getList({ sorting: "name desc" })

      expect(mockApiClient.get).toHaveBeenCalledWith(
        "/api/app/test-entity",
        expect.objectContaining({ params: { Sorting: "name desc" } }),
      )
    })

    it("should handle all parameters together (ABP-mapped)", async () => {
      mockApiClient.get.mockResolvedValue({ data: mockResponse })

      await service.getList({
        skipCount: 10,
        maxResultCount: 20,
        searchKey: "search",
        term: "term",
        sortBy: "name",
        sortDirection: "asc",
        sorting: "name asc",
      })

      // searchKey wins over term; explicit sorting wins over sortBy/sortDirection.
      expect(mockApiClient.get).toHaveBeenCalledWith(
        "/api/app/test-entity",
        expect.objectContaining({
          params: {
            skipCount: 10,
            maxResultCount: 20,
            Term: "search",
            Sorting: "name asc",
          },
        }),
      )
    })

    it("should handle empty result set", async () => {
      const emptyResponse: PaginatedResponse<TestEntity> = {
        items: [],
        totalCount: 0,
      }
      mockApiClient.get.mockResolvedValue({ data: emptyResponse })

      const result = await service.getList()

      expect(result.items).toHaveLength(0)
      expect(result.totalCount).toBe(0)
    })

    it("should handle API errors", async () => {
      const error = new Error("API Error")
      mockApiClient.get.mockRejectedValue(error)

      await expect(service.getList()).rejects.toThrow("API Error")
    })
  })
})
