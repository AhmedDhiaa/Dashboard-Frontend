import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { BlockTree } from "../BlockTree"
import { baseSchema, card, heading, makeMockState, tabs } from "./test-utils"

vi.mock("@/ui/theme/ThemeManager", () => ({
  useTheme: () => ({ settings: {} }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}))

const sortableMocks = vi.hoisted(() => ({
  lastSortableContextItems: undefined as unknown,
}))

vi.mock("@dnd-kit/sortable", () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: () => {},
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
  SortableContext: ({ items, children }: { items: unknown; children: React.ReactNode }) => {
    sortableMocks.lastSortableContextItems = items
    return <>{children}</>
  },
  verticalListSortingStrategy: () => ({}),
}))

vi.mock("@dnd-kit/utilities", () => ({
  CSS: { Transform: { toString: () => undefined } },
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

describe("BlockTree", () => {
  it("renders the empty drop zone when the schema has no blocks", () => {
    const state = makeMockState(baseSchema([]))
    render(<BlockTree state={state} />)
    expect(screen.getByTestId("tree-empty-root")).toBeInTheDocument()
    expect(screen.getByText(/Drag a block from the palette/)).toBeInTheDocument()
  })

  it("renders one BlockTreeItem per root block", () => {
    const state = makeMockState(baseSchema([heading("h1"), heading("h2"), heading("h3")]))
    render(<BlockTree state={state} />)
    expect(screen.getByTestId("tree-item-h1")).toBeInTheDocument()
    expect(screen.getByTestId("tree-item-h2")).toBeInTheDocument()
    expect(screen.getByTestId("tree-item-h3")).toBeInTheDocument()
  })

  it("renders nested children for a card by default (containers expanded on mount)", () => {
    const state = makeMockState(baseSchema([card("c1", [heading("inner-1"), heading("inner-2")])]))
    render(<BlockTree state={state} />)
    expect(screen.getByTestId("tree-item-c1")).toBeInTheDocument()
    expect(screen.getByTestId("tree-item-inner-1")).toBeInTheDocument()
    expect(screen.getByTestId("tree-item-inner-2")).toBeInTheDocument()
  })

  it("collapses children when the chevron is clicked", () => {
    const state = makeMockState(baseSchema([card("c1", [heading("inner-1")])]))
    render(<BlockTree state={state} />)
    expect(screen.getByTestId("tree-item-inner-1")).toBeInTheDocument()
    fireEvent.click(screen.getByTestId("tree-expand-c1"))
    expect(screen.queryByTestId("tree-item-inner-1")).toBeNull()
  })

  it("renders three levels deep (card → card → heading)", () => {
    const state = makeMockState(baseSchema([card("outer", [card("inner", [heading("deep")])])]))
    render(<BlockTree state={state} />)
    expect(screen.getByTestId("tree-item-outer")).toBeInTheDocument()
    expect(screen.getByTestId("tree-item-inner")).toBeInTheDocument()
    expect(screen.getByTestId("tree-item-deep")).toBeInTheDocument()
  })

  it("shows tab labels for a tabs block (multi-slot containers)", () => {
    const state = makeMockState(
      baseSchema([
        tabs("t1", [
          { id: "tab-a", label: "First Tab", blocks: [heading("h-in-a")] },
          { id: "tab-b", label: "Second Tab", blocks: [] },
        ]),
      ]),
    )
    render(<BlockTree state={state} />)
    expect(screen.getByTestId("tree-slot-label-tab-tab-a")).toHaveTextContent("First Tab")
    expect(screen.getByTestId("tree-slot-label-tab-tab-b")).toHaveTextContent("Second Tab")
  })

  it("does NOT show a slot label for card (single anonymous body slot)", () => {
    const state = makeMockState(baseSchema([card("c1", [heading("inner")])]))
    render(<BlockTree state={state} />)
    expect(screen.queryByText(/Card body/i)).toBeNull()
  })

  it("wraps the root iteration with a SortableContext whose items match the root block ids", () => {
    sortableMocks.lastSortableContextItems = undefined
    const state = makeMockState(baseSchema([heading("h1"), heading("h2"), heading("h3")]))
    render(<BlockTree state={state} />)
    expect(sortableMocks.lastSortableContextItems).toEqual(["h1", "h2", "h3"])
  })

  // ─── TASK 2B.4 — stale expandedIds cleanup ───────────────────────────

  it("prunes stale ids from expandedIds when the schema is replaced wholesale", () => {
    // Start with two cards, both expanded by default seedExpanded.
    const initial = baseSchema([card("c1", [heading("h1")]), card("c2", [heading("h2")])])
    const replacement = baseSchema([card("c3", [heading("h3")])])
    const state = makeMockState(initial)
    const { rerender } = render(<BlockTree state={state} />)
    expect(screen.getByTestId("tree-item-h1")).toBeInTheDocument()
    expect(screen.getByTestId("tree-item-h2")).toBeInTheDocument()

    // Mimic state.replaceSchema by handing in a new state object with a
    // brand-new schema; the useEffect cleanup should drop c1 and c2 and
    // seed c3 as expanded once its toggle is opened by the user (initial
    // seed only fires on mount, but the new card lives in the tree).
    rerender(<BlockTree state={makeMockState(replacement)} />)
    expect(screen.queryByTestId("tree-item-h1")).toBeNull()
    expect(screen.queryByTestId("tree-item-h2")).toBeNull()
    // c3 was never seeded into expandedIds (mount happened before the
    // schema change), so its children are NOT visible by default — this
    // is the safe-cleanup behaviour: prune stale ids, don't re-seed new
    // ones.
    expect(screen.queryByTestId("tree-item-h3")).toBeNull()
  })

  it("removes a container's id from expandedIds when the container itself is deleted", () => {
    // Start with one card + one heading at root; both render.
    const withCard = baseSchema([card("c1", [heading("inner")]), heading("h1")])
    const withoutCard = baseSchema([heading("h1")])
    const state = makeMockState(withCard)
    const { rerender } = render(<BlockTree state={state} />)
    expect(screen.getByTestId("tree-item-inner")).toBeInTheDocument()

    rerender(<BlockTree state={makeMockState(withoutCard)} />)
    // The card is gone — inner heading too.
    expect(screen.queryByTestId("tree-item-inner")).toBeNull()
    // h1 still renders at root.
    expect(screen.getByTestId("tree-item-h1")).toBeInTheDocument()
  })
})
