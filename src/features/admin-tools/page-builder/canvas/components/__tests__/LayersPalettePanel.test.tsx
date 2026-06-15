import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { LayersPalettePanel } from "../LayersPalettePanel"
import { baseSchema, card, heading, makeMockState, tabs } from "./test-utils"

vi.mock("@/ui/theme/ThemeManager", () => ({
  useTheme: () => ({ settings: {} }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}))

// LayersPalettePanel renders BlockTree → BlockTreeItem (which uses
// useSortable / SortableContext from @dnd-kit/sortable). Mock those so
// tests stay focussed on tab logic rather than dnd plumbing.
vi.mock("@dnd-kit/sortable", () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: () => {},
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  verticalListSortingStrategy: () => ({}),
}))

vi.mock("@dnd-kit/utilities", () => ({
  CSS: { Transform: { toString: () => undefined } },
}))

vi.mock("@dnd-kit/core", () => ({
  // BlockTreeDndProvider mounts a real DndContext + DragOverlay; the
  // BlockTreeSlot inside the tree uses useDroppable. Both are stubbed
  // here so tab-switching tests don't drag in dnd-kit's real machinery.
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DragOverlay: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  MouseSensor: { __sensorKind: "MouseSensor" },
  useSensor: () => ({}),
  useSensors: () => [],
  useDroppable: () => ({
    setNodeRef: () => {},
    isOver: false,
    node: { current: null },
    rect: { current: null },
    over: null,
    active: null,
  }),
}))

describe("LayersPalettePanel — initial tab heuristic", () => {
  it("defaults to the Palette tab when the schema is empty", () => {
    const state = makeMockState(baseSchema([]))
    render(<LayersPalettePanel state={state} onAddType={vi.fn()} />)
    expect(screen.getByTestId("rail-content-palette")).toHaveAttribute("data-state", "active")
    expect(screen.getByTestId("rail-content-layers")).toHaveAttribute("data-state", "inactive")
  })

  it("defaults to the Layers tab when the schema has at least one block", () => {
    const state = makeMockState(baseSchema([heading("h1")]))
    render(<LayersPalettePanel state={state} onAddType={vi.fn()} />)
    expect(screen.getByTestId("rail-content-layers")).toHaveAttribute("data-state", "active")
    expect(screen.getByTestId("rail-content-palette")).toHaveAttribute("data-state", "inactive")
  })
})

describe("LayersPalettePanel — manual tab switching", () => {
  it("switches to Layers when its trigger is clicked", async () => {
    const user = userEvent.setup()
    const state = makeMockState(baseSchema([])) // empty → starts on palette
    render(<LayersPalettePanel state={state} onAddType={vi.fn()} />)
    await user.click(screen.getByTestId("rail-tab-layers"))
    expect(screen.getByTestId("rail-content-layers")).toHaveAttribute("data-state", "active")
  })

  it("switches to Palette when its trigger is clicked", async () => {
    const user = userEvent.setup()
    const state = makeMockState(baseSchema([heading("h1")])) // starts on layers
    render(<LayersPalettePanel state={state} onAddType={vi.fn()} />)
    await user.click(screen.getByTestId("rail-tab-palette"))
    expect(screen.getByTestId("rail-content-palette")).toHaveAttribute("data-state", "active")
  })
})

describe("LayersPalettePanel — empty Layers tab hint", () => {
  it("shows the EmptyLayersHint when the schema is empty + Layers is active", async () => {
    const user = userEvent.setup()
    const state = makeMockState(baseSchema([]))
    render(<LayersPalettePanel state={state} onAddType={vi.fn()} />)
    await user.click(screen.getByTestId("rail-tab-layers"))
    expect(screen.getByTestId("rail-empty-layers-hint")).toBeInTheDocument()
    expect(screen.getByText(/No blocks yet/i)).toBeInTheDocument()
  })

  it("flips back to the Palette tab when the hint button is clicked", async () => {
    const user = userEvent.setup()
    const state = makeMockState(baseSchema([]))
    render(<LayersPalettePanel state={state} onAddType={vi.fn()} />)
    await user.click(screen.getByTestId("rail-tab-layers"))
    await user.click(screen.getByTestId("rail-empty-switch-to-palette"))
    expect(screen.getByTestId("rail-content-palette")).toHaveAttribute("data-state", "active")
  })

  it("does NOT show the hint once at least one block exists", () => {
    const state = makeMockState(baseSchema([heading("h1")]))
    render(<LayersPalettePanel state={state} onAddType={vi.fn()} />)
    expect(screen.queryByTestId("rail-empty-layers-hint")).toBeNull()
  })
})

