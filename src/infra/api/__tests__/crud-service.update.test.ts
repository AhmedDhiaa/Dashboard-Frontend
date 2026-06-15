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

  describe("update", () => {
    const updateData = {
      name: "Updated Entity",
      description: "Updated Description",
    }

    const updatedEntity: TestEntity = {
      id: 1,
      ...updateData,
    }

    it("should update entity with numeric ID", async () => {
      mockApiClient.put.mockResolvedValue({ data: updatedEntity })

      const result = await service.update(1, updateData)

      expect(mockApiClient.put).toHaveBeenCalledWith("/api/app/test-entity/1", updateData)
      expect(result).toEqual(updatedEntity)
    })

    it("should update entity with string ID", async () => {
      mockApiClient.put.mockResolvedValue({ data: updatedEntity })

      const result = await service.update("abc-123", updateData)

      expect(mockApiClient.put).toHaveBeenCalledWith("/api/app/test-entity/abc-123", updateData)
      expect(result).toEqual(updatedEntity)
    })

    it("should handle partial updates", async () => {
      const partialUpdate = { name: "Only Name Updated" }
      const partialResult: TestEntity = {
        id: 1,
        name: "Only Name Updated",
        description: "Original Description",
      }

      mockApiClient.put.mockResolvedValue({ data: partialResult })

      const result = await service.update(1, partialUpdate)

      expect(mockApiClient.put).toHaveBeenCalledWith("/api/app/test-entity/1", partialUpdate)
      expect(result).toEqual(partialResult)
    })

    it("should handle not found error", async () => {
      const error = new Error("Entity not found")
      mockApiClient.put.mockRejectedValue(error)

      await expect(service.update(999, updateData)).rejects.toThrow("Entity not found")
    })

    it("should handle validation errors on update", async () => {
      const error = new Error("Invalid data")
      mockApiClient.put.mockRejectedValue(error)

      await expect(service.update(1, updateData)).rejects.toThrow("Invalid data")
    })
  })
})
