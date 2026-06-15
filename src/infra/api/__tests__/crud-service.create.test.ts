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

  describe("create", () => {
    const createData = {
      name: "New Entity",
      description: "New Description",
    }

    const createdEntity: TestEntity = {
      id: 1,
      ...createData,
    }

    it("should create new entity", async () => {
      mockApiClient.post.mockResolvedValue({ data: createdEntity })

      const result = await service.create(createData)

      expect(mockApiClient.post).toHaveBeenCalledWith("/api/app/test-entity", createData)
      expect(result).toEqual(createdEntity)
    })

    it("should handle validation errors", async () => {
      const error = new Error("Validation Error")
      mockApiClient.post.mockRejectedValue(error)

      await expect(service.create(createData)).rejects.toThrow("Validation Error")
    })

    it("should create entity with partial data", async () => {
      const partialData = { name: "Minimal Entity" }
      const createdMinimal: TestEntity = {
        id: 2,
        name: "Minimal Entity",
      }

      mockApiClient.post.mockResolvedValue({ data: createdMinimal })

      const result = await service.create(partialData)

      expect(mockApiClient.post).toHaveBeenCalledWith("/api/app/test-entity", partialData)
      expect(result).toEqual(createdMinimal)
    })

    it("should handle server errors", async () => {
      const error = new Error("Server Error")
      mockApiClient.post.mockRejectedValue(error)

      await expect(service.create(createData)).rejects.toThrow("Server Error")
    })
  })
})
