import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { alertBlockDefinition } from "../alert-block"
import { kpiBlockDefinition } from "../kpi-block"
import { detailBlockDefinition } from "../detail-block"
import { buttonBlockDefinition } from "../button-block"

// Card + Button consume useTheme(); short-circuit it so we don't need to wrap
// every render in a ThemeProvider tree.
vi.mock("@/ui/theme/ThemeManager", () => ({
  useTheme: () => ({ settings: {} }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}))

// kpi + detail blocks now fetch via useBlockData; stub it so the rendering
// path is what's exercised here (data-source plumbing has a dedicated
// suite under renderer/__tests__/useBlockData.test.ts).
vi.mock("@/features/admin-tools/page-builder/renderer/useBlockData", () => ({
  useBlockData: () => ({ data: { totalCount: 42 }, loading: false, error: null, refetch: vi.fn() }),
}))

describe("alertBlock — Render", () => {
  const { Render, defaultProps } = alertBlockDefinition

  it("renders the alert title and ARIA role", () => {
    render(<Render {...defaultProps} title={{ en: "Watch out", ar: "احذر" }} severity="warning" />)
    expect(screen.getByRole("alert")).toBeInTheDocument()
    expect(screen.getByText("Watch out")).toBeInTheDocument()
  })

  it("optionally renders a message description", () => {
    render(<Render {...defaultProps} title={{ en: "Title", ar: "عنوان" }} message={{ en: "Body copy", ar: "متن" }} />)
    expect(screen.getByText("Body copy")).toBeInTheDocument()
  })

  it("renders nothing when hidden", () => {
    const { container } = render(<Render {...defaultProps} hidden />)
    expect(container.firstChild).toBeNull()
  })
})

describe("kpiBlock — Render", () => {
  const { Render, defaultProps } = kpiBlockDefinition

  it("wraps StatCard with the configured label", () => {
    render(<Render {...defaultProps} label={{ en: "Total Sales", ar: "إجمالي المبيعات" }} />)
    expect(screen.getByText("Total Sales")).toBeInTheDocument()
  })
})

describe("detailBlock — Render", () => {
  const { Render, defaultProps } = detailBlockDefinition

  it("renders one card per section with section title", () => {
    render(
      <Render
        {...defaultProps}
        sections={[
          { id: "s1", title: { en: "Section One", ar: "القسم الأول" }, fields: [{ field: "x" }] },
          { id: "s2", title: { en: "Section Two", ar: "القسم الثاني" }, fields: [{ field: "y" }] },
        ]}
      />,
    )
    expect(screen.getByText("Section One")).toBeInTheDocument()
    expect(screen.getByText("Section Two")).toBeInTheDocument()
  })
})

describe("buttonBlock — Render", () => {
  const { Render, defaultProps } = buttonBlockDefinition

  it("renders the button label inside a <button>", () => {
    render(<Render {...defaultProps} />)
    const btn = screen.getByRole("button")
    expect(btn).toBeInTheDocument()
    expect(btn.textContent).toContain(defaultProps.button.label.en)
  })

  it("renders nothing when the inner button.hidden is true", () => {
    const { container } = render(<Render {...defaultProps} button={{ ...defaultProps.button, hidden: true }} />)
    expect(container.firstChild).toBeNull()
  })
})
