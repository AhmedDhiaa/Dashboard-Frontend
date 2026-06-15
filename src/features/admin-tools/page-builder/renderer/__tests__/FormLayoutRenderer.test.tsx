import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { FormLayoutRenderer } from "../FormLayoutRenderer"

vi.mock("@/ui/theme/ThemeManager", () => ({
  useTheme: () => ({ settings: {} }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}))

const renderField = (name: string) => (
  <span key={name} data-testid={`field-${name}`}>
    {name}
  </span>
)

describe("FormLayoutRenderer — grid", () => {
  it("renders renderField for every field across every row", () => {
    render(
      <FormLayoutRenderer
        layout={{
          type: "grid",
          rows: [
            { columns: 1, fields: ["name"] },
            { columns: 2, fields: ["email", "phone"] },
          ],
        }}
        renderField={renderField}
      />,
    )
    expect(screen.getByTestId("field-name")).toBeInTheDocument()
    expect(screen.getByTestId("field-email")).toBeInTheDocument()
    expect(screen.getByTestId("field-phone")).toBeInTheDocument()
  })
})

describe("FormLayoutRenderer — split (recursive)", () => {
  it("recurses into both halves", () => {
    render(
      <FormLayoutRenderer
        layout={{
          type: "split",
          ratio: "50/50",
          left: { type: "grid", rows: [{ columns: 1, fields: ["leftField"] }] },
          right: { type: "grid", rows: [{ columns: 1, fields: ["rightField"] }] },
        }}
        renderField={renderField}
      />,
    )
    expect(screen.getByTestId("field-leftField")).toBeInTheDocument()
    expect(screen.getByTestId("field-rightField")).toBeInTheDocument()
  })
})

describe("FormLayoutRenderer — recursive nesting (split → grid)", () => {
  it("supports a split layout containing two distinct grid layouts", () => {
    render(
      <FormLayoutRenderer
        layout={{
          type: "split",
          ratio: "60/40",
          left: { type: "grid", rows: [{ columns: 2, fields: ["fa", "fb"] }] },
          right: { type: "grid", rows: [{ columns: 1, fields: ["fc"] }] },
        }}
        renderField={renderField}
      />,
    )
    expect(screen.getByTestId("field-fa")).toBeInTheDocument()
    expect(screen.getByTestId("field-fb")).toBeInTheDocument()
    expect(screen.getByTestId("field-fc")).toBeInTheDocument()
  })
})
