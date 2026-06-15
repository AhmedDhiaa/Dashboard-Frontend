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

  describe("getById", () => {
    const mockEntity: TestEntity = {
      id: 1,
      name: "Test Entity",
      description: "Test Description",
    }

    it("should fetch entity by numeric ID", async () => {
      mockApiClient.get.mockResolvedValue({ data: mockEntity })

      const result = await service.getById(1)

      expect(mockApiClient.get).toHaveBeenCalledWith("/api/app/test-entity/1")
      expect(result).toEqual(mockEntity)
    })

    it("should fetch entity by string ID", async () => {
      mockApiClient.get.mockResolvedValue({ data: mockEntity })

      const result = await service.getById("abc-123")

      expect(mockApiClient.get).toHaveBeenCalledWith("/api/app/test-entity/abc-123")
      expect(result).toEqual(mockEntity)
    })

    it("should handle not found error", async () => {
      const error = new Error("Not Found")
      mockApiClient.get.mockRejectedValue(error)

      await expect(service.getById(999)).rejects.toThrow("Not Found")
    })

    it("should handle network errors", async () => {
      const error = new Error("Network Error")
      mockApiClient.get.mockRejectedValue(error)

      await expect(service.getById(1)).rejects.toThrow("Network Error")
    })
  })
})
