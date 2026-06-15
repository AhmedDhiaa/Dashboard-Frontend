import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { BlockTreeSlot } from "../BlockTreeSlot"
import { baseSchema, card, heading, makeMockState } from "./test-utils"
import type { BlockPath, PathSegment } from "../../tree"

vi.mock("@/ui/theme/ThemeManager", () => ({
  useTheme: () => ({ settings: {} }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}))

const sortableMocks = vi.hoisted(() => ({
  lastSortableContextItems: undefined as unknown,
}))

const droppableMocks = vi.hoisted(() => ({
  lastDroppableArgs: undefined as unknown,
  droppableReturn: {
    setNodeRef: () => {},
    isOver: false,
    node: { current: null },
    rect: { current: null },
    over: null,
    active: null,
  } as { setNodeRef: () => void; isOver: boolean; [k: string]: unknown },
}))

vi.mock("@dnd-kit/sortable", () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: () => {},
    transform: null,
    transition: undefined,
    isDragging: false,
    isOver: false,
  }),
  SortableContext: ({ items, children }: { items: unknown; children: React.ReactNode }) => {
    sortableMocks.lastSortableContextItems = items
    return <>{children}</>
  },
  verticalListSortingStrategy: () => ({}),
}))

vi.mock("@dnd-kit/core", () => ({
  useDroppable: (args: unknown) => {
    droppableMocks.lastDroppableArgs = args
    return droppableMocks.droppableReturn
  },
}))

vi.mock("@dnd-kit/utilities", () => ({
  CSS: { Transform: { toString: () => undefined } },
}))

const cardParentPath: BlockPath = [{ kind: "root", index: 0 }]
const cardSlotSegment: PathSegment = { kind: "blocks", index: 0 }

describe("BlockTreeSlot — slot label visibility", () => {
  it("shows the slot label when showSlotLabel is true (tabs/accordion shape)", () => {
    const state = makeMockState(baseSchema([card("c1", [])]))
    render(
      <BlockTreeSlot
        slotEntry={{
          segment: { kind: "tab", tabId: "tab-a", index: 0 },
          blocks: [heading("h1")],
          slotLabel: "Login",
        }}
        parentPath={cardParentPath}
        depth={1}
        state={state}
        expandedIds={new Set()}
        onToggleExpand={vi.fn()}
        showSlotLabel
      />,
    )
    expect(screen.getByTestId("tree-slot-label-tab-tab-a")).toHaveTextContent("Login")
  })

  it("hides the slot label when showSlotLabel is false (card/grid)", () => {
    const state = makeMockState(baseSchema([card("c1", [heading("h1")])]))
    render(
      <BlockTreeSlot
        slotEntry={{
          segment: cardSlotSegment,
          blocks: [heading("h1")],
          slotLabel: "Card body",
        }}
        parentPath={cardParentPath}
        depth={1}
        state={state}
        expandedIds={new Set()}
        onToggleExpand={vi.fn()}
        showSlotLabel={false}
      />,
    )
    expect(screen.queryByText("Card body")).toBeNull()
  })
})

describe("BlockTreeSlot — empty / populated branch", () => {
  it("renders the EmptyDropZone when the slot has no blocks", () => {
    const state = makeMockState(baseSchema([card("c1", [])]))
    render(
      <BlockTreeSlot
        slotEntry={{ segment: cardSlotSegment, blocks: [], slotLabel: "Card body" }}
        parentPath={cardParentPath}
        depth={1}
        state={state}
        expandedIds={new Set()}
        onToggleExpand={vi.fn()}
        showSlotLabel={false}
      />,
    )
    expect(screen.getByTestId("tree-empty-blocks-card-body")).toBeInTheDocument()
  })

  it("renders the populated list with each child item visible", () => {
    const state = makeMockState(baseSchema([card("c1", [heading("h1"), heading("h2")])]))
    render(
      <BlockTreeSlot
        slotEntry={{
          segment: cardSlotSegment,
          blocks: [heading("h1"), heading("h2")],
          slotLabel: "Card body",
        }}
        parentPath={cardParentPath}
        depth={1}
        state={state}
        expandedIds={new Set()}
        onToggleExpand={vi.fn()}
        showSlotLabel={false}
      />,
    )
    expect(screen.getByTestId("tree-item-h1")).toBeInTheDocument()
    expect(screen.getByTestId("tree-item-h2")).toBeInTheDocument()
  })
})

