import { describe, it, expect } from "vitest"
import { getContainerSlots, isContainer, getContainerKind } from "../container-helpers"
import { heading, card, grid, tabs, accordion, form, kpi } from "./fixtures"

describe("getContainerSlots", () => {
  it("card returns one body slot", () => {
    const slots = getContainerSlots(card("c1", [heading("h1")]))
    expect(slots).toHaveLength(1)
    expect(slots[0]!.segment).toEqual({ kind: "blocks", index: 0 })
    expect(slots[0]!.slotLabel).toBe("Card body")
    expect(slots[0]!.blocks).toHaveLength(1)
  })

  it("grid returns one items slot", () => {
    const slots = getContainerSlots(grid("g1", []))
    expect(slots).toHaveLength(1)
    expect(slots[0]!.segment.kind).toBe("blocks")
    expect(slots[0]!.slotLabel).toBe("Grid items")
  })

  it("tabs returns one slot per tab, keyed by tabId, with the tab label", () => {
    const block = tabs("t1", [
      { id: "tab-a", label: "First", blocks: [heading("h1")] },
      { id: "tab-b", label: "Second", blocks: [] },
      { id: "tab-c", label: "Third", blocks: [heading("h2"), heading("h3")] },
    ])
    const slots = getContainerSlots(block)
    expect(slots).toHaveLength(3)
    expect(slots[0]!.segment).toEqual({ kind: "tab", tabId: "tab-a", index: 0 })
    expect(slots[0]!.slotLabel).toBe("First")
    expect(slots[2]!.blocks).toHaveLength(2)
  })

  it("accordion returns one slot per item, keyed by itemId, with the item title", () => {
    const block = accordion("a1", [
      { id: "i-1", title: "Section A", blocks: [] },
      { id: "i-2", title: "Section B", blocks: [heading("h1")] },
    ])
    const slots = getContainerSlots(block)
    expect(slots).toHaveLength(2)
    expect(slots[1]!.segment).toEqual({ kind: "item", itemId: "i-2", index: 0 })
    expect(slots[1]!.slotLabel).toBe("Section B")
  })

  it("kpi returns no slots", () => {
    expect(getContainerSlots(kpi("k1"))).toHaveLength(0)
  })

  it("heading returns no slots", () => {
    expect(getContainerSlots(heading("h1"))).toHaveLength(0)
  })

  it("form returns no slots — schema-level distinction (form has fields, not blocks)", () => {
    expect(getContainerSlots(form("f1"))).toHaveLength(0)
  })
})

describe("isContainer", () => {
  it("true for the four container kinds", () => {
    expect(isContainer(card("c1"))).toBe(true)
    expect(isContainer(grid("g1"))).toBe(true)
    expect(isContainer(tabs("t1", []))).toBe(true)
    expect(isContainer(accordion("a1", []))).toBe(true)
  })

  it("false for leaf blocks and form", () => {
    expect(isContainer(heading("h1"))).toBe(false)
    expect(isContainer(kpi("k1"))).toBe(false)
    expect(isContainer(form("f1"))).toBe(false)
  })
})

describe("getContainerKind", () => {
  it("returns the kind for containers, null for leaves", () => {
    expect(getContainerKind(card("c1"))).toBe("card")
    expect(getContainerKind(grid("g1"))).toBe("grid")
    expect(getContainerKind(tabs("t1", []))).toBe("tabs")
    expect(getContainerKind(accordion("a1", []))).toBe("accordion")
    expect(getContainerKind(form("f1"))).toBeNull()
    expect(getContainerKind(heading("h1"))).toBeNull()
  })
})
