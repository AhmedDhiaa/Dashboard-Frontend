import { describe, it, expect } from "vitest"
import {
  findBlockById,
  getBlockAt,
  setBlockAt,
  insertBlockAt,
  removeBlockAt,
  moveBlock,
  duplicateBlockAt,
  getDropTargets,
} from "../operations"
import { asBlockNode } from "../types"
import { heading, card, tabs, accordion, kpi, form, pageWith } from "./fixtures"

describe("findBlockById", () => {
  it("finds a root-level block (parent + parentSlot are null)", () => {
    const schema = pageWith([heading("h1"), heading("h2")])
    const result = findBlockById(schema, "h2")
    expect(result).not.toBeNull()
    expect(result!.path).toEqual([{ kind: "root", index: 1 }])
    expect(result!.parent).toBeNull()
    expect(result!.parentSlot).toBeNull()
  })

  it("finds a block inside card.blocks", () => {
    const schema = pageWith([card("c1", [heading("h1"), heading("h2")])])
    const result = findBlockById(schema, "h2")
    expect(result).not.toBeNull()
    expect(result!.path).toEqual([
      { kind: "root", index: 0 },
      { kind: "blocks", index: 1 },
    ])
    expect(asBlockNode(result!.parent!).id).toBe("c1")
    expect(result!.parentSlot).toEqual({ kind: "blocks", index: 1 })
  })

  it("finds a block 4 levels deep (tabs > card > tabs > heading)", () => {
    const schema = pageWith([
      tabs("t1", [
        {
          id: "tab-login",
          blocks: [card("c1", [tabs("t2", [{ id: "tab-inner", blocks: [heading("deep")] }])])],
        },
      ]),
    ])
    const result = findBlockById(schema, "deep")
    expect(result).not.toBeNull()
    expect(result!.path).toEqual([
      { kind: "root", index: 0 },
      { kind: "tab", tabId: "tab-login", index: 0 },
      { kind: "blocks", index: 0 },
      { kind: "tab", tabId: "tab-inner", index: 0 },
    ])
  })

  it("returns null for an unknown id", () => {
    const schema = pageWith([heading("h1")])
    expect(findBlockById(schema, "missing")).toBeNull()
  })
})

describe("getBlockAt", () => {
  const schema = pageWith([
    heading("h1"),
    card("c1", [heading("h2"), heading("h3")]),
    tabs("t1", [{ id: "tab-a", blocks: [heading("h4")] }]),
    accordion("a1", [{ id: "item-x", blocks: [heading("h5")] }]),
  ])

  it("resolves a root path", () => {
    const got = getBlockAt(schema, [{ kind: "root", index: 0 }])
    expect(asBlockNode(got!).id).toBe("h1")
  })

  it("resolves a card path", () => {
    const got = getBlockAt(schema, [
      { kind: "root", index: 1 },
      { kind: "blocks", index: 1 },
    ])
    expect(asBlockNode(got!).id).toBe("h3")
  })

  it("resolves a tab path", () => {
    const got = getBlockAt(schema, [
      { kind: "root", index: 2 },
      { kind: "tab", tabId: "tab-a", index: 0 },
    ])
    expect(asBlockNode(got!).id).toBe("h4")
  })

  it("resolves an accordion item path", () => {
    const got = getBlockAt(schema, [
      { kind: "root", index: 3 },
      { kind: "item", itemId: "item-x", index: 0 },
    ])
    expect(asBlockNode(got!).id).toBe("h5")
  })

  it("returns null for an out-of-range index", () => {
    expect(getBlockAt(schema, [{ kind: "root", index: 99 }])).toBeNull()
  })

  it("returns null for an unknown tabId", () => {
    expect(
      getBlockAt(schema, [
        { kind: "root", index: 2 },
        { kind: "tab", tabId: "nope", index: 0 },
      ]),
    ).toBeNull()
  })
})

describe("setBlockAt", () => {
  it("does not mutate the input schema (immutable)", () => {
    const schema = pageWith([card("c1", [heading("h1")])])
    const updated = heading("h1-renamed")
    const next = setBlockAt(
      schema,
      [
        { kind: "root", index: 0 },
        { kind: "blocks", index: 0 },
      ],
      updated,
    )
    expect(asBlockNode(schema.blocks[0]!).blocks![0]).toMatchObject({ id: "h1" })
    expect(asBlockNode(next.blocks[0]!).blocks![0]).toMatchObject({ id: "h1-renamed" })
  })

  it("updates a deeply nested block (depth 4)", () => {
    const schema = pageWith([tabs("t1", [{ id: "tab-a", blocks: [card("c1", [heading("h-deep")])] }])])
    const replacement = heading("h-replaced")
    const next = setBlockAt(
      schema,
      [
        { kind: "root", index: 0 },
        { kind: "tab", tabId: "tab-a", index: 0 },
        { kind: "blocks", index: 0 },
      ],
      replacement,
    )
    const got = getBlockAt(next, [
      { kind: "root", index: 0 },
      { kind: "tab", tabId: "tab-a", index: 0 },
      { kind: "blocks", index: 0 },
    ])
    expect(asBlockNode(got!).id).toBe("h-replaced")
  })
})

