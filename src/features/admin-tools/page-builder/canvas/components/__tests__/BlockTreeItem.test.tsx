import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { BlockTreeItem } from "../BlockTreeItem"
import { baseSchema, card, heading, makeMockState } from "./test-utils"
import type { BlockPath } from "../../tree"

vi.mock("@/ui/theme/ThemeManager", () => ({
  useTheme: () => ({ settings: {} }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}))

// Capture the latest useSortable args + supply controllable return values.
// Tests that need a specific return (e.g. isDragging=true, isOver=true)
// override `mocks.sortableReturn` BEFORE calling render.
const mocks = vi.hoisted(() => ({
  lastSortableArgs: undefined as unknown,
  // Counts every useSortable call so memoisation tests can prove that
  // React.memo's comparator stopped a re-render (when memo blocks the
  // render, the body — and thus useSortable — doesn't run again).
  useSortableCallCount: 0,
  sortableReturn: {
    attributes: { "aria-roledescription": "sortable", role: "button", tabIndex: 0 },
    listeners: { onPointerDown: () => {} },
    setNodeRef: () => {},
    transform: null,
    transition: undefined,
    isDragging: false,
    isOver: false,
  },
}))

vi.mock("@dnd-kit/sortable", () => ({
  useSortable: (args: unknown) => {
    mocks.lastSortableArgs = args
    mocks.useSortableCallCount += 1
    return mocks.sortableReturn
  },
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  verticalListSortingStrategy: () => ({}),
}))

vi.mock("@dnd-kit/utilities", () => ({
  CSS: {
    Transform: { toString: () => undefined },
  },
}))

vi.mock("@dnd-kit/core", () => ({
  useDroppable: () => ({
    setNodeRef: () => {},
    isOver: false,
    node: { current: null },
    rect: { current: null },
    over: null,
    active: null,
  }),
}))

const rootPath = (index: number): BlockPath => [{ kind: "root", index }]

describe("BlockTreeItem — chevron", () => {
  it("renders no chevron for a leaf block (heading)", () => {
    const block = heading("h1")
    const state = makeMockState(baseSchema([block]))
    render(
      <BlockTreeItem
        block={block}
        path={rootPath(0)}
        depth={0}
        state={state}
        expandedIds={new Set()}
        onToggleExpand={vi.fn()}
        siblingCount={1}
        siblingIndex={0}
      />,
    )
    expect(screen.queryByTestId("tree-expand-h1")).toBeNull()
    expect(screen.getByTestId("tree-item-h1")).toBeInTheDocument()
  })
})

describe("BlockTreeItem — selection + container shape", () => {
  it("renders a chevron for a container block (card)", () => {
    const block = card("c1", [])
    const state = makeMockState(baseSchema([block]))
    render(
      <BlockTreeItem
        block={block}
        path={rootPath(0)}
        depth={0}
        state={state}
        expandedIds={new Set(["c1"])}
        onToggleExpand={vi.fn()}
        siblingCount={1}
        siblingIndex={0}
      />,
    )
    expect(screen.getByTestId("tree-expand-c1")).toBeInTheDocument()
  })

  it("highlights the selected block", () => {
    const block = heading("h1")
    const state = makeMockState(baseSchema([block]), { selectedId: "h1" })
    render(
      <BlockTreeItem
        block={block}
        path={rootPath(0)}
        depth={0}
        state={state}
        expandedIds={new Set()}
        onToggleExpand={vi.fn()}
        siblingCount={1}
        siblingIndex={0}
      />,
    )
    const button = screen.getByTestId("tree-item-h1")
    expect(button.className).toContain("border-primary")
  })

  it("calls state.selectBlock on click", () => {
    const block = heading("h1")
    const state = makeMockState(baseSchema([block]))
    render(
      <BlockTreeItem
        block={block}
        path={rootPath(0)}
        depth={0}
        state={state}
        expandedIds={new Set()}
        onToggleExpand={vi.fn()}
        siblingCount={1}
        siblingIndex={0}
      />,
    )
    fireEvent.click(screen.getByTestId("tree-item-h1"))
    expect(state.selectBlock).toHaveBeenCalledWith("h1")
  })
})

describe("BlockTreeItem — Move ↑↓", () => {
  it("disables Move ↑ on the first sibling and Move ↓ on the last", () => {
    const blocks = [heading("h1"), heading("h2"), heading("h3")]
    const state = makeMockState(baseSchema(blocks))
    render(
      <>
        <BlockTreeItem
          block={blocks[0]!}
          path={rootPath(0)}
          depth={0}
          state={state}
          expandedIds={new Set()}
          onToggleExpand={vi.fn()}
          siblingCount={3}
          siblingIndex={0}
        />
        <BlockTreeItem
          block={blocks[2]!}
          path={rootPath(2)}
          depth={0}
          state={state}
          expandedIds={new Set()}
          onToggleExpand={vi.fn()}
          siblingCount={3}
          siblingIndex={2}
        />
      </>,
    )
    expect(screen.getByTestId("tree-move-up-h1")).toBeDisabled()
    expect(screen.getByTestId("tree-move-down-h3")).toBeDisabled()
  })

  it("calls state.moveBlock with index-1 when Move ↑ is clicked", () => {
    const block = heading("h2")
    const state = makeMockState(baseSchema([heading("h1"), block]))
    render(
      <BlockTreeItem
        block={block}
        path={rootPath(1)}
        depth={0}
        state={state}
        expandedIds={new Set()}
        onToggleExpand={vi.fn()}
        siblingCount={2}
        siblingIndex={1}
      />,
    )
    fireEvent.click(screen.getByTestId("tree-move-up-h2"))
    expect(state.moveBlock).toHaveBeenCalledWith(rootPath(1), null, { kind: "root", index: 1 }, 0)
  })

  it("calls state.moveBlock with index+1 when Move ↓ is clicked", () => {
    const block = heading("h1")
    const state = makeMockState(baseSchema([block, heading("h2")]))
    render(
      <BlockTreeItem
        block={block}
        path={rootPath(0)}
        depth={0}
        state={state}
        expandedIds={new Set()}
        onToggleExpand={vi.fn()}
        siblingCount={2}
        siblingIndex={0}
      />,
    )
    fireEvent.click(screen.getByTestId("tree-move-down-h1"))
    expect(state.moveBlock).toHaveBeenCalledWith(rootPath(0), null, { kind: "root", index: 0 }, 1)
  })
})

describe("BlockTreeItem — drag-and-drop wiring", () => {
  it("renders a drag handle next to the row", () => {
    const block = heading("h1")
    const state = makeMockState(baseSchema([block]))
    render(
      <BlockTreeItem
        block={block}
        path={rootPath(0)}
        depth={0}
        state={state}
        expandedIds={new Set()}
        onToggleExpand={vi.fn()}
        siblingCount={1}
        siblingIndex={0}
      />,
    )
    expect(screen.getByTestId("tree-drag-handle-h1")).toBeInTheDocument()
  })

  it("calls useSortable with the block id and the path payload", () => {
    mocks.lastSortableArgs = undefined
    const block = heading("h-deep")
    const state = makeMockState(baseSchema([card("c1", [block])]))
    render(
      <BlockTreeItem
        block={block}
        path={[
          { kind: "root", index: 0 },
          { kind: "blocks", index: 0 },
        ]}
        depth={1}
        state={state}
        expandedIds={new Set()}
        onToggleExpand={vi.fn()}
        siblingCount={1}
        siblingIndex={0}
      />,
    )
    expect(mocks.lastSortableArgs).toEqual({
      id: "h-deep",
      data: {
        path: [
          { kind: "root", index: 0 },
          { kind: "blocks", index: 0 },
        ],
      },
    })
  })

  it("dims the row to opacity 0.4 while dragging", () => {
    mocks.sortableReturn = { ...mocks.sortableReturn, isDragging: true }
    const block = heading("h1")
    const state = makeMockState(baseSchema([block]))
    render(
      <BlockTreeItem
        block={block}
        path={rootPath(0)}
        depth={0}
        state={state}
        expandedIds={new Set()}
        onToggleExpand={vi.fn()}
        siblingCount={1}
        siblingIndex={0}
      />,
    )
    const li = screen.getByTestId("tree-item-li-h1") as HTMLElement
    expect(li.style.opacity).toBe("0.4")
    // restore default for subsequent tests
    mocks.sortableReturn = { ...mocks.sortableReturn, isDragging: false }
  })

  it("renders at full opacity while not dragging", () => {
    mocks.sortableReturn = { ...mocks.sortableReturn, isDragging: false }
    const block = heading("h1")
    const state = makeMockState(baseSchema([block]))
    render(
      <BlockTreeItem
        block={block}
        path={rootPath(0)}
        depth={0}
        state={state}
        expandedIds={new Set()}
        onToggleExpand={vi.fn()}
        siblingCount={1}
        siblingIndex={0}
      />,
    )
    const li = screen.getByTestId("tree-item-li-h1") as HTMLElement
    expect(li.style.opacity).toBe("1")
  })
})

describe("BlockTreeItem — drop-line indicator", () => {
  it("stamps data-over='true' on the li when sortable.isOver is true (drop-line target)", () => {
    mocks.sortableReturn = { ...mocks.sortableReturn, isOver: true }
    const block = heading("h1")
    const state = makeMockState(baseSchema([block]))
    render(
      <BlockTreeItem
        block={block}
        path={rootPath(0)}
        depth={0}
        state={state}
        expandedIds={new Set()}
        onToggleExpand={vi.fn()}
        siblingCount={1}
        siblingIndex={0}
      />,
    )
    expect(screen.getByTestId("tree-item-li-h1")).toHaveAttribute("data-over", "true")
    // restore default for subsequent tests
    mocks.sortableReturn = { ...mocks.sortableReturn, isOver: false }
  })

  it("does NOT set data-over when sortable.isOver is false", () => {
    mocks.sortableReturn = { ...mocks.sortableReturn, isOver: false }
    const block = heading("h1")
    const state = makeMockState(baseSchema([block]))
    render(
      <BlockTreeItem
        block={block}
        path={rootPath(0)}
        depth={0}
        state={state}
        expandedIds={new Set()}
        onToggleExpand={vi.fn()}
        siblingCount={1}
        siblingIndex={0}
      />,
    )
    expect(screen.getByTestId("tree-item-li-h1")).not.toHaveAttribute("data-over")
  })
})

describe("BlockTreeItem — nested + expand toggle", () => {
  it("derives parentPath = card.path when the item lives inside a card", () => {
    const innerBlock = heading("inner")
    const cardBlock = card("c1", [innerBlock])
    const state = makeMockState(baseSchema([cardBlock]))
    render(
      <BlockTreeItem
        block={innerBlock}
        path={[
          { kind: "root", index: 0 },
          { kind: "blocks", index: 0 },
        ]}
        depth={1}
        state={state}
        expandedIds={new Set()}
        onToggleExpand={vi.fn()}
        siblingCount={1}
        siblingIndex={0}
      />,
    )
    // siblingCount === 1 → both Move ↑ and Move ↓ are disabled.
    expect(screen.getByTestId("tree-move-up-inner")).toBeDisabled()
    expect(screen.getByTestId("tree-move-down-inner")).toBeDisabled()
  })

  it("toggles expand when the chevron is clicked", () => {
    const block = card("c1", [heading("inner")])
    const state = makeMockState(baseSchema([block]))
    const onToggle = vi.fn()
    render(
      <BlockTreeItem
        block={block}
        path={rootPath(0)}
        depth={0}
        state={state}
        expandedIds={new Set(["c1"])}
        onToggleExpand={onToggle}
        siblingCount={1}
        siblingIndex={0}
      />,
    )
    fireEvent.click(screen.getByTestId("tree-expand-c1"))
    expect(onToggle).toHaveBeenCalledWith("c1")
  })
})

// ─── TASK 2B.4 — React.memo behaviour ────────────────────────────────────

describe("BlockTreeItem — memoisation comparator", () => {
  it("skips re-render when only an unrelated property of `state` changes", () => {
    const block = heading("h1")
    const initialState = makeMockState(baseSchema([block]))
    const onToggleExpand = vi.fn()
    const expandedIds = new Set<string>()
    const { rerender } = render(
      <BlockTreeItem
        block={block}
        path={rootPath(0)}
        depth={0}
        state={initialState}
        expandedIds={expandedIds}
        onToggleExpand={onToggleExpand}
        siblingCount={1}
        siblingIndex={0}
      />,
    )
    const before = mocks.useSortableCallCount
    // A new `state` reference with a different selectedId — but pointing
    // at a DIFFERENT block, not this one. The comparator should treat
    // the "is this item selected?" boolean as unchanged and skip render.
    // Stability of every other prop (path, expandedIds, onToggleExpand)
    // is what lets the comparator return true.
    const nextState = { ...initialState, selectedId: "some-other-block" }
    rerender(
      <BlockTreeItem
        block={block}
        path={rootPath(0)}
        depth={0}
        state={nextState as never}
        expandedIds={expandedIds}
        onToggleExpand={onToggleExpand}
        siblingCount={1}
        siblingIndex={0}
      />,
    )
    expect(mocks.useSortableCallCount).toBe(before)
  })

  it("re-renders when selectedId flips to this block's id", () => {
    const block = heading("h-target")
    const initialState = makeMockState(baseSchema([block]))
    const { rerender } = render(
      <BlockTreeItem
        block={block}
        path={rootPath(0)}
        depth={0}
        state={initialState}
        expandedIds={new Set()}
        onToggleExpand={vi.fn()}
        siblingCount={1}
        siblingIndex={0}
      />,
    )
    const before = mocks.useSortableCallCount
    const nextState = { ...initialState, selectedId: "h-target" }
    rerender(
      <BlockTreeItem
        block={block}
        path={rootPath(0)}
        depth={0}
        state={nextState as never}
        expandedIds={new Set()}
        onToggleExpand={vi.fn()}
        siblingCount={1}
        siblingIndex={0}
      />,
    )
    expect(mocks.useSortableCallCount).toBeGreaterThan(before)
  })
})

describe("BlockTreeItem — memoisation re-render triggers", () => {
  it("re-renders when this block's expand state changes", () => {
    const block = card("c1", [heading("inner")])
    const state = makeMockState(baseSchema([block]))
    const { rerender } = render(
      <BlockTreeItem
        block={block}
        path={rootPath(0)}
        depth={0}
        state={state}
        expandedIds={new Set()}
        onToggleExpand={vi.fn()}
        siblingCount={1}
        siblingIndex={0}
      />,
    )
    const before = mocks.useSortableCallCount
    rerender(
      <BlockTreeItem
        block={block}
        path={rootPath(0)}
        depth={0}
        state={state}
        expandedIds={new Set(["c1"])}
        onToggleExpand={vi.fn()}
        siblingCount={1}
        siblingIndex={0}
      />,
    )
    expect(mocks.useSortableCallCount).toBeGreaterThan(before)
  })

  it("re-renders when sibling position changes (parent slot reordered)", () => {
    const block = heading("h1")
    const state = makeMockState(baseSchema([block]))
    const { rerender } = render(
      <BlockTreeItem
        block={block}
        path={rootPath(0)}
        depth={0}
        state={state}
        expandedIds={new Set()}
        onToggleExpand={vi.fn()}
        siblingCount={2}
        siblingIndex={0}
      />,
    )
    const before = mocks.useSortableCallCount
    rerender(
      <BlockTreeItem
        block={block}
        path={rootPath(1)}
        depth={0}
        state={state}
        expandedIds={new Set()}
        onToggleExpand={vi.fn()}
        siblingCount={2}
        siblingIndex={1}
      />,
    )
    expect(mocks.useSortableCallCount).toBeGreaterThan(before)
  })
})

// ─── TASK 2B.4 — DragHandle context plumbing ─────────────────────────────

describe("BlockTreeItem — DragHandle accessibility props", () => {
  it("forwards displayName + sibling position so DragHandle's aria-label is contextual", () => {
    const block = heading("h-aria")
    const state = makeMockState(baseSchema([block, heading("sibling")]))
    render(
      <BlockTreeItem
        block={block}
        path={rootPath(0)}
        depth={0}
        state={state}
        expandedIds={new Set()}
        onToggleExpand={vi.fn()}
        siblingCount={2}
        siblingIndex={0}
      />,
    )
    const handle = screen.getByTestId("tree-drag-handle-h-aria")
    expect(handle).toHaveAttribute("aria-label", "Drag Heading (item 1 of 2)")
  })
})
