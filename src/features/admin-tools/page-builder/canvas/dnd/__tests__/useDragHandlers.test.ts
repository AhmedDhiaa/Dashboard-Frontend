import { describe, it, expect, vi } from "vitest"
import { act, renderHook } from "@testing-library/react"
import { useDragHandlers } from "../useDragHandlers"
import type { useCanvasState } from "../../hooks/useCanvasState"
import type { BlockPath, PathSegment } from "../../tree/types"
import type { BlockSchema } from "../../../schema/block-schema"

const asBlock = <T>(b: T) => b as unknown as BlockSchema

// Minimal mock that satisfies the type but only stubs what the handler reads.
function makeState(overrides?: Partial<ReturnType<typeof useCanvasState>>) {
  return {
    moveBlock: vi.fn(),
    insertBlock: vi.fn(),
    removeBlockAt: vi.fn(),
    updateBlockAt: vi.fn(),
    duplicateBlockAt: vi.fn(),
    removeBlockById: vi.fn(),
    updateBlockById: vi.fn(),
    duplicateBlockById: vi.fn(),
    replaceSchema: vi.fn(),
    selectBlock: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    save: vi.fn(),
    discard: vi.fn(),
    schema: {
      id: "x",
      version: "1.0",
      title: { en: "", ar: "" },
      permission: "Api.Admin.PageBuilder",
      layout: "full",
      blocks: [],
    },
    selectedId: null,
    selectedPath: null,
    selectedBlock: null,
    isDirty: false,
    canUndo: false,
    canRedo: false,
    ...overrides,
  } as unknown as ReturnType<typeof useCanvasState>
}

// dnd-kit DragEndEvent only carries the bits we read. Stub them.
type MockOverData = { path: BlockPath } | { type: "slot"; parentPath: BlockPath; slot: PathSegment }

function makeEvent(activeId: string, overId: string | null, activeData?: { path: BlockPath }, overData?: MockOverData) {
  return {
    active: { id: activeId, data: { current: activeData } },
    over: overId === null ? null : { id: overId, data: { current: overData } },
  } as never
}

function makeStartEvent(activeId: string) {
  return { active: { id: activeId, data: { current: undefined } } } as never
}

describe("useDragHandlers — drop into different parents", () => {
  it("calls moveBlock with the over-item's parent + slot when dropped within the same root array", () => {
    const state = makeState()
    const { result } = renderHook(() => useDragHandlers(state))

    const fromPath: BlockPath = [{ kind: "root", index: 0 }]
    const toPath: BlockPath = [{ kind: "root", index: 2 }]
    result.current.handleDragEnd(makeEvent("h1", "h3", { path: fromPath }, { path: toPath }))

    expect(state.moveBlock).toHaveBeenCalledWith(fromPath, null, { kind: "root", index: 2 }, 2)
  })

  it("computes parentPath = path.slice(0, -1) when dropping into a card.blocks slot", () => {
    const state = makeState()
    const { result } = renderHook(() => useDragHandlers(state))

    const fromPath: BlockPath = [{ kind: "root", index: 0 }]
    const toPath: BlockPath = [
      { kind: "root", index: 1 },
      { kind: "blocks", index: 0 },
    ]
    result.current.handleDragEnd(makeEvent("h1", "inner", { path: fromPath }, { path: toPath }))

    expect(state.moveBlock).toHaveBeenCalledWith(
      fromPath,
      [{ kind: "root", index: 1 }],
      { kind: "blocks", index: 0 },
      0,
    )
  })

  it("preserves the tabId when the drop target lives in a tabs branch", () => {
    const state = makeState()
    const { result } = renderHook(() => useDragHandlers(state))

    const fromPath: BlockPath = [{ kind: "root", index: 0 }]
    const toPath: BlockPath = [
      { kind: "root", index: 1 },
      { kind: "tab", tabId: "tab-login", index: 2 },
    ]
    result.current.handleDragEnd(makeEvent("h1", "tab-block", { path: fromPath }, { path: toPath }))

    expect(state.moveBlock).toHaveBeenCalledWith(
      fromPath,
      [{ kind: "root", index: 1 }],
      { kind: "tab", tabId: "tab-login", index: 2 },
      2,
    )
  })
})

describe("useDragHandlers — early returns", () => {
  it("no-ops when dropped outside any sortable item (over === null)", () => {
    const state = makeState()
    const { result } = renderHook(() => useDragHandlers(state))
    result.current.handleDragEnd(makeEvent("h1", null))
    expect(state.moveBlock).not.toHaveBeenCalled()
  })

  it("no-ops when dropped on self (active.id === over.id)", () => {
    const state = makeState()
    const { result } = renderHook(() => useDragHandlers(state))
    const path: BlockPath = [{ kind: "root", index: 0 }]
    result.current.handleDragEnd(makeEvent("h1", "h1", { path }, { path }))
    expect(state.moveBlock).not.toHaveBeenCalled()
  })

  it("no-ops + logs when active.data.path is missing", () => {
    const state = makeState()
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {})
    const { result } = renderHook(() => useDragHandlers(state))
    result.current.handleDragEnd(makeEvent("h1", "h2", undefined, { path: [{ kind: "root", index: 1 }] }))
    expect(state.moveBlock).not.toHaveBeenCalled()
    expect(debugSpy).toHaveBeenCalled()
    debugSpy.mockRestore()
  })

  it("no-ops + logs when over.data.path is missing", () => {
    const state = makeState()
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {})
    const { result } = renderHook(() => useDragHandlers(state))
    result.current.handleDragEnd(makeEvent("h1", "h2", { path: [{ kind: "root", index: 0 }] }, undefined))
    expect(state.moveBlock).not.toHaveBeenCalled()
    expect(debugSpy).toHaveBeenCalled()
    debugSpy.mockRestore()
  })
})

