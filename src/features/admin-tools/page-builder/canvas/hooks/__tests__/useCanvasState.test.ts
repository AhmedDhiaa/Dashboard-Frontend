import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useCanvasState } from "../useCanvasState"
import { asBlockNode } from "../../tree"
import type { PageSchema } from "../../../schema/page-schema"
import type { BlockSchema } from "../../../schema/block-schema"

// `useCanvasState` calls `useNotification` for invalid-drop warnings; the
// hook is mocked so tests can assert the warning fires without pulling
// the real toast layer into the suite.
const mocks = vi.hoisted(() => ({
  warning: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
}))

vi.mock("@/ui/application/hooks/useNotification", () => ({
  useNotification: () => ({
    warning: mocks.warning,
    error: mocks.error,
    success: mocks.success,
    info: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
    promise: vi.fn(),
  }),
}))

beforeEach(() => {
  mocks.warning.mockReset()
  mocks.error.mockReset()
  mocks.success.mockReset()
})

// ─── Test fixtures ────────────────────────────────────────────────────────

const localized = (en: string, ar: string) => ({ en, ar })
const asBlock = <T>(b: T) => b as unknown as BlockSchema

const heading = (id: string, text = "Heading"): BlockSchema =>
  asBlock({ id, type: "heading", text: localized(text, text), level: 2, hidden: false })

const card = (id: string, blocks: BlockSchema[] = []): BlockSchema =>
  asBlock({ id, type: "card", blocks, hidden: false })

const tabs = (id: string, tabSpecs: { id: string; blocks: BlockSchema[]; label?: string }[]): BlockSchema =>
  asBlock({
    id,
    type: "tabs",
    hidden: false,
    tabs: tabSpecs.map(t => ({
      id: t.id,
      label: localized(t.label ?? t.id, t.label ?? t.id),
      blocks: t.blocks,
    })),
  })

const form = (id: string): BlockSchema =>
  asBlock({
    id,
    type: "form",
    fields: [],
    layout: { type: "grid", rows: [] },
    submitAction: { type: "api", method: "POST", endpoint: "/x" },
    hidden: false,
  })

const baseSchema = (blocks: BlockSchema[]): PageSchema =>
  ({
    id: "test-page",
    version: "1.0",
    title: localized("Test", "اختبار"),
    permission: "Api.Admin.PageBuilder",
    layout: "full",
    blocks,
  }) as never

// ─── Initialisation ──────────────────────────────────────────────────────

describe("useCanvasState — initialisation", () => {
  it("starts with the supplied schema and clean state", () => {
    const initial = baseSchema([])
    const { result } = renderHook(() => useCanvasState(initial))
    expect(result.current.schema).toBe(initial)
    expect(result.current.selectedId).toBeNull()
    expect(result.current.selectedPath).toBeNull()
    expect(result.current.selectedBlock).toBeNull()
    expect(result.current.isDirty).toBe(false)
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(false)
  })
})

// ─── Selection ───────────────────────────────────────────────────────────

describe("useCanvasState — selection", () => {
  it("selectBlock sets selectedId and resolves selectedBlock from the schema", () => {
    const { result } = renderHook(() => useCanvasState(baseSchema([heading("h1"), heading("h2")])))
    act(() => result.current.selectBlock("h2"))
    expect(result.current.selectedId).toBe("h2")
    expect(asBlockNode(result.current.selectedBlock!).id).toBe("h2")
    expect(result.current.selectedPath).toEqual([{ kind: "root", index: 1 }])
  })

  it("selectBlock for a nested id computes the deep path", () => {
    const { result } = renderHook(() => useCanvasState(baseSchema([card("c1", [heading("h-deep")])])))
    act(() => result.current.selectBlock("h-deep"))
    expect(result.current.selectedPath).toEqual([
      { kind: "root", index: 0 },
      { kind: "blocks", index: 0 },
    ])
  })

  it("selectBlock(null) clears the selection", () => {
    const { result } = renderHook(() => useCanvasState(baseSchema([heading("h1")])))
    act(() => result.current.selectBlock("h1"))
    act(() => result.current.selectBlock(null))
    expect(result.current.selectedId).toBeNull()
    expect(result.current.selectedBlock).toBeNull()
  })

  it("selectBlock for an unknown id leaves selectedBlock null without crashing", () => {
    const { result } = renderHook(() => useCanvasState(baseSchema([heading("h1")])))
    act(() => result.current.selectBlock("missing"))
    expect(result.current.selectedId).toBe("missing")
    expect(result.current.selectedBlock).toBeNull()
    expect(result.current.selectedPath).toBeNull()
  })
})