describe("insertBlockAt", () => {
  it("inserts at root with parentPath=null", () => {
    const schema = pageWith([heading("h1"), heading("h3")])
    const next = insertBlockAt(schema, null, { kind: "root", index: 0 }, 1, heading("h2"))
    expect(next.blocks.map(b => asBlockNode(b).id)).toEqual(["h1", "h2", "h3"])
  })

  it("inserts inside a tab", () => {
    const schema = pageWith([tabs("t1", [{ id: "tab-a", blocks: [heading("h1")] }])])
    const next = insertBlockAt(
      schema,
      [{ kind: "root", index: 0 }],
      { kind: "tab", tabId: "tab-a", index: 0 },
      1,
      heading("h2"),
    )
    const tab = asBlockNode(next.blocks[0]!).tabs![0]!
    expect(tab.blocks.map(b => asBlockNode(b).id)).toEqual(["h1", "h2"])
  })

  it("inserts inside an accordion item", () => {
    const schema = pageWith([accordion("a1", [{ id: "i-1", blocks: [] }])])
    const next = insertBlockAt(
      schema,
      [{ kind: "root", index: 0 }],
      { kind: "item", itemId: "i-1", index: 0 },
      0,
      heading("h1"),
    )
    const item = asBlockNode(next.blocks[0]!).items![0]!
    expect(item.blocks.map(b => asBlockNode(b).id)).toEqual(["h1"])
  })

  it("inserts inside a nested card (path depth 2)", () => {
    const schema = pageWith([card("outer", [card("inner", [])])])
    const next = insertBlockAt(
      schema,
      [
        { kind: "root", index: 0 },
        { kind: "blocks", index: 0 },
      ],
      { kind: "blocks", index: 0 },
      0,
      heading("h-new"),
    )
    const inner = asBlockNode(asBlockNode(next.blocks[0]!).blocks![0]!)
    expect(inner.blocks!.map(b => asBlockNode(b).id)).toEqual(["h-new"])
  })

  it("clamps an out-of-range index", () => {
    const schema = pageWith([heading("h1")])
    const next = insertBlockAt(schema, null, { kind: "root", index: 0 }, 999, heading("h2"))
    expect(next.blocks.map(b => asBlockNode(b).id)).toEqual(["h1", "h2"])
  })
})

describe("removeBlockAt", () => {
  it("removes a root-level block", () => {
    const schema = pageWith([heading("h1"), heading("h2"), heading("h3")])
    const next = removeBlockAt(schema, [{ kind: "root", index: 1 }])
    expect(next.blocks.map(b => asBlockNode(b).id)).toEqual(["h1", "h3"])
  })

  it("removes from a card.blocks slot", () => {
    const schema = pageWith([card("c1", [heading("h1"), heading("h2")])])
    const next = removeBlockAt(schema, [
      { kind: "root", index: 0 },
      { kind: "blocks", index: 1 },
    ])
    expect(asBlockNode(next.blocks[0]!).blocks!.map(b => asBlockNode(b).id)).toEqual(["h1"])
  })

  it("removes from a deeply nested location", () => {
    const schema = pageWith([tabs("t1", [{ id: "tab-a", blocks: [card("c1", [heading("h1"), heading("h2")])] }])])
    const next = removeBlockAt(schema, [
      { kind: "root", index: 0 },
      { kind: "tab", tabId: "tab-a", index: 0 },
      { kind: "blocks", index: 0 },
    ])
    const tab = asBlockNode(next.blocks[0]!).tabs![0]!
    const card_ = asBlockNode(tab.blocks[0]!)
    expect(card_.blocks!.map(b => asBlockNode(b).id)).toEqual(["h2"])
  })
})

