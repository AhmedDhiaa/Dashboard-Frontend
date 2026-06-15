import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { BaseCRUDService, createCRUDService } from "../crud-service"
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

  describe("Edge Cases", () => {
    it("should handle concurrent requests", async () => {
      const mockResponse: PaginatedResponse<TestEntity> = {
        items: [{ id: 1, name: "Test" }],
        totalCount: 1,
      }
      mockApiClient.get.mockResolvedValue({ data: mockResponse })

      const promises = [
        service.getList({ pageSize: 10 }),
        service.getList({ pageSize: 20 }),
        service.getList({ pageSize: 30 }),
      ]

      const results = await Promise.all(promises)

      expect(results).toHaveLength(3)
      expect(mockApiClient.get).toHaveBeenCalledTimes(3)
    })

    it("should preserve client reference across operations", async () => {
      const client1 = service["client"]
      await service.getList().catch(() => {})
      const client2 = service["client"]

      expect(client1).toBe(client2)
    })
  })
})

describe("createCRUDService", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should create service instance with string config", () => {
    const service = createCRUDService<TestEntity>("products")

    expect(service).toBeInstanceOf(BaseCRUDService)
    expect(service["endpoint"]).toBe("/api/app/products")
  })

  it("should create service instance with object config", () => {
    const service = createCRUDService<TestEntity>({
      endpoint: "categories",
      resourceName: "Category",
    })

    expect(service).toBeInstanceOf(BaseCRUDService)
    expect(service["endpoint"]).toBe("/api/app/categories")
    expect(service["resourceName"]).toBe("Category")
  })

  it("should create typed service with custom create/update types", () => {
    interface Product {
      id: number
      name: string
      price: number
    }

    interface CreateProduct {
      name: string
      price: number
    }

    interface UpdateProduct {
      name?: string
      price?: number
    }

    const service = createCRUDService<Product, CreateProduct, UpdateProduct>("products")

    expect(service).toBeInstanceOf(BaseCRUDService)
  })
})