// ─── Insert ──────────────────────────────────────────────────────────────

describe("useCanvasState — insertBlock", () => {
  it("inserts at the root position", () => {
    const { result } = renderHook(() => useCanvasState(baseSchema([heading("h1")])))
    act(() => {
      result.current.insertBlock(null, { kind: "root", index: 0 }, 1, heading("h2"))
    })
    expect(result.current.schema.blocks.map(b => asBlockNode(b).id)).toEqual(["h1", "h2"])
  })

  it("inserts inside a card.blocks slot", () => {
    const { result } = renderHook(() => useCanvasState(baseSchema([card("c1", [])])))
    act(() => {
      result.current.insertBlock([{ kind: "root", index: 0 }], { kind: "blocks", index: 0 }, 0, heading("h-new"))
    })
    const cardChildren = asBlockNode(result.current.schema.blocks[0]!).blocks!
    expect(cardChildren.map(b => asBlockNode(b).id)).toEqual(["h-new"])
  })

  it("inserts inside a specific tab keyed by tabId", () => {
    const { result } = renderHook(() =>
      useCanvasState(
        baseSchema([
          tabs("t1", [
            { id: "tab-a", blocks: [] },
            { id: "tab-b", blocks: [] },
          ]),
        ]),
      ),
    )
    act(() => {
      result.current.insertBlock(
        [{ kind: "root", index: 0 }],
        { kind: "tab", tabId: "tab-b", index: 0 },
        0,
        heading("h-in-b"),
      )
    })
    const tabsBlock = asBlockNode(result.current.schema.blocks[0]!)
    expect(tabsBlock.tabs![0]!.blocks).toHaveLength(0)
    expect(tabsBlock.tabs![1]!.blocks.map(b => asBlockNode(b).id)).toEqual(["h-in-b"])
  })

  it("rejects an insert into a form block (notify + schema unchanged)", () => {
    const initial = baseSchema([form("f1")])
    const { result } = renderHook(() => useCanvasState(initial))
    act(() => {
      result.current.insertBlock([{ kind: "root", index: 0 }], { kind: "blocks", index: 0 }, 0, heading("h-new"))
    })
    expect(mocks.warning).toHaveBeenCalled()
    expect(result.current.schema).toBe(initial) // no commit happened
  })

  it("auto-selects the inserted block by id", () => {
    const { result } = renderHook(() => useCanvasState(baseSchema([])))
    act(() => {
      result.current.insertBlock(null, { kind: "root", index: 0 }, 0, heading("h-new"))
    })
    expect(result.current.selectedId).toBe("h-new")
    expect(asBlockNode(result.current.selectedBlock!).id).toBe("h-new")
  })

  it("flips isDirty + enables undo after inserting", () => {
    const { result } = renderHook(() => useCanvasState(baseSchema([])))
    act(() => {
      result.current.insertBlock(null, { kind: "root", index: 0 }, 0, heading("h-new"))
    })
    expect(result.current.isDirty).toBe(true)
    expect(result.current.canUndo).toBe(true)
  })
})

// ─── Remove ──────────────────────────────────────────────────────────────

describe("useCanvasState — remove", () => {
  it("removeBlockAt deletes a root block", () => {
    const { result } = renderHook(() => useCanvasState(baseSchema([heading("h1"), heading("h2")])))
    act(() => result.current.removeBlockAt([{ kind: "root", index: 0 }]))
    expect(result.current.schema.blocks.map(b => asBlockNode(b).id)).toEqual(["h2"])
  })

  it("removeBlockAt deletes a nested block (depth 2)", () => {
    const { result } = renderHook(() => useCanvasState(baseSchema([card("c1", [heading("h1"), heading("h2")])])))
    act(() => {
      result.current.removeBlockAt([
        { kind: "root", index: 0 },
        { kind: "blocks", index: 0 },
      ])
    })
    const cardChildren = asBlockNode(result.current.schema.blocks[0]!).blocks!
    expect(cardChildren.map(b => asBlockNode(b).id)).toEqual(["h2"])
  })

  it("clears selection when the removed block was the selected one", () => {
    const { result } = renderHook(() => useCanvasState(baseSchema([heading("h1")])))
    act(() => result.current.selectBlock("h1"))
    act(() => result.current.removeBlockAt([{ kind: "root", index: 0 }]))
    expect(result.current.selectedId).toBeNull()
  })

  it("preserves selection when removing a different block", () => {
    const { result } = renderHook(() => useCanvasState(baseSchema([heading("h1"), heading("h2")])))
    act(() => result.current.selectBlock("h2"))
    act(() => result.current.removeBlockAt([{ kind: "root", index: 0 }]))
    // h2 is still present at index 0 after removing h1
    expect(result.current.selectedId).toBe("h2")
    expect(asBlockNode(result.current.selectedBlock!).id).toBe("h2")
  })

  it("removeBlockById resolves the path internally", () => {
    const { result } = renderHook(() => useCanvasState(baseSchema([card("c1", [heading("h1"), heading("h2")])])))
    act(() => result.current.removeBlockById("h1"))
    const cardChildren = asBlockNode(result.current.schema.blocks[0]!).blocks!
    expect(cardChildren.map(b => asBlockNode(b).id)).toEqual(["h2"])
  })
})

