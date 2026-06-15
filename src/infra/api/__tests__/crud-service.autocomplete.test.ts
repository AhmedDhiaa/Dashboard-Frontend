import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { BaseCRUDService } from "../crud-service"
import { apiClient } from "../client"

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

  describe("autocomplete", () => {
    const mockAutocompleteResults: TestEntity[] = [
      { id: 1, name: "Test 1" },
      { id: 2, name: "Test 2" },
      { id: 3, name: "Test 3" },
    ]

    it("should fetch autocomplete results without parameters", async () => {
      mockApiClient.get.mockResolvedValue({ data: mockAutocompleteResults })

      const result = await service.autocomplete()

      expect(mockApiClient.get).toHaveBeenCalledWith("/api/app/test-entity/autocomplete", { params: undefined })
      expect(result).toEqual(mockAutocompleteResults)
    })

    it("should fetch autocomplete with term parameter", async () => {
      mockApiClient.get.mockResolvedValue({ data: mockAutocompleteResults })

      const result = await service.autocomplete({ term: "test" })

      expect(mockApiClient.get).toHaveBeenCalledWith("/api/app/test-entity/autocomplete", { params: { term: "test" } })
      expect(result).toEqual(mockAutocompleteResults)
    })

    it("should fetch autocomplete with ID parameter", async () => {
      mockApiClient.get.mockResolvedValue({ data: [mockAutocompleteResults[0]] })

      const result = await service.autocomplete({ id: 1 })

      expect(mockApiClient.get).toHaveBeenCalledWith("/api/app/test-entity/autocomplete", { params: { id: 1 } })
      expect(result).toHaveLength(1)
    })

    it("should fetch autocomplete with maxResultCount", async () => {
      mockApiClient.get.mockResolvedValue({ data: mockAutocompleteResults.slice(0, 2) })

      const result = await service.autocomplete({ maxResultCount: 2 })

      expect(mockApiClient.get).toHaveBeenCalledWith("/api/app/test-entity/autocomplete", {
        params: { maxResultCount: 2 },
      })
      expect(result).toHaveLength(2)
    })

    it("should fetch autocomplete with all parameters", async () => {
      mockApiClient.get.mockResolvedValue({ data: mockAutocompleteResults })

      await service.autocomplete({
        term: "search",
        id: 1,
        maxResultCount: 5,
      })

      expect(mockApiClient.get).toHaveBeenCalledWith("/api/app/test-entity/autocomplete", {
        params: {
          term: "search",
          id: 1,
          maxResultCount: 5,
        },
      })
    })

    it("should handle empty autocomplete results", async () => {
      mockApiClient.get.mockResolvedValue({ data: [] })

      const result = await service.autocomplete({ term: "nonexistent" })

      expect(result).toHaveLength(0)
    })

    it("should handle autocomplete errors", async () => {
      const error = new Error("Autocomplete failed")
      mockApiClient.get.mockRejectedValue(error)

      await expect(service.autocomplete({ term: "test" })).rejects.toThrow("Autocomplete failed")
    })
  })
})
