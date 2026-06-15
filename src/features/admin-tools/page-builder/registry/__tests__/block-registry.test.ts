import { describe, it, expect } from "vitest"
import { blockRegistry } from "../block-registry"

describe("blockRegistry — registration invariants", () => {
  it("registers all 16 built-in block types", () => {
    const types = blockRegistry
      .list()
      .map(b => b.type)
      .sort()
    expect(types).toEqual(
      [
        "accordion",
        "alert",
        "button",
        "card",
        "chart",
        "detail",
        "divider",
        "form",
        "grid",
        "heading",
        "kpi",
        "map",
        "spacer",
        "table",
        "tabs",
        "text",
      ].sort(),
    )
  })

  it("every block declares a wrapped componentPath (traceability gate)", () => {
    for (const def of blockRegistry.list()) {
      expect(def.wraps.componentPath, `block "${def.type}" missing wraps.componentPath`).toBeTruthy()
      expect(def.wraps.componentName, `block "${def.type}" missing wraps.componentName`).toBeTruthy()
    }
  })

  it("every block carries a Zod propsSchema and bilingual displayName/description", () => {
    for (const def of blockRegistry.list()) {
      expect(def.propsSchema, `block "${def.type}" missing propsSchema`).toBeTruthy()
      expect(def.displayName.en).toBeTruthy()
      expect(def.displayName.ar).toBeTruthy()
      expect(def.description.en).toBeTruthy()
      expect(def.description.ar).toBeTruthy()
    }
  })

  it("every block's defaultProps validate against its propsSchema", () => {
    for (const def of blockRegistry.list()) {
      const result = def.propsSchema.safeParse(def.defaultProps)
      expect(result.success, `block "${def.type}" defaultProps fail validation`).toBe(true)
    }
  })

  it("byCategory groups blocks correctly", () => {
    const layout = blockRegistry
      .byCategory("layout")
      .map(b => b.type)
      .sort()
    expect(layout).toEqual(["accordion", "card", "grid", "tabs"])
    const action = blockRegistry.byCategory("action").map(b => b.type)
    expect(action).toEqual(["button"])
    const content = blockRegistry
      .byCategory("content")
      .map(b => b.type)
      .sort()
    expect(content).toEqual(["divider", "heading", "spacer", "text"])
    const form = blockRegistry.byCategory("form").map(b => b.type)
    expect(form).toEqual(["form"])
  })

  it("rejects double registration", () => {
    expect(() => blockRegistry.register(blockRegistry.list()[0]!)).toThrow(/already registered/)
  })
})