describe("moveBlock", () => {
  it("reorders within the same root array", () => {
    const schema = pageWith([heading("h1"), heading("h2"), heading("h3")])
    const next = moveBlock(schema, [{ kind: "root", index: 0 }], null, { kind: "root", index: 0 }, 2)
    expect(next.blocks.map(b => asBlockNode(b).id)).toEqual(["h2", "h1", "h3"])
  })

  it("moves a block from root into a card", () => {
    const schema = pageWith([card("c1", []), heading("h1")])
    const next = moveBlock(
      schema,
      [{ kind: "root", index: 1 }],
      [{ kind: "root", index: 0 }],
      { kind: "blocks", index: 0 },
      0,
    )
    expect(next.blocks).toHaveLength(1)
    expect(asBlockNode(next.blocks[0]!).blocks!.map(b => asBlockNode(b).id)).toEqual(["h1"])
  })

  it("moves a block deeper (root → card.body → tab)", () => {
    const schema = pageWith([tabs("t1", [{ id: "tab-a", blocks: [] }]), heading("h1")])
    const next = moveBlock(
      schema,
      [{ kind: "root", index: 1 }],
      [{ kind: "root", index: 0 }],
      { kind: "tab", tabId: "tab-a", index: 0 },
      0,
    )
    expect(next.blocks).toHaveLength(1)
    const tab = asBlockNode(next.blocks[0]!).tabs![0]!
    expect(tab.blocks.map(b => asBlockNode(b).id)).toEqual(["h1"])
  })

  it("moves a block from one tab to another", () => {
    const schema = pageWith([
      tabs("t1", [
        { id: "tab-a", blocks: [heading("h1")] },
        { id: "tab-b", blocks: [] },
      ]),
    ])
    const next = moveBlock(
      schema,
      [
        { kind: "root", index: 0 },
        { kind: "tab", tabId: "tab-a", index: 0 },
      ],
      [{ kind: "root", index: 0 }],
      { kind: "tab", tabId: "tab-b", index: 0 },
      0,
    )
    const tabsBlock = asBlockNode(next.blocks[0]!)
    expect(tabsBlock.tabs![0]!.blocks).toHaveLength(0)
    expect(tabsBlock.tabs![1]!.blocks.map(b => asBlockNode(b).id)).toEqual(["h1"])
  })

  it("compensates for the removal index when moving forward in the same array", () => {
    // Move "h1" (index 0) to "after h3" (intended index 3). After removing
    // h1, h3 is at index 1 — the destination index 3 must shift to 2.
    const schema = pageWith([heading("h1"), heading("h2"), heading("h3"), heading("h4")])
    const next = moveBlock(schema, [{ kind: "root", index: 0 }], null, { kind: "root", index: 0 }, 3)
    expect(next.blocks.map(b => asBlockNode(b).id)).toEqual(["h2", "h3", "h1", "h4"])
  })
})

describe("duplicateBlockAt", () => {
  it("inserts the duplicate immediately after the original with a fresh id", () => {
    const schema = pageWith([heading("h-original"), heading("h-other")])
    const { schema: next, newId } = duplicateBlockAt(schema, [{ kind: "root", index: 0 }])
    expect(next.blocks).toHaveLength(3)
    expect(asBlockNode(next.blocks[0]!).id).toBe("h-original")
    expect(asBlockNode(next.blocks[1]!).id).toBe(newId)
    expect(asBlockNode(next.blocks[2]!).id).toBe("h-other")
    expect(newId).not.toBe("h-original")
  })

  it("regenerates ids for every descendant of the duplicated subtree", () => {
    const schema = pageWith([card("c1", [heading("h1"), heading("h2")])])
    const { schema: next } = duplicateBlockAt(schema, [{ kind: "root", index: 0 }])
    const original = asBlockNode(next.blocks[0]!)
    const dup = asBlockNode(next.blocks[1]!)
    expect(dup.id).not.toBe(original.id)
    expect(asBlockNode(dup.blocks![0]!).id).not.toBe("h1")
    expect(asBlockNode(dup.blocks![1]!).id).not.toBe("h2")
  })

  it("works inside a nested container", () => {
    const schema = pageWith([tabs("t1", [{ id: "tab-a", blocks: [heading("h1"), heading("h2")] }])])
    const { schema: next, newId } = duplicateBlockAt(schema, [
      { kind: "root", index: 0 },
      { kind: "tab", tabId: "tab-a", index: 0 },
    ])
    const tab = asBlockNode(next.blocks[0]!).tabs![0]!
    expect(tab.blocks).toHaveLength(3)
    expect(asBlockNode(tab.blocks[1]!).id).toBe(newId)
  })
})

describe("getDropTargets", () => {
  it("emits root targets between every existing block + before/after", () => {
    const schema = pageWith([heading("h1"), heading("h2")])
    const targets = getDropTargets(schema, [{ kind: "root", index: 0 }])
    const rootTargets = targets.filter(t => t.parentPath === null)
    // Three positions for two blocks (before, between, after) — but the
    // dragged block can land at any of them.
    expect(rootTargets.length).toBe(3)
  })

  it("emits drop targets inside cards but not inside form / kpi / heading", () => {
    const schema = pageWith([card("c1", []), form("f1"), kpi("k1"), heading("h1")])
    const targets = getDropTargets(schema, [{ kind: "root", index: 3 }])
    const insideCard = targets.filter(t => t.parentPath?.length === 1 && t.slot.kind === "blocks")
    const insideForm = targets.filter(t => {
      if (!t.parentPath) return false
      const last = t.parentPath[t.parentPath.length - 1]!
      return last.kind === "root" && last.index === 1
    })
    expect(insideCard.length).toBeGreaterThan(0)
    expect(insideForm.length).toBe(0)
  })

  it("excludes drop targets that would create a cycle (block into descendant)", () => {
    const schema = pageWith([card("outer", [card("inner", [])])])
    // Drag the outer card; dropping it inside its own inner card is a cycle.
    const targets = getDropTargets(schema, [{ kind: "root", index: 0 }])
    const cycleTargets = targets.filter(
      t =>
        t.parentPath && t.parentPath.length === 2 && t.parentPath[0]!.kind === "root" && t.parentPath[0]!.index === 0,
    )
    expect(cycleTargets.length).toBe(0)
  })
})
