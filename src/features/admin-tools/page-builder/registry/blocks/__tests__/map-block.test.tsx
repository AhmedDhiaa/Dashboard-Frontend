import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { mapBlockDefinition } from "../map-block"

describe("mapBlock — Render", () => {
  const { Render, defaultProps } = mapBlockDefinition

  it("renders the loading placeholder while UnifiedMap loads", () => {
    render(<Render {...defaultProps} />)
    expect(screen.getByTestId("map-loading")).toBeInTheDocument()
  })

  it("renders nothing when hidden", () => {
    const { container } = render(<Render {...defaultProps} hidden />)
    expect(container.firstChild).toBeNull()
  })

  it("declares it wraps UnifiedMap via dynamic", () => {
    expect(mapBlockDefinition.wraps.componentName).toMatch(/UnifiedMap/)
    expect(mapBlockDefinition.wraps.componentName).toMatch(/dynamic/)
  })
})
