import { vi } from "vitest"

/**
 * Mock entity data generators
 */
export const mockEntity = {
  brand: (overrides = {}) => ({
    id: "1",
    code: "TEST",
    name: "Test Brand",
    foreignName: "اختبار العلامة التجارية",
    note: "Test note",
    creationTime: "2024-01-01T00:00:00Z",
    concurrencyStamp: "test-stamp",
    ...overrides,
  }),

  category: (overrides = {}) => ({
    id: "1",
    code: "CAT1",
    name: "Test Category",
    foreignName: "فئة الاختبار",
    note: "Test note",
    creationTime: "2024-01-01T00:00:00Z",
    concurrencyStamp: "test-stamp",
    ...overrides,
  }),

  notification: (overrides = {}) => ({
    id: "1",
    title: "Test Notification",
    message: "Test message",
    type: "info" as const,
    isRead: false,
    userId: "user-1",
    creationTime: "2024-01-01T00:00:00Z",
    ...overrides,
  }),
}

/**
 * Mock paginated response
 */
export function mockPaginatedResponse<T>(items: T[], totalCount?: number) {
  return {
    items,
    totalCount: totalCount ?? items.length,
  }
}

/**
 * Mock service with CRUD operations
 */
export function createMockService<_T>() {
  return {
    getList: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    autocomplete: vi.fn(),
  }
}
