import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { BlockPalette, PAGE_BUILDER_DRAG_TYPE } from "../BlockPalette"
import "../../registry/block-registry"

vi.mock("@/ui/theme/ThemeManager", () => ({
  useTheme: () => ({ settings: {} }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}))

describe("BlockPalette", () => {
  it("renders one entry per registered block grouped by category", () => {
    render(<BlockPalette />)
    // 16 built-in blocks.
    expect(screen.getByTestId("palette-block-heading")).toBeInTheDocument()
    expect(screen.getByTestId("palette-block-card")).toBeInTheDocument()
    expect(screen.getByTestId("palette-block-table")).toBeInTheDocument()
    expect(screen.getByTestId("palette-block-button")).toBeInTheDocument()
  })

  it("invokes onAdd with the block's type when clicked", () => {
    const onAdd = vi.fn()
    render(<BlockPalette onAdd={onAdd} />)
    fireEvent.click(screen.getByTestId("palette-block-heading"))
    expect(onAdd).toHaveBeenCalledWith("heading")
  })

  it("sets the dataTransfer payload on dragstart", () => {
    render(<BlockPalette />)
    const setData = vi.fn()
    const dataTransfer = { setData, effectAllowed: "" } as unknown as DataTransfer
    fireEvent.dragStart(screen.getByTestId("palette-block-heading"), { dataTransfer })
    expect(setData).toHaveBeenCalledWith(PAGE_BUILDER_DRAG_TYPE, "heading")
  })
})
