import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { tableBlockDefinition } from "../table-block"

vi.mock("@/ui/theme/ThemeManager", () => ({
  useTheme: () => ({ settings: {} }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}))

// API/swagger sources route through useBlockData; stub it so the
// table-block rendering branches are tested in isolation.
vi.mock("@/features/admin-tools/page-builder/renderer/useBlockData", () => ({
  useBlockData: () => ({
    data: { items: [{ id: "row-1", name: "Sample" }], totalCount: 1 },
    loading: false,
    error: null,
    refetch: vi.fn(),
  }),
}))

describe("tableBlock — Render", () => {
  const { Render, defaultProps } = tableBlockDefinition

  it("renders a Table with rows for non-entity sources (api)", () => {
    // useBlockData is mocked to return one row { id: "row-1", name: "Sample" }.
    // The api branch renders a Table primitive populated from that response.
    render(
      <Render
        {...defaultProps}
        dataSource={{
          type: "api",
          endpoint: "/orders",
          method: "GET",
          itemsPath: "items",
          totalCountPath: "totalCount",
        }}
        columns={[
          { field: "id", type: "text-primary", sortable: true, filterable: false, hidden: false },
          { field: "name", type: "text-primary", sortable: true, filterable: false, hidden: false },
        ]}
      />,
    )
    expect(screen.getByText("row-1")).toBeInTheDocument()
    expect(screen.getByText("Sample")).toBeInTheDocument()
  })

  it("renders nothing when hidden", () => {
    const { container } = render(<Render {...defaultProps} hidden />)
    expect(container.firstChild).toBeNull()
  })

  it("declares it wraps CRUDListPage", () => {
    expect(tableBlockDefinition.wraps.componentName).toMatch(/CRUDListPage/)
  })
})
