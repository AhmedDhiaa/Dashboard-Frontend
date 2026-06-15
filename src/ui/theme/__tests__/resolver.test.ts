/**
 * Tests for the style resolver — pure function, no React, easy to cover.
 */

import { describe, it, expect } from "vitest"
import { resolveStyles, resolveInlineStyles } from "../resolver"

describe("resolveStyles", () => {
  it("returns just className when the recipe is unknown", () => {
    const result = resolveStyles("not-a-real-component", { className: "extra" })
    expect(result.root).toBe("extra")
  })

  it("returns empty root when there's no className and no recipe", () => {
    const result = resolveStyles("ghost-component")
    expect(result.root).toBe("")
  })

  it("merges base + variant + caller className for a recipe's root (crud-add)", () => {
    // crud-* are theme-only components that legitimately have a recipe.
    const result = resolveStyles("crud-add", { size: "lg", className: "extra" })
    expect(result.root).toContain("inline-flex")
    expect(result.root).toContain("h-12") // lg size variant
    expect(result.root).toContain("extra")
  })

  it("emits a class string per declared part", () => {
    const result = resolveStyles("crud-add")
    expect(result.root).toBeDefined()
    expect(result.icon).toContain("h-4 w-4")
  })

  it("primitives have NO recipe — those keys return only className (their base lives in the component)", () => {
    // button/card/input/badge recipes were removed so they cannot override
    // the primitives' own intended designs (cn is tailwind-merge). Those keys
    // now use the no-recipe path.
    expect(resolveStyles("button", { variant: "destructive", className: "extra" }).root).toBe("extra")
    expect(resolveStyles("card").root).toBe("")
  })

  it("applies per-part class overrides even WITHOUT a recipe (customizer works for every primitive)", () => {
    const result = resolveStyles("input", { className: "base" }, { root: { classes: ["shadow-md"] } })
    expect(result.root).toContain("shadow-md")
    expect(result.root).toContain("base")
  })

  it("merges per-part overrides into a recipe's parts (crud-add icon)", () => {
    const result = resolveStyles("crud-add", {}, { icon: { classes: ["custom-class"] } })
    expect(result.icon).toContain("h-4 w-4")
    expect(result.icon).toContain("custom-class")
  })
})

describe("resolveInlineStyles", () => {
  it("returns an empty object when there are no overrides", () => {
    expect(resolveInlineStyles("button")).toEqual({})
  })

  it("emits CSS variables prefixed by component-part-prop", () => {
    const result = resolveInlineStyles("button", {
      root: { styles: { color: "red" } },
    })
    expect(result).toMatchObject({ "--button-root-color": "red" })
  })

  it("kebab-cases camelCase property names", () => {
    const result = resolveInlineStyles("card", {
      title: { styles: { fontSize: "20px" } },
    })
    expect(result).toMatchObject({ "--card-title-font-size": "20px" })
  })

  it("treats numeric values as rem units", () => {
    const result = resolveInlineStyles("input", {
      root: { styles: { padding: 1.5 } },
    })
    expect(result).toMatchObject({ "--input-root-padding": "1.5rem" })
  })

  it("ignores parts without a styles map", () => {
    const result = resolveInlineStyles("badge", { root: {} })
    expect(result).toEqual({})
  })
})
