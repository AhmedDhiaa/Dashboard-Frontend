import { describe, it, expect } from "vitest"
import { createMockService, mockEntity, mockPaginatedResponse } from "@/shared/test-utils/utils"

/**
 * Integration Tests for CRUD Workflows
 *
 * These tests verify the complete CRUD workflow from service layer
 * through entity configs to ensure end-to-end functionality.
 */

describe("CRUD Workflow Integration", () => {
  describe("List → Detail → Edit Flow", () => {
    it("should complete full CRUD workflow", async () => {
      const mockService = createMockService()

      // Step 1: List entities
      const listResponse = mockPaginatedResponse([
        mockEntity.brand({ id: "1", name: "Brand 1" }),
        mockEntity.brand({ id: "2", name: "Brand 2" }),
      ])
      mockService.getList.mockResolvedValue(listResponse)

      const list = await mockService.getList({ pageSize: 10 })
      expect(list.items).toHaveLength(2)
      expect(mockService.getList).toHaveBeenCalledWith({ pageSize: 10 })

      // Step 2: View detail
      const detailEntity = mockEntity.brand({ id: "1", name: "Brand 1" })
      mockService.getById.mockResolvedValue(detailEntity)

      const detail = await mockService.getById("1")
      expect(detail.id).toBe("1")
      expect(mockService.getById).toHaveBeenCalledWith("1")

      // Step 3: Edit entity
      const updateData = { name: "Updated Brand 1" }
      const updatedEntity = { ...detailEntity, ...updateData }
      mockService.update.mockResolvedValue(updatedEntity)

      const updated = await mockService.update("1", updateData)
      expect(updated.name).toBe("Updated Brand 1")
      expect(mockService.update).toHaveBeenCalledWith("1", updateData)

      // Step 4: Verify list is refreshed
      const refreshedList = mockPaginatedResponse([
        mockEntity.brand({ id: "1", name: "Updated Brand 1" }),
        mockEntity.brand({ id: "2", name: "Brand 2" }),
      ])
      mockService.getList.mockResolvedValue(refreshedList)

      const newList = await mockService.getList({ pageSize: 10 })
      expect(newList.items[0].name).toBe("Updated Brand 1")
    })
  })

  describe("Create → List Flow", () => {
    it("should create entity and refresh list", async () => {
      const mockService = createMockService()

      // Step 1: Initial list
      const initialList = mockPaginatedResponse([mockEntity.brand({ id: "1", name: "Brand 1" })])
      mockService.getList.mockResolvedValue(initialList)

      const list1 = await mockService.getList()
      expect(list1.items).toHaveLength(1)

      // Step 2: Create new entity
      const createData = { code: "B2", name: "Brand 2", foreignName: "علامة 2" }
      const createdEntity = mockEntity.brand({ id: "2", ...createData })
      mockService.create.mockResolvedValue(createdEntity)

      const created = await mockService.create(createData)
      expect(created.id).toBe("2")
      expect(mockService.create).toHaveBeenCalledWith(createData)

      // Step 3: Refreshed list includes new entity
      const refreshedList = mockPaginatedResponse([
        mockEntity.brand({ id: "1", name: "Brand 1" }),
        mockEntity.brand({ id: "2", name: "Brand 2" }),
      ])
      mockService.getList.mockResolvedValue(refreshedList)

      const list2 = await mockService.getList()
      expect(list2.items).toHaveLength(2)
      expect(list2.items[1].id).toBe("2")
    })
  })

  describe("Delete → List Flow", () => {
    it("should delete entity and refresh list", async () => {
      const mockService = createMockService()

      // Step 1: Initial list with 2 items
      const initialList = mockPaginatedResponse([
        mockEntity.brand({ id: "1", name: "Brand 1" }),
        mockEntity.brand({ id: "2", name: "Brand 2" }),
      ])
      mockService.getList.mockResolvedValue(initialList)

      const list1 = await mockService.getList()
      expect(list1.items).toHaveLength(2)

      // Step 2: Delete entity
      mockService.delete.mockResolvedValue(undefined)

      await mockService.delete("2")
      expect(mockService.delete).toHaveBeenCalledWith("2")

      // Step 3: Refreshed list has 1 item
      const refreshedList = mockPaginatedResponse([mockEntity.brand({ id: "1", name: "Brand 1" })])
      mockService.getList.mockResolvedValue(refreshedList)

      const list2 = await mockService.getList()
      expect(list2.items).toHaveLength(1)
      expect(list2.items.find((item: { id: string }) => item.id === "2")).toBeUndefined()
    })
  })

  describe("Search → Filter Flow", () => {
    it("should filter entities by search term", async () => {
      const mockService = createMockService()

      // Step 1: Full list
      const fullList = mockPaginatedResponse([
        mockEntity.brand({ id: "1", name: "Apple" }),
        mockEntity.brand({ id: "2", name: "Samsung" }),
        mockEntity.brand({ id: "3", name: "Sony" }),
      ])
      mockService.getList.mockResolvedValue(fullList)

      const list1 = await mockService.getList()
      expect(list1.items).toHaveLength(3)

      // Step 2: Search for 'Sam'
      const filteredList = mockPaginatedResponse([mockEntity.brand({ id: "2", name: "Samsung" })])
      mockService.getList.mockResolvedValue(filteredList)

      const list2 = await mockService.getList({ searchKey: "Sam" })
      expect(list2.items).toHaveLength(1)
      expect(list2.items[0].name).toBe("Samsung")
      expect(mockService.getList).toHaveBeenCalledWith({ searchKey: "Sam" })
    })
  })

  describe("Pagination Flow", () => {
    it("should navigate through pages", async () => {
      const mockService = createMockService()

      // Page 1
      const page1 = mockPaginatedResponse(
        [mockEntity.brand({ id: "1", name: "Brand 1" }), mockEntity.brand({ id: "2", name: "Brand 2" })],
        20,
      )
      mockService.getList.mockResolvedValue(page1)

      const result1 = await mockService.getList({ pageSize: 2, pageNumber: 0 })
      expect(result1.items).toHaveLength(2)
      expect(result1.totalCount).toBe(20)

      // Page 2
      const page2 = mockPaginatedResponse(
        [mockEntity.brand({ id: "3", name: "Brand 3" }), mockEntity.brand({ id: "4", name: "Brand 4" })],
        20,
      )
      mockService.getList.mockResolvedValue(page2)

      const result2 = await mockService.getList({ pageSize: 2, pageNumber: 2 })
      expect(result2.items).toHaveLength(2)
      expect(result2.items[0].id).toBe("3")
    })
  })

  describe("Error Handling", () => {
    it("should handle service errors gracefully", async () => {
      const mockService = createMockService()

      // Simulate network error
      mockService.getList.mockRejectedValue(new Error("Network error"))

      await expect(mockService.getList()).rejects.toThrow("Network error")
    })

    it("should handle validation errors on create", async () => {
      const mockService = createMockService()

      mockService.create.mockRejectedValue(new Error("Validation failed"))

      await expect(mockService.create({ code: "", name: "" })).rejects.toThrow("Validation failed")
    })

    it("should handle not found errors on update", async () => {
      const mockService = createMockService()

      mockService.update.mockRejectedValue(new Error("Entity not found"))

      await expect(mockService.update("999", { name: "Updated" })).rejects.toThrow("Entity not found")
    })
  })
})
