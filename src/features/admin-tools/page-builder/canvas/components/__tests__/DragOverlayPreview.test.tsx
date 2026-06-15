import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { DragOverlayPreview } from "../DragOverlayPreview"
import { heading } from "./test-utils"

vi.mock("@/ui/theme/ThemeManager", () => ({
  useTheme: () => ({ settings: {} }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}))

describe("DragOverlayPreview", () => {
  it("renders the block label sourced from the registry definition", () => {
    render(<DragOverlayPreview block={heading("h1")} />)
    expect(screen.getByText("Heading")).toBeInTheDocument()
  })

  it("renders the block id beneath the label", () => {
    render(<DragOverlayPreview block={heading("h-secret-id")} />)
    expect(screen.getByText("h-secret-id")).toBeInTheDocument()
  })

  it("stamps the block type onto a data attribute for styling / inspection", () => {
    render(<DragOverlayPreview block={heading("h1")} />)
    expect(screen.getByTestId("drag-overlay-preview")).toHaveAttribute("data-block-type", "heading")
  })

  it("applies the lifted-card visual treatment (primary-tinted shadow + border)", () => {
    render(<DragOverlayPreview block={heading("h1")} />)
    const preview = screen.getByTestId("drag-overlay-preview")
    expect(preview.className).toContain("shadow-2xl")
    expect(preview.className).toContain("shadow-primary/20")
    expect(preview.className).toContain("border-primary/40")
  })
})
