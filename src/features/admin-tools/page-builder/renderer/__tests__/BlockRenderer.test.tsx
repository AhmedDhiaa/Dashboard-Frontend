import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { BlockRenderer } from "../BlockRenderer"
// Importing the registry triggers built-in block registration as a side effect.
import "../../registry/block-registry"

vi.mock("@/ui/theme/ThemeManager", () => ({
  useTheme: () => ({ settings: {} }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}))

const mocks = vi.hoisted(() => ({ captureException: vi.fn() }))
vi.mock("@/infra/observability/error-reporter", () => ({
  errorReporter: { captureException: mocks.captureException, captureMessage: vi.fn() },
}))

describe("BlockRenderer — registry dispatch", () => {
  it("dispatches a heading block to the heading Render", () => {
    render(
      <BlockRenderer
        block={
          {
            id: "h1",
            type: "heading",
            text: { en: "Page title", ar: "العنوان" },
            level: 1,
            hidden: false,
          } as never
        }
      />,
    )
    expect(screen.getByRole("heading", { level: 1, name: "Page title" })).toBeInTheDocument()
  })

  it("returns null for hidden blocks", () => {
    const { container } = render(
      <BlockRenderer
        block={
          {
            id: "h2",
            type: "heading",
            text: { en: "Hidden", ar: "مخفي" },
            level: 2,
            hidden: true,
          } as never
        }
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it("reports unknown block types via errorReporter", () => {
    const { container } = render(<BlockRenderer block={{ id: "x", type: "totally-not-a-block" } as never} />)
    expect(container.firstChild).toBeNull()
    expect(mocks.captureException).toHaveBeenCalled()
  })
})

describe("BlockRenderer — recursion (layout blocks)", () => {
  it("recurses into a card's nested blocks via React children", () => {
    render(
      <BlockRenderer
        block={
          {
            id: "card-1",
            type: "card",
            title: { en: "Wrapper", ar: "غلاف" },
            hidden: false,
            blocks: [{ id: "inner", type: "heading", text: { en: "Inner", ar: "داخلي" }, level: 3, hidden: false }],
          } as never
        }
      />,
    )
    expect(screen.getByRole("heading", { level: 3, name: "Inner" })).toBeInTheDocument()
  })

  it("recurses into tabs by id-keyed tabContents", () => {
    render(
      <BlockRenderer
        block={
          {
            id: "tabs-1",
            type: "tabs",
            hidden: false,
            tabs: [
              {
                id: "alpha",
                label: { en: "Alpha", ar: "أ" },
                blocks: [
                  {
                    id: "h-alpha",
                    type: "heading",
                    text: { en: "Alpha body", ar: "محتوى أ" },
                    level: 4,
                    hidden: false,
                  },
                ],
              },
            ],
          } as never
        }
      />,
    )
    // Tab body is rendered inside TabsContent — the heading should be present
    // even if Radix's hidden state defers visibility.
    expect(screen.getByText("Alpha body")).toBeInTheDocument()
  })

  it("recurses into a grid block via React children", () => {
    render(
      <BlockRenderer
        block={
          {
            id: "grid-1",
            type: "grid",
            columns: 2,
            hidden: false,
            blocks: [
              { id: "cell-1", type: "heading", text: { en: "Cell 1", ar: "خ١" }, level: 4, hidden: false },
              { id: "cell-2", type: "heading", text: { en: "Cell 2", ar: "خ٢" }, level: 4, hidden: false },
            ],
          } as never
        }
      />,
    )
    expect(screen.getByRole("heading", { level: 4, name: "Cell 1" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { level: 4, name: "Cell 2" })).toBeInTheDocument()
  })
})