// ─── TASK 2B.3 — active state lifecycle ──────────────────────────────────

describe("useDragHandlers — active state lifecycle", () => {
  it("activeId starts null, set on dragStart, cleared on dragEnd", () => {
    const state = makeState()
    const { result } = renderHook(() => useDragHandlers(state))
    expect(result.current.activeId).toBeNull()
    act(() => result.current.handleDragStart(makeStartEvent("h1")))
    expect(result.current.activeId).toBe("h1")
    act(() =>
      result.current.handleDragEnd(
        makeEvent("h1", "h2", { path: [{ kind: "root", index: 0 }] }, { path: [{ kind: "root", index: 1 }] }),
      ),
    )
    expect(result.current.activeId).toBeNull()
  })

  it("handleDragCancel clears activeId without invoking moveBlock", () => {
    const state = makeState()
    const { result } = renderHook(() => useDragHandlers(state))
    act(() => result.current.handleDragStart(makeStartEvent("h1")))
    act(() => result.current.handleDragCancel({} as never))
    expect(result.current.activeId).toBeNull()
    expect(state.moveBlock).not.toHaveBeenCalled()
  })

  it("activeBlock looks up the block from the schema by activeId", () => {
    const block = asBlock({
      id: "h1",
      type: "heading",
      text: { en: "Hi", ar: "مرحبا" },
      level: 2,
      hidden: false,
    })
    const state = makeState({
      schema: {
        id: "x",
        version: "1.0",
        title: { en: "", ar: "" },
        permission: "Api.Admin.PageBuilder",
        layout: "full",
        blocks: [block],
      } as never,
    })
    const { result } = renderHook(() => useDragHandlers(state))
    expect(result.current.activeBlock).toBeNull()
    act(() => result.current.handleDragStart(makeStartEvent("h1")))
    expect(result.current.activeBlock).toEqual(block)
  })

  it("activeBlock is null when activeId points at a block not in the schema", () => {
    const state = makeState() // empty schema
    const { result } = renderHook(() => useDragHandlers(state))
    act(() => result.current.handleDragStart(makeStartEvent("ghost")))
    expect(result.current.activeId).toBe("ghost")
    expect(result.current.activeBlock).toBeNull()
  })
})

// ─── TASK 2B.3 — drop on slot droppable ──────────────────────────────────

describe("useDragHandlers — drop on slot droppable", () => {
  it("routes a slot drop to moveBlock(parentPath, slot, 0)", () => {
    const state = makeState()
    const { result } = renderHook(() => useDragHandlers(state))
    const fromPath: BlockPath = [{ kind: "root", index: 1 }]
    const slotData: MockOverData = {
      type: "slot",
      parentPath: [{ kind: "root", index: 0 }],
      slot: { kind: "blocks", index: 0 },
    }
    result.current.handleDragEnd(makeEvent("h2", "slot-x", { path: fromPath }, slotData))
    expect(state.moveBlock).toHaveBeenCalledWith(
      fromPath,
      [{ kind: "root", index: 0 }],
      { kind: "blocks", index: 0 },
      0,
    )
  })

  it("routes a slot drop with empty parentPath as a root insert (parent = null)", () => {
    const state = makeState()
    const { result } = renderHook(() => useDragHandlers(state))
    const fromPath: BlockPath = [{ kind: "root", index: 1 }]
    const slotData: MockOverData = {
      type: "slot",
      parentPath: [],
      slot: { kind: "root", index: 0 },
    }
    result.current.handleDragEnd(makeEvent("h2", "slot-root", { path: fromPath }, slotData))
    expect(state.moveBlock).toHaveBeenCalledWith(fromPath, null, { kind: "root", index: 0 }, 0)
  })

  it("routes a tab slot drop preserving the tabId", () => {
    const state = makeState()
    const { result } = renderHook(() => useDragHandlers(state))
    const fromPath: BlockPath = [{ kind: "root", index: 0 }]
    const slotData: MockOverData = {
      type: "slot",
      parentPath: [{ kind: "root", index: 1 }],
      slot: { kind: "tab", tabId: "tab-empty", index: 0 },
    }
    result.current.handleDragEnd(makeEvent("h1", "slot-tab-empty", { path: fromPath }, slotData))
    expect(state.moveBlock).toHaveBeenCalledWith(
      fromPath,
      [{ kind: "root", index: 1 }],
      { kind: "tab", tabId: "tab-empty", index: 0 },
      0,
    )
  })
})
