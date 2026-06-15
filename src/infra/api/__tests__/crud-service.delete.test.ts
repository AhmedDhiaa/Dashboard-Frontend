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

  describe("delete", () => {
    it("should delete entity by numeric ID", async () => {
      mockApiClient.delete.mockResolvedValue({})

      await service.delete(1)

      expect(mockApiClient.delete).toHaveBeenCalledWith("/api/app/test-entity/1")
    })

    it("should delete entity by string ID", async () => {
      mockApiClient.delete.mockResolvedValue({})

      await service.delete("abc-123")

      expect(mockApiClient.delete).toHaveBeenCalledWith("/api/app/test-entity/abc-123")
    })

    it("should handle not found error on delete", async () => {
      const error = new Error("Entity not found")
      mockApiClient.delete.mockRejectedValue(error)

      await expect(service.delete(999)).rejects.toThrow("Entity not found")
    })

    it("should handle deletion of non-existent entity", async () => {
      mockApiClient.delete.mockResolvedValue({})

      await expect(service.delete(0)).resolves.not.toThrow()
    })

    it("should handle server errors on delete", async () => {
      const error = new Error("Cannot delete entity")
      mockApiClient.delete.mockRejectedValue(error)

      await expect(service.delete(1)).rejects.toThrow("Cannot delete entity")
    })
  })
})