// ─── Update ──────────────────────────────────────────────────────────────

describe("useCanvasState — update", () => {
  it("updateBlockAt replaces a root block (immutable)", () => {
    const initial = baseSchema([heading("h1", "old")])
    const { result } = renderHook(() => useCanvasState(initial))
    act(() => {
      result.current.updateBlockAt([{ kind: "root", index: 0 }], heading("h1", "new"))
    })
    expect(result.current.schema).not.toBe(initial)
    const updated = result.current.schema.blocks[0] as unknown as { text: { en: string } }
    expect(updated.text.en).toBe("new")
  })

  it("updateBlockAt updates a nested block without aliasing the input schema", () => {
    const initial = baseSchema([card("c1", [heading("h1", "old")])])
    const { result } = renderHook(() => useCanvasState(initial))
    act(() => {
      result.current.updateBlockAt(
        [
          { kind: "root", index: 0 },
          { kind: "blocks", index: 0 },
        ],
        heading("h1", "new"),
      )
    })
    const original = (initial.blocks[0] as unknown as { blocks: BlockSchema[] }).blocks[0]
    const originalText = (original as unknown as { text: { en: string } }).text.en
    expect(originalText).toBe("old") // input untouched
    const updated = asBlockNode(result.current.schema.blocks[0]!).blocks![0]
    const updatedText = (updated as unknown as { text: { en: string } }).text.en
    expect(updatedText).toBe("new")
  })

  it("updateBlockById applies the same change via id", () => {
    const { result } = renderHook(() => useCanvasState(baseSchema([card("c1", [heading("h1", "old")])])))
    act(() => result.current.updateBlockById("h1", heading("h1", "new")))
    const updated = asBlockNode(result.current.schema.blocks[0]!).blocks![0]
    const updatedText = (updated as unknown as { text: { en: string } }).text.en
    expect(updatedText).toBe("new")
  })

  it("selectedBlock reflects the updated content (computed from schema)", () => {
    const { result } = renderHook(() => useCanvasState(baseSchema([heading("h1", "old")])))
    act(() => result.current.selectBlock("h1"))
    act(() => result.current.updateBlockAt([{ kind: "root", index: 0 }], heading("h1", "new")))
    const selectedText = (result.current.selectedBlock as unknown as { text: { en: string } }).text.en
    expect(selectedText).toBe("new")
  })
})

// ─── Move ────────────────────────────────────────────────────────────────

describe("useCanvasState — move", () => {
  it("reorders within the same root array", () => {
    const { result } = renderHook(() => useCanvasState(baseSchema([heading("h1"), heading("h2"), heading("h3")])))
    act(() => {
      result.current.moveBlock([{ kind: "root", index: 0 }], null, { kind: "root", index: 0 }, 2)
    })
    expect(result.current.schema.blocks.map(b => asBlockNode(b).id)).toEqual(["h2", "h1", "h3"])
  })

  it("moves a block from root into a card", () => {
    const { result } = renderHook(() => useCanvasState(baseSchema([card("c1", []), heading("h1")])))
    act(() => {
      result.current.moveBlock(
        [{ kind: "root", index: 1 }],
        [{ kind: "root", index: 0 }],
        { kind: "blocks", index: 0 },
        0,
      )
    })
    expect(result.current.schema.blocks).toHaveLength(1)
    const cardChildren = asBlockNode(result.current.schema.blocks[0]!).blocks!
    expect(cardChildren.map(b => asBlockNode(b).id)).toEqual(["h1"])
  })

  it("rejects a cycle (block into its own descendant) without committing", () => {
    const initial = baseSchema([card("outer", [card("inner", [])])])
    const { result } = renderHook(() => useCanvasState(initial))
    act(() => {
      result.current.moveBlock(
        [{ kind: "root", index: 0 }],
        [
          { kind: "root", index: 0 },
          { kind: "blocks", index: 0 },
        ],
        { kind: "blocks", index: 0 },
        0,
      )
    })
    expect(mocks.warning).toHaveBeenCalled()
    expect(result.current.schema).toBe(initial)
  })

  it("preserves selectedId across a move and recomputes selectedPath", () => {
    const { result } = renderHook(() => useCanvasState(baseSchema([card("c1", []), heading("h1")])))
    act(() => result.current.selectBlock("h1"))
    expect(result.current.selectedPath).toEqual([{ kind: "root", index: 1 }])
    act(() => {
      result.current.moveBlock(
        [{ kind: "root", index: 1 }],
        [{ kind: "root", index: 0 }],
        { kind: "blocks", index: 0 },
        0,
      )
    })
    expect(result.current.selectedId).toBe("h1")
    expect(result.current.selectedPath).toEqual([
      { kind: "root", index: 0 },
      { kind: "blocks", index: 0 },
    ])
  })
})

