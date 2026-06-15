import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { DragHandle } from "../DragHandle"

describe("DragHandle — aria-label composition", () => {
  it("defaults to 'Drag to reorder' when no block label or position is provided", () => {
    render(<DragHandle blockId="h1" />)
    const button = screen.getByTestId("tree-drag-handle-h1")
    expect(button).toHaveAttribute("aria-label", "Drag to reorder")
  })

  it("uses the block label when provided", () => {
    render(<DragHandle blockId="h1" blockLabel="Heading" />)
    expect(screen.getByTestId("tree-drag-handle-h1")).toHaveAttribute("aria-label", "Drag Heading")
  })

  it("appends 'item N of M' when sibling position is provided", () => {
    render(<DragHandle blockId="h1" blockLabel="Heading" siblingIndex={1} siblingCount={5} />)
    expect(screen.getByTestId("tree-drag-handle-h1")).toHaveAttribute("aria-label", "Drag Heading (item 2 of 5)")
  })

  it("uses zero-based siblingIndex (index 0 → 'item 1 of N')", () => {
    render(<DragHandle blockId="h1" blockLabel="Card" siblingIndex={0} siblingCount={3} />)
    expect(screen.getByTestId("tree-drag-handle-h1")).toHaveAttribute("aria-label", "Drag Card (item 1 of 3)")
  })

  it("falls back to the static base when only one of siblingIndex/Count is provided", () => {
    render(<DragHandle blockId="h1" blockLabel="X" siblingIndex={0} />)
    expect(screen.getByTestId("tree-drag-handle-h1")).toHaveAttribute("aria-label", "Drag X")
  })
})

describe("DragHandle — dnd-kit prop spreading", () => {
  it("spreads attributes onto the button (tabIndex, role, etc.)", () => {
    const attributes = {
      "aria-roledescription": "sortable",
      role: "button",
      tabIndex: 0,
    } as unknown as Parameters<typeof DragHandle>[0]["attributes"]
    render(<DragHandle blockId="h1" attributes={attributes} />)
    const button = screen.getByTestId("tree-drag-handle-h1")
    expect(button).toHaveAttribute("aria-roledescription", "sortable")
    expect(button).toHaveAttribute("tabindex", "0")
  })

  it("attaches pointer listeners passed via the listeners prop", () => {
    let triggered = false
    const listeners = {
      onPointerDown: () => {
        triggered = true
      },
    } as unknown as Parameters<typeof DragHandle>[0]["listeners"]
    render(<DragHandle blockId="h1" listeners={listeners} />)
    const button = screen.getByTestId("tree-drag-handle-h1") as HTMLButtonElement
    // Dispatching a real pointer event flows through React's listener.
    button.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }))
    expect(triggered).toBe(true)
  })
})
