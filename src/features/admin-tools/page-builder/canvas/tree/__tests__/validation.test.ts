import { describe, it, expect } from "vitest"
import { canDropInto, isDescendantOf } from "../validation"
import { card, tabs, accordion, heading, form, pageWith } from "./fixtures"

describe("canDropInto", () => {
  it("allows dropping at the root regardless of slot kind", () => {
    const schema = pageWith([heading("h1")])
    const v = canDropInto(schema, [{ kind: "root", index: 0 }], null, { kind: "root", index: 0 })
    expect(v.allowed).toBe(true)
  })

  it("rejects dropping a block into itself", () => {
    const schema = pageWith([card("outer", [])])
    const v = canDropInto(schema, [{ kind: "root", index: 0 }], [{ kind: "root", index: 0 }], {
      kind: "blocks",
      index: 0,
    })
    expect(v.allowed).toBe(false)
    expect(v.reason).toBe("cannot-drop-into-self")
  })

  it("rejects dropping a block into one of its own descendants (cycle)", () => {
    const schema = pageWith([card("outer", [card("inner", [])])])
    const v = canDropInto(
      schema,
      [{ kind: "root", index: 0 }],
      [
        { kind: "root", index: 0 },
        { kind: "blocks", index: 0 },
      ],
      { kind: "blocks", index: 0 },
    )
    expect(v.allowed).toBe(false)
    expect(v.reason).toBe("cannot-drop-into-descendant")
  })

  it("allows moving a block between unrelated containers", () => {
    const schema = pageWith([card("c1", []), heading("h1")])
    const v = canDropInto(schema, [{ kind: "root", index: 1 }], [{ kind: "root", index: 0 }], {
      kind: "blocks",
      index: 0,
    })
    expect(v.allowed).toBe(true)
  })

  it("rejects dropping any block into a form (form ≠ container)", () => {
    const schema = pageWith([form("f1"), heading("h1")])
    const v = canDropInto(schema, [{ kind: "root", index: 1 }], [{ kind: "root", index: 0 }], {
      kind: "blocks",
      index: 0,
    })
    expect(v.allowed).toBe(false)
    expect(v.reason).toBe("form-does-not-accept-blocks")
  })

  it("rejects a slot kind that doesn't match the parent's container kind", () => {
    const schema = pageWith([card("c1", []), heading("h1")])
    // Try to use a "tab" slot on a card.
    const v = canDropInto(schema, [{ kind: "root", index: 1 }], [{ kind: "root", index: 0 }], {
      kind: "tab",
      tabId: "ghost",
      index: 0,
    })
    expect(v.allowed).toBe(false)
    expect(v.reason).toBe("tab-slot-requires-tabs-block")
  })

  it("rejects an unknown tabId on a tabs block", () => {
    const schema = pageWith([tabs("t1", [{ id: "tab-a", blocks: [] }]), heading("h1")])
    const v = canDropInto(schema, [{ kind: "root", index: 1 }], [{ kind: "root", index: 0 }], {
      kind: "tab",
      tabId: "tab-missing",
      index: 0,
    })
    expect(v.allowed).toBe(false)
    expect(v.reason).toBe("tab-not-found")
  })

  it("rejects an unknown itemId on an accordion block", () => {
    const schema = pageWith([accordion("a1", [{ id: "i-1", blocks: [] }]), heading("h1")])
    const v = canDropInto(schema, [{ kind: "root", index: 1 }], [{ kind: "root", index: 0 }], {
      kind: "item",
      itemId: "ghost",
      index: 0,
    })
    expect(v.allowed).toBe(false)
    expect(v.reason).toBe("item-not-found")
  })
})

describe("isDescendantOf", () => {
  it("returns false for siblings", () => {
    const schema = pageWith([heading("h1"), heading("h2")])
    expect(isDescendantOf(schema, "h1", "h2")).toBe(false)
  })

  it("returns false when ancestor === descendant (a block is not its own descendant)", () => {
    const schema = pageWith([card("c1", [heading("h1")])])
    expect(isDescendantOf(schema, "c1", "c1")).toBe(false)
  })

  it("returns true across 3 nested levels", () => {
    const schema = pageWith([card("c1", [card("c2", [card("c3", [heading("deep")])])])])
    expect(isDescendantOf(schema, "c1", "deep")).toBe(true)
    expect(isDescendantOf(schema, "c2", "deep")).toBe(true)
    expect(isDescendantOf(schema, "c3", "deep")).toBe(true)
  })

  it("returns true when descendant lives inside a tab branch", () => {
    const schema = pageWith([tabs("t1", [{ id: "tab-a", blocks: [card("c1", [heading("h1")])] }])])
    expect(isDescendantOf(schema, "t1", "h1")).toBe(true)
    expect(isDescendantOf(schema, "c1", "h1")).toBe(true)
  })

  it("returns false for non-related blocks", () => {
    const schema = pageWith([card("c1", [heading("h1")]), card("c2", [heading("h2")])])
    expect(isDescendantOf(schema, "c1", "h2")).toBe(false)
    expect(isDescendantOf(schema, "c2", "h1")).toBe(false)
  })
})