// ─── Duplicate ───────────────────────────────────────────────────────────

describe("useCanvasState — duplicate", () => {
  it("returns the new id and inserts the duplicate after the original", () => {
    const { result } = renderHook(() => useCanvasState(baseSchema([heading("h1")])))
    let newId = ""
    act(() => {
      newId = result.current.duplicateBlockAt([{ kind: "root", index: 0 }]) ?? ""
    })
    expect(newId).not.toBe("h1")
    expect(result.current.schema.blocks).toHaveLength(2)
    expect(asBlockNode(result.current.schema.blocks[1]!).id).toBe(newId)
  })

  it("auto-selects the duplicate", () => {
    const { result } = renderHook(() => useCanvasState(baseSchema([heading("h1")])))
    let newId = ""
    act(() => {
      newId = result.current.duplicateBlockAt([{ kind: "root", index: 0 }]) ?? ""
    })
    expect(result.current.selectedId).toBe(newId)
  })

  it("regenerates ids for every descendant of the duplicated subtree", () => {
    const { result } = renderHook(() => useCanvasState(baseSchema([card("c1", [heading("h1"), heading("h2")])])))
    act(() => result.current.duplicateBlockAt([{ kind: "root", index: 0 }]))
    const original = asBlockNode(result.current.schema.blocks[0]!)
    const dup = asBlockNode(result.current.schema.blocks[1]!)
    expect(dup.id).not.toBe(original.id)
    expect(asBlockNode(dup.blocks![0]!).id).not.toBe("h1")
    expect(asBlockNode(dup.blocks![1]!).id).not.toBe("h2")
  })
})

// ─── History ─────────────────────────────────────────────────────────────

describe("useCanvasState — history", () => {
  it("undo restores the previous schema", () => {
    const { result } = renderHook(() => useCanvasState(baseSchema([])))
    act(() => result.current.insertBlock(null, { kind: "root", index: 0 }, 0, heading("h1")))
    expect(result.current.schema.blocks).toHaveLength(1)
    act(() => result.current.undo())
    expect(result.current.schema.blocks).toHaveLength(0)
    expect(result.current.canRedo).toBe(true)
  })

  it("redo reapplies an undone change", () => {
    const { result } = renderHook(() => useCanvasState(baseSchema([])))
    act(() => result.current.insertBlock(null, { kind: "root", index: 0 }, 0, heading("h1")))
    act(() => result.current.undo())
    act(() => result.current.redo())
    expect(result.current.schema.blocks).toHaveLength(1)
  })

  it("history is capped at 20 entries", () => {
    const { result } = renderHook(() => useCanvasState(baseSchema([])))
    for (let i = 0; i < 25; i++) {
      const id = `h-${i}`
      act(() => result.current.insertBlock(null, { kind: "root", index: 0 }, i, heading(id)))
    }
    let undoCount = 0
    while (result.current.canUndo && undoCount < 30) {
      act(() => result.current.undo())
      undoCount += 1
    }
    expect(undoCount).toBe(20)
  })

  it("selectedId is OUTSIDE history — undo does not restore the prior selection", () => {
    const { result } = renderHook(() => useCanvasState(baseSchema([])))
    act(() => result.current.insertBlock(null, { kind: "root", index: 0 }, 0, heading("h1")))
    expect(result.current.selectedId).toBe("h1")
    act(() => result.current.selectBlock(null))
    act(() => result.current.undo())
    // Selection stays cleared even though the schema reverts.
    expect(result.current.selectedId).toBeNull()
  })
})

// ─── Persistence ─────────────────────────────────────────────────────────