describe("LayersPalettePanel — switchToLayersSignal auto-switch", () => {
  it("flips to Layers when the parent bumps the signal", async () => {
    const user = userEvent.setup()
    const state = makeMockState(baseSchema([heading("h1")]))
    const { rerender } = render(<LayersPalettePanel state={state} onAddType={vi.fn()} switchToLayersSignal={0} />)
    // Move the user to Palette manually first (Radix Tabs needs the
    // userEvent pointer sequence — fireEvent.click doesn't open them).
    await user.click(screen.getByTestId("rail-tab-palette"))
    expect(screen.getByTestId("rail-content-palette")).toHaveAttribute("data-state", "active")

    // Parent bumps the signal — panel should flip back to Layers.
    rerender(<LayersPalettePanel state={state} onAddType={vi.fn()} switchToLayersSignal={1} />)
    expect(screen.getByTestId("rail-content-layers")).toHaveAttribute("data-state", "active")
  })

  it("ignores the initial signal value of 0 (no auto-switch on mount)", () => {
    const state = makeMockState(baseSchema([])) // empty → palette default
    render(<LayersPalettePanel state={state} onAddType={vi.fn()} switchToLayersSignal={0} />)
    expect(screen.getByTestId("rail-content-palette")).toHaveAttribute("data-state", "active")
  })
})

describe("LayersPalettePanel — DnD provider mount", () => {
  it("wraps BlockTree with the BlockTreeDndProvider when the schema is non-empty", () => {
    const state = makeMockState(baseSchema([heading("h1")]))
    render(<LayersPalettePanel state={state} onAddType={vi.fn()} />)
    expect(screen.getByTestId("block-tree-dnd-provider")).toBeInTheDocument()
    expect(screen.getByTestId("canvas-tree")).toBeInTheDocument()
  })

  it("does NOT mount the DnD provider when the schema is empty", () => {
    const state = makeMockState(baseSchema([]))
    render(<LayersPalettePanel state={state} onAddType={vi.fn()} />)
    expect(screen.queryByTestId("block-tree-dnd-provider")).toBeNull()
  })
})

describe("LayersPalettePanel — block count badge", () => {
  it("hides the badge when the schema is empty", () => {
    const state = makeMockState(baseSchema([]))
    render(<LayersPalettePanel state={state} onAddType={vi.fn()} />)
    expect(screen.queryByTestId("rail-tab-layers-count")).toBeNull()
  })

  it("counts only top-level blocks when nothing is nested", () => {
    const state = makeMockState(baseSchema([heading("h1"), heading("h2"), heading("h3"), heading("h4")]))
    render(<LayersPalettePanel state={state} onAddType={vi.fn()} />)
    expect(screen.getByTestId("rail-tab-layers-count")).toHaveTextContent("4")
  })

  it("counts nested blocks (card + 2 children → 3)", () => {
    const state = makeMockState(baseSchema([card("c1", [heading("h1"), heading("h2")])]))
    render(<LayersPalettePanel state={state} onAddType={vi.fn()} />)
    expect(screen.getByTestId("rail-tab-layers-count")).toHaveTextContent("3")
  })

  it("counts blocks across tabs branches (tabs + 2 inside-tab blocks → 3)", () => {
    const state = makeMockState(
      baseSchema([
        tabs("t1", [
          { id: "tab-a", blocks: [heading("inA")] },
          { id: "tab-b", blocks: [heading("inB")] },
        ]),
      ]),
    )
    render(<LayersPalettePanel state={state} onAddType={vi.fn()} />)
    expect(screen.getByTestId("rail-tab-layers-count")).toHaveTextContent("3")
  })
})
