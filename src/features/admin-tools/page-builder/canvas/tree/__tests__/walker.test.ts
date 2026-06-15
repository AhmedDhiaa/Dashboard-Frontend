import { describe, it, expect } from "vitest"
import { walkBlocks } from "../walker"
import { asBlockNode } from "../types"
import { heading, card, tabs, accordion, pageWith } from "./fixtures"

describe("walkBlocks", () => {
  it("visits every block exactly once", () => {
    const schema = pageWith([
      heading("h1"),
      card("c1", [heading("h2"), heading("h3")]),
      tabs("t1", [
        { id: "tab-a", blocks: [heading("h4")] },
        { id: "tab-b", blocks: [] },
      ]),
    ])
    const visited: string[] = []
    walkBlocks(schema, ({ block }) => {
      visited.push(asBlockNode(block).id)
    })
    expect(visited.sort()).toEqual(["c1", "h1", "h2", "h3", "h4", "t1"])
  })

  it("stops when visitor returns false", () => {
    const schema = pageWith([heading("h1"), heading("h2"), heading("h3")])
    const visited: string[] = []
    walkBlocks(schema, ({ block }) => {
      const id = asBlockNode(block).id
      visited.push(id)
      return id === "h2" ? false : undefined
    })
    expect(visited).toEqual(["h1", "h2"])
  })

  it("reports the correct depth", () => {
    const schema = pageWith([card("c1", [card("c2", [heading("h1")])])])
    const depthById: Record<string, number> = {}
    walkBlocks(schema, ({ block, depth }) => {
      depthById[asBlockNode(block).id] = depth
    })
    expect(depthById.c1).toBe(0)
    expect(depthById.c2).toBe(1)
    expect(depthById.h1).toBe(2)
  })

  it("reports the correct parent block", () => {
    const schema = pageWith([card("c1", [heading("h1")]), tabs("t1", [{ id: "tab-a", blocks: [heading("h2")] }])])
    const parentById: Record<string, string | null> = {}
    walkBlocks(schema, ({ block, parent }) => {
      parentById[asBlockNode(block).id] = parent ? asBlockNode(parent).id : null
    })
    expect(parentById.c1).toBeNull()
    expect(parentById.h1).toBe("c1")
    expect(parentById.t1).toBeNull()
    expect(parentById.h2).toBe("t1")
  })

  it("emits paths whose segments encode tab/item ids correctly", () => {
    const schema = pageWith([
      tabs("t1", [{ id: "tab-login", blocks: [heading("h1"), heading("h2")] }]),
      accordion("a1", [{ id: "item-x", blocks: [heading("h3")] }]),
    ])
    const pathById: Record<string, unknown> = {}
    walkBlocks(schema, ({ block, path }) => {
      pathById[asBlockNode(block).id] = path
    })
    expect(pathById.h2).toEqual([
      { kind: "root", index: 0 },
      { kind: "tab", tabId: "tab-login", index: 1 },
    ])
    expect(pathById.h3).toEqual([
      { kind: "root", index: 1 },
      { kind: "item", itemId: "item-x", index: 0 },
    ])
  })
})