describe("useCanvasState — persistence", () => {
  it("save flips isDirty back to false", () => {
    const { result } = renderHook(() => useCanvasState(baseSchema([])))
    act(() => result.current.insertBlock(null, { kind: "root", index: 0 }, 0, heading("h1")))
    expect(result.current.isDirty).toBe(true)
    act(() => result.current.save())
    expect(result.current.isDirty).toBe(false)
  })

  it("discard restores the saved snapshot, clears history, clears selection", () => {
    const { result } = renderHook(() => useCanvasState(baseSchema([])))
    act(() => result.current.insertBlock(null, { kind: "root", index: 0 }, 0, heading("h1")))
    act(() => result.current.insertBlock(null, { kind: "root", index: 0 }, 1, heading("h2")))
    act(() => result.current.discard())
    expect(result.current.schema.blocks).toHaveLength(0)
    expect(result.current.canUndo).toBe(false)
    expect(result.current.isDirty).toBe(false)
    expect(result.current.selectedId).toBeNull()
  })

  it("replaceSchema commits and clears selection", () => {
    const { result } = renderHook(() => useCanvasState(baseSchema([heading("h1")])))
    act(() => result.current.selectBlock("h1"))
    expect(result.current.selectedId).toBe("h1")
    act(() => result.current.replaceSchema(baseSchema([heading("other")])))
    expect(result.current.selectedId).toBeNull()
    expect(result.current.canUndo).toBe(true) // it's an undoable bulk replace
  })
})

// ─── Convenience wrappers ────────────────────────────────────────────────

describe("useCanvasState — id-based wrappers", () => {
  it("removeBlockById resolves the same path as removeBlockAt", () => {
    const { result: viaPath } = renderHook(() =>
      useCanvasState(baseSchema([card("c1", [heading("h1"), heading("h2")])])),
    )
    const { result: viaId } = renderHook(() => useCanvasState(baseSchema([card("c1", [heading("h1"), heading("h2")])])))
    act(() =>
      viaPath.current.removeBlockAt([
        { kind: "root", index: 0 },
        { kind: "blocks", index: 0 },
      ]),
    )
    act(() => viaId.current.removeBlockById("h1"))
    expect(JSON.stringify(viaPath.current.schema)).toBe(JSON.stringify(viaId.current.schema))
  })

  it("updateBlockById resolves the same path as updateBlockAt", () => {
    const { result: viaPath } = renderHook(() => useCanvasState(baseSchema([card("c1", [heading("h1", "old")])])))
    const { result: viaId } = renderHook(() => useCanvasState(baseSchema([card("c1", [heading("h1", "old")])])))
    const replacement = heading("h1", "new")
    act(() =>
      viaPath.current.updateBlockAt(
        [
          { kind: "root", index: 0 },
          { kind: "blocks", index: 0 },
        ],
        replacement,
      ),
    )
    act(() => viaId.current.updateBlockById("h1", replacement))
    expect(JSON.stringify(viaPath.current.schema)).toBe(JSON.stringify(viaId.current.schema))
  })

  it("duplicateBlockById returns the new id and inserts the duplicate", () => {
    const { result } = renderHook(() => useCanvasState(baseSchema([heading("h1")])))
    let newId: string | null = null
    act(() => {
      newId = result.current.duplicateBlockById("h1")
    })
    expect(newId).not.toBeNull()
    expect(result.current.schema.blocks).toHaveLength(2)
    expect(asBlockNode(result.current.schema.blocks[1]!).id).toBe(newId)
  })

  it("removeBlockById is a no-op for an unknown id", () => {
    const initial = baseSchema([heading("h1")])
    const { result } = renderHook(() => useCanvasState(initial))
    act(() => result.current.removeBlockById("ghost"))
    expect(result.current.schema).toBe(initial)
    expect(result.current.canUndo).toBe(false)
  })
})

// ─── beforeunload guard ──────────────────────────────────────────────────

describe("useCanvasState — beforeunload guard", () => {
  it("attaches a beforeunload listener while dirty + removes it on save", () => {
    const addSpy = vi.spyOn(window, "addEventListener")
    const removeSpy = vi.spyOn(window, "removeEventListener")
    const { result } = renderHook(() => useCanvasState(baseSchema([])))
    act(() => result.current.insertBlock(null, { kind: "root", index: 0 }, 0, heading("h1")))
    expect(addSpy.mock.calls.some(([name]) => name === "beforeunload")).toBe(true)
    act(() => result.current.save())
    expect(removeSpy.mock.calls.some(([name]) => name === "beforeunload")).toBe(true)
    addSpy.mockRestore()
    removeSpy.mockRestore()
  })
})