describe("BlockTreeSlot — SortableContext wiring", () => {
  it("wraps the populated child list with a SortableContext whose items match the slot block ids", () => {
    sortableMocks.lastSortableContextItems = undefined
    const state = makeMockState(baseSchema([card("c1", [heading("inner-1"), heading("inner-2")])]))
    render(
      <BlockTreeSlot
        slotEntry={{
          segment: cardSlotSegment,
          blocks: [heading("inner-1"), heading("inner-2")],
          slotLabel: "Card body",
        }}
        parentPath={cardParentPath}
        depth={1}
        state={state}
        expandedIds={new Set()}
        onToggleExpand={vi.fn()}
        showSlotLabel={false}
      />,
    )
    expect(sortableMocks.lastSortableContextItems).toEqual(["inner-1", "inner-2"])
  })

  it("does NOT wrap the empty branch with a SortableContext (nothing to sort)", () => {
    sortableMocks.lastSortableContextItems = undefined
    const state = makeMockState(baseSchema([card("c1", [])]))
    render(
      <BlockTreeSlot
        slotEntry={{ segment: cardSlotSegment, blocks: [], slotLabel: "Card body" }}
        parentPath={cardParentPath}
        depth={1}
        state={state}
        expandedIds={new Set()}
        onToggleExpand={vi.fn()}
        showSlotLabel={false}
      />,
    )
    expect(sortableMocks.lastSortableContextItems).toBeUndefined()
  })
})

describe("BlockTreeSlot — useDroppable + container highlight", () => {
  it("registers a useDroppable with type='slot' + parentPath + slot in the data payload", () => {
    droppableMocks.lastDroppableArgs = undefined
    const state = makeMockState(baseSchema([card("c1", [heading("h1")])]))
    render(
      <BlockTreeSlot
        slotEntry={{ segment: cardSlotSegment, blocks: [heading("h1")], slotLabel: "Card body" }}
        parentPath={cardParentPath}
        depth={1}
        state={state}
        expandedIds={new Set()}
        onToggleExpand={vi.fn()}
        showSlotLabel={false}
      />,
    )
    const args = droppableMocks.lastDroppableArgs as { id: string; data: unknown } | undefined
    expect(args?.id).toMatch(/^slot-/)
    expect(args?.data).toEqual({
      type: "slot",
      parentPath: cardParentPath,
      slot: cardSlotSegment,
    })
  })

  it("applies the container highlight ring + tint when droppable.isOver is true", () => {
    droppableMocks.droppableReturn = { ...droppableMocks.droppableReturn, isOver: true }
    const state = makeMockState(baseSchema([card("c1", [heading("h1")])]))
    render(
      <BlockTreeSlot
        slotEntry={{ segment: cardSlotSegment, blocks: [heading("h1")], slotLabel: "Card body" }}
        parentPath={cardParentPath}
        depth={1}
        state={state}
        expandedIds={new Set()}
        onToggleExpand={vi.fn()}
        showSlotLabel={false}
      />,
    )
    const droppableNode = screen.getByTestId("tree-slot-droppable-blocks-card-body")
    expect(droppableNode).toHaveAttribute("data-over", "true")
    expect(droppableNode.className).toContain("ring-1")
    expect(droppableNode.className).toContain("ring-primary/30")
    droppableMocks.droppableReturn = { ...droppableMocks.droppableReturn, isOver: false }
  })

  it("does NOT apply the highlight when droppable.isOver is false", () => {
    droppableMocks.droppableReturn = { ...droppableMocks.droppableReturn, isOver: false }
    const state = makeMockState(baseSchema([card("c1", [heading("h1")])]))
    render(
      <BlockTreeSlot
        slotEntry={{ segment: cardSlotSegment, blocks: [heading("h1")], slotLabel: "Card body" }}
        parentPath={cardParentPath}
        depth={1}
        state={state}
        expandedIds={new Set()}
        onToggleExpand={vi.fn()}
        showSlotLabel={false}
      />,
    )
    const droppableNode = screen.getByTestId("tree-slot-droppable-blocks-card-body")
    expect(droppableNode).not.toHaveAttribute("data-over")
    expect(droppableNode.className).not.toContain("ring-primary/30")
  })

  it("forwards the isOver flag to EmptyDropZone for the empty branch", () => {
    droppableMocks.droppableReturn = { ...droppableMocks.droppableReturn, isOver: true }
    const state = makeMockState(baseSchema([card("c1", [])]))
    render(
      <BlockTreeSlot
        slotEntry={{ segment: cardSlotSegment, blocks: [], slotLabel: "Card body" }}
        parentPath={cardParentPath}
        depth={1}
        state={state}
        expandedIds={new Set()}
        onToggleExpand={vi.fn()}
        showSlotLabel={false}
      />,
    )
    const empty = screen.getByTestId("tree-empty-blocks-card-body")
    expect(empty).toHaveAttribute("data-over", "true")
    droppableMocks.droppableReturn = { ...droppableMocks.droppableReturn, isOver: false }
  })
})
