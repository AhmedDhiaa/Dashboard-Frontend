import { describe, it, expect } from "vitest"
import {
  registerEntityConfig,
  getEntityConfig,
  hasEntityConfig,
  validateEntityConfig,
  getRegisteredEntities,
} from "@/core/entities/registry"
import type { EntityConfig } from "@/core/entities/types"
import { Tag } from "lucide-react"

describe("Entity Config Registry", () => {
  describe("registerEntityConfig", () => {
    it("should register a valid entity config", () => {
      const config: EntityConfig = {
        entityName: "test-entity",
        singularName: "Test Entity",
        pluralName: "Test Entities",
        icon: Tag,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        service: {} as any, // Test mock service
        listColumns: [{ field: "name", type: "text-primary" }],
        detailSections: ["PRIMARY"],
        formFields: { name: { type: "text", required: true } },
        formFieldOrder: ["name"],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        createSchema: () => ({}) as any, // Test mock schema
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        updateSchema: () => ({}) as any, // Test mock schema
        defaultFormValues: { name: "" },
        translations: {
          listTitle: "test.list",
          listDescription: "test.description",
          detailTitle: "test.detail",
          createTitle: "test.create",
          editTitle: "test.edit",
          searchPlaceholder: "test.search",
        },
      }

      expect(() => registerEntityConfig(config)).not.toThrow()
      expect(hasEntityConfig("test-entity")).toBe(true)
    })

    it("should throw error for invalid entity config", () => {
      const invalidConfig = {
        entityName: "invalid",
        // Missing required fields
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any // Test mock - incomplete config

      expect(() => registerEntityConfig(invalidConfig)).toThrow()
    })
  })

  describe("getEntityConfig", () => {
    it("should return registered config", () => {
      // "test-entity" is registered by the first test in this suite
      const config = getEntityConfig("test-entity")
      expect(config).toBeDefined()
      expect(config.entityName).toBe("test-entity")
    })

    it("should throw error for non-existent config", () => {
      expect(() => getEntityConfig("non-existent")).toThrow()
    })
  })

  describe("hasEntityConfig", () => {
    it("should return true for registered entity", () => {
      expect(hasEntityConfig("test-entity")).toBe(true)
    })

    it("should return false for non-registered entity", () => {
      expect(hasEntityConfig("non-existent")).toBe(false)
    })
  })

  describe("validateEntityConfig", () => {
    it("should validate complete config", () => {
      const config: EntityConfig = {
        entityName: "valid-entity",
        singularName: "Valid",
        pluralName: "Valids",
        icon: Tag,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        service: {} as any, // Test mock service
        listColumns: [{ field: "name", type: "text-primary" }],
        detailSections: ["PRIMARY"],
        formFields: { name: { type: "text", required: true } },
        formFieldOrder: ["name"],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        createSchema: () => ({}) as any, // Test mock schema
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        updateSchema: () => ({}) as any, // Test mock schema
        defaultFormValues: { name: "" },
        translations: {
          listTitle: "test.list",
          listDescription: "test.description",
          detailTitle: "test.detail",
          createTitle: "test.create",
          editTitle: "test.edit",
          searchPlaceholder: "test.search",
        },
      }

      const result = validateEntityConfig(config)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it("should detect missing required fields", () => {
      const config = {
        entityName: "incomplete",
        // Missing many required fields
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any // Test mock - incomplete config

      const result = validateEntityConfig(config)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it("should detect invalid entityName format", () => {
      const config = {
        entityName: "Invalid_Name",
        singularName: "Test",
        pluralName: "Tests",
        icon: Tag,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        service: {} as any, // Test mock service
        listColumns: [],
        detailSections: [],
        formFields: {},
        formFieldOrder: [],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        createSchema: () => ({}) as any, // Test mock schema
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        updateSchema: () => ({}) as any, // Test mock schema
        defaultFormValues: {},
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        translations: {} as any, // Test mock translations
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any // Test mock config

      const result = validateEntityConfig(config)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain("entityName must be lowercase with hyphens only")
    })
  })

  describe("getRegisteredEntities", () => {
    it("should return list of registered entities", () => {
      const entities = getRegisteredEntities()
      expect(entities).toBeInstanceOf(Array)
      expect(entities.length).toBeGreaterThan(0)
      // "test-entity" was registered by the registerEntityConfig test above
      expect(entities).toContain("test-entity")
    })
  })
})
