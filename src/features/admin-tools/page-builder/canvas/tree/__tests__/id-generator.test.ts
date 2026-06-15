import { describe, it, expect } from "vitest"
import { generateBlockId, generateTabId, generateItemId, regenerateIdsRecursive } from "../id-generator"
import { asBlockNode } from "../types"
import { heading, card, tabs, accordion } from "./fixtures"

describe("generateBlockId", () => {
  it("prefixes with the block type", () => {
    expect(generateBlockId("heading").startsWith("heading-")).toBe(true)
    expect(generateBlockId("card").startsWith("card-")).toBe(true)
  })

  it("produces 1000 unique ids in a row", () => {
    const seen = new Set<string>()
    for (let i = 0; i < 1000; i++) seen.add(generateBlockId("text"))
    expect(seen.size).toBe(1000)
  })

  it("matches the kebabIdSchema regex used by the schema validator", () => {
    const re = /^[a-z][a-z0-9-]{1,40}$/
    for (let i = 0; i < 50; i++) {
      const id = generateBlockId("text")
      expect(id).toMatch(re)
    }
  })

  it("generateTabId / generateItemId are kebab-safe and prefixed", () => {
    expect(generateTabId().startsWith("tab-")).toBe(true)
    expect(generateItemId().startsWith("item-")).toBe(true)
    expect(generateTabId()).toMatch(/^[a-z][a-z0-9-]{1,40}$/)
  })
})

describe("regenerateIdsRecursive", () => {
  it("clones a single block and gives it a fresh id", () => {
    const original = heading("h-original")
    const copy = regenerateIdsRecursive(original)
    expect(asBlockNode(copy).id).not.toBe("h-original")
    expect(asBlockNode(original).id).toBe("h-original") // input untouched
  })

  it("regenerates ids for every nested block in card.blocks", () => {
    const original = card("c-1", [heading("h-1"), heading("h-2"), card("c-2", [heading("h-3")])])
    const copy = regenerateIdsRecursive(original)
    const node = asBlockNode(copy)
    expect(node.id).not.toBe("c-1")
    expect(asBlockNode(node.blocks![0]!).id).not.toBe("h-1")
    expect(asBlockNode(node.blocks![1]!).id).not.toBe("h-2")
    const inner = asBlockNode(node.blocks![2]!)
    expect(inner.id).not.toBe("c-2")
    expect(asBlockNode(inner.blocks![0]!).id).not.toBe("h-3")
  })

  it("regenerates ids inside tabs (both tab.id and tab.blocks[].id)", () => {
    const original = tabs("t-1", [
      { id: "tab-a", blocks: [heading("h-1")] },
      { id: "tab-b", blocks: [heading("h-2")] },
    ])
    const copy = regenerateIdsRecursive(original)
    const node = asBlockNode(copy)
    expect(node.id).not.toBe("t-1")
    expect(node.tabs![0]!.id).not.toBe("tab-a")
    expect(node.tabs![1]!.id).not.toBe("tab-b")
    expect(asBlockNode(node.tabs![0]!.blocks[0]!).id).not.toBe("h-1")
  })

  it("regenerates ids inside accordion items", () => {
    const original = accordion("a-1", [{ id: "i-1", blocks: [heading("h-1")] }])
    const copy = regenerateIdsRecursive(original)
    const node = asBlockNode(copy)
    expect(node.id).not.toBe("a-1")
    expect(node.items![0]!.id).not.toBe("i-1")
    expect(asBlockNode(node.items![0]!.blocks[0]!).id).not.toBe("h-1")
  })

  it("the original tree and the copy share zero ids", () => {
    const original = card("c-1", [heading("h-1"), tabs("t-1", [{ id: "tab-a", blocks: [heading("h-x")] }])])
    const copy = regenerateIdsRecursive(original)
    const collect = (b: ReturnType<typeof asBlockNode>): string[] => {
      const ids = [b.id]
      for (const child of b.blocks ?? []) ids.push(...collect(asBlockNode(child)))
      for (const tab of b.tabs ?? []) {
        ids.push(tab.id)
        for (const child of tab.blocks) ids.push(...collect(asBlockNode(child)))
      }
      return ids
    }
    const a = collect(asBlockNode(original))
    const b = collect(asBlockNode(copy))
    expect(new Set([...a, ...b]).size).toBe(a.length + b.length)
  })
})
