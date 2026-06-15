import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { chartBlockDefinition } from "../chart-block"

vi.mock("@/ui/theme/ThemeManager", () => ({
  useTheme: () => ({ settings: {} }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}))

// chart-block now fetches via useBlockData; stub it so the test focuses
// on the rendering branches rather than the data-source plumbing
// (which has its own dedicated suite).
vi.mock("@/features/admin-tools/page-builder/renderer/useBlockData", () => ({
  useBlockData: () => ({ data: null, loading: false, error: null, refetch: vi.fn() }),
}))

describe("chartBlock — Render", () => {
  const { Render, defaultProps } = chartBlockDefinition

  it("renders the dynamic-loading placeholder while ChartBody loads", () => {
    // next/dynamic in jsdom yields the `loading:` fallback synchronously
    // until React resolves the import. We assert the loading state shows up,
    // which proves recharts went through the dynamic boundary (per the
    // no-static-heavy-import rule).
    render(<Render {...defaultProps} />)
    expect(screen.getByTestId("chart-loading")).toBeInTheDocument()
  })

  it("falls back to an empty-state card when no Y axes are configured", () => {
    render(<Render {...defaultProps} yAxes={[]} />)
    expect(screen.getByText(/no y-axis/i)).toBeInTheDocument()
  })

  it("renders nothing when hidden", () => {
    const { container } = render(<Render {...defaultProps} hidden />)
    expect(container.firstChild).toBeNull()
  })

  it("declares it wraps ChartBody via dynamic", () => {
    expect(chartBlockDefinition.wraps.componentName).toMatch(/ChartBody/)
    expect(chartBlockDefinition.wraps.componentName).toMatch(/dynamic/)
  })
})
