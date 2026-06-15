import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { BaseCRUDService } from "../crud-service"

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
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("Constructor", () => {
    it("should initialize with string endpoint", () => {
      const service = new BaseCRUDService<TestEntity>("users")
      expect(service["endpoint"]).toBe("/api/app/users")
      expect(service["resourceName"]).toBe("users")
    })

    it("should initialize with config object", () => {
      const service = new BaseCRUDService<TestEntity>({
        endpoint: "warehouses",
        resourceName: "Warehouse",
      })
      expect(service["endpoint"]).toBe("/api/app/warehouses")
      expect(service["resourceName"]).toBe("Warehouse")
    })

    it("should extract resource name from nested endpoint", () => {
      const service = new BaseCRUDService<TestEntity>("inventory/items")
      expect(service["endpoint"]).toBe("/api/app/inventory/items")
      expect(service["resourceName"]).toBe("items")
    })

    it("should use endpoint as resource name if not provided in config", () => {
      const service = new BaseCRUDService<TestEntity>({
        endpoint: "products",
      })
      expect(service["resourceName"]).toBe("products")
    })
  })
})
