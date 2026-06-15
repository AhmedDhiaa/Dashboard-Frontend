import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AddChildMenu } from "../AddChildMenu"

vi.mock("@/ui/theme/ThemeManager", () => ({
  useTheme: () => ({ settings: {} }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}))

// Radix DropdownMenu listens to pointer events (pointerDown specifically),
// not the synthetic click `fireEvent.click` produces. `userEvent` walks
// the whole input sequence, so the menu opens reliably under jsdom.
let user: ReturnType<typeof userEvent.setup>
beforeEach(() => {
  user = userEvent.setup()
})

describe("AddChildMenu", () => {
  it("renders a trigger labelled 'Add child' by default", () => {
    render(<AddChildMenu depth={0} onSelect={() => {}} />)
    expect(screen.getByTestId("tree-add-child-trigger-default")).toBeInTheDocument()
    expect(screen.getByText("Add child")).toBeInTheDocument()
  })

  it("opens a dropdown listing every registered block when clicked", async () => {
    render(<AddChildMenu depth={0} onSelect={() => {}} />)
    await user.click(screen.getByTestId("tree-add-child-trigger-default"))
    // The block registry covers 17 types — check for a few representative
    // entries rather than all of them.
    expect(screen.getByTestId("tree-add-child-item-heading")).toBeInTheDocument()
    expect(screen.getByTestId("tree-add-child-item-card")).toBeInTheDocument()
    expect(screen.getByTestId("tree-add-child-item-form")).toBeInTheDocument()
  })

  it("calls onSelect with the chosen block type", async () => {
    const onSelect = vi.fn()
    render(<AddChildMenu depth={0} onSelect={onSelect} />)
    await user.click(screen.getByTestId("tree-add-child-trigger-default"))
    await user.click(screen.getByTestId("tree-add-child-item-heading"))
    expect(onSelect).toHaveBeenCalledWith("heading")
  })

  it("filters block types when a `filter` prop is supplied", async () => {
    render(<AddChildMenu depth={0} onSelect={() => {}} filter={d => d.type === "heading"} />)
    await user.click(screen.getByTestId("tree-add-child-trigger-default"))
    expect(screen.getByTestId("tree-add-child-item-heading")).toBeInTheDocument()
    expect(screen.queryByTestId("tree-add-child-item-card")).toBeNull()
  })

  it("uses a custom test id suffix", () => {
    render(<AddChildMenu depth={0} onSelect={() => {}} testIdSuffix="my-slot" />)
    expect(screen.getByTestId("tree-add-child-trigger-my-slot")).toBeInTheDocument()
  })
})
