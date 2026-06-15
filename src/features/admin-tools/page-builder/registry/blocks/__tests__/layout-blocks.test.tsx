import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { cardBlockDefinition } from "../card-block"
import { tabsBlockDefinition } from "../tabs-block"
import { accordionBlockDefinition } from "../accordion-block"
import { gridBlockDefinition } from "../grid-block"
import { PageBuilderRenderProvider } from "../../../renderer/PageBuilderRenderContext"

// Card uses useTheme(); short-circuit it so tests don't need a ThemeProvider tree.
vi.mock("@/ui/theme/ThemeManager", () => ({
  useTheme: () => ({ settings: {} }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}))

describe("cardBlock — Render (view mode)", () => {
  const { Render, defaultProps } = cardBlockDefinition

  it("renders a card with the title", () => {
    render(<Render {...defaultProps} title={{ en: "My Card", ar: "بطاقتي" }} />)
    expect(screen.getByText("My Card")).toBeInTheDocument()
  })

  it("renders pre-rendered children passed in via React children", () => {
    // Phase 2 contract: orchestrating BlockRenderer (Phase 3) computes children
    // and passes them as React children. Layout blocks themselves do NOT recurse
    // into the registry — that keeps load-order cycles out.
    render(
      <Render {...defaultProps} title={{ en: "Group", ar: "مجموعة" }}>
        <span data-testid="injected-child">child node</span>
      </Render>,
    )
    expect(screen.getByTestId("injected-child")).toBeInTheDocument()
  })

  it("hides the CardHeader entirely when title is undefined at runtime", () => {
    // Default cardBlock.defaultProps has no `title` — runtime should not
    // render an empty header.
    const { container } = render(<Render {...defaultProps} />)
    expect(container.querySelector('[data-slot="card-header"]')).toBeNull()
  })
})

describe("cardBlock — Render (edit mode)", () => {
  const { Render, defaultProps } = cardBlockDefinition

  it("shows the CardHeader with a '+ Add title' placeholder when title is undefined and isEditing=true", () => {
    render(
      <PageBuilderRenderProvider isEditing onEditField={() => {}}>
        <Render {...defaultProps} />
      </PageBuilderRenderProvider>,
    )
    // InlineLocalizedText renders its placeholder text inside the
    // click-to-edit display element.
    expect(screen.getByText("+ Add title")).toBeInTheDocument()
  })

  it("renders the InlineLocalizedText display element when title is set and isEditing=true", () => {
    render(
      <PageBuilderRenderProvider isEditing onEditField={() => {}}>
        <Render {...defaultProps} title={{ en: "My Card", ar: "بطاقتي" }} />
      </PageBuilderRenderProvider>,
    )
    expect(screen.getByTestId(`inline-display-${defaultProps.id}-title`)).toBeInTheDocument()
    expect(screen.getByText("My Card")).toBeInTheDocument()
  })
})

describe("tabsBlock — Render", () => {
  const { Render, defaultProps } = tabsBlockDefinition

  it("renders a trigger for each tab", () => {
    render(<Render {...defaultProps} />)
    expect(screen.getByRole("tab", { name: "Tab 1" })).toBeInTheDocument()
  })

  it("renders nothing when tabs[] is empty", () => {
    const { container } = render(<Render {...defaultProps} tabs={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it("places tabContents[id] inside the matching tab panel", () => {
    render(<Render {...defaultProps} tabContents={{ "tab-1": <span data-testid="injected-tab-1">A</span> }} />)
    expect(screen.getByTestId("injected-tab-1")).toBeInTheDocument()
  })
})

describe("accordionBlock — Render", () => {
  const { Render, defaultProps } = accordionBlockDefinition

  it("renders one <details> per item", () => {
    const { container } = render(<Render {...defaultProps} />)
    const details = container.querySelectorAll("details")
    expect(details.length).toBe(defaultProps.items.length)
  })

  it("uses item title in <summary>", () => {
    render(<Render {...defaultProps} />)
    expect(screen.getByText("Item 1")).toBeInTheDocument()
  })
})

describe("gridBlock — Render", () => {
  const { Render, defaultProps } = gridBlockDefinition

  it("renders a grid container with column classes", () => {
    const { container } = render(<Render {...defaultProps} columns={2} />)
    const grid = container.querySelector(".grid")
    expect(grid).toBeTruthy()
    expect(grid?.className).toMatch(/md:grid-cols-2/)
  })

  it("renders pre-rendered children passed in via React children", () => {
    render(
      <Render {...defaultProps} columns={2}>
        <span data-testid="grid-cell">cell</span>
      </Render>,
    )
    expect(screen.getByTestId("grid-cell")).toBeInTheDocument()
  })
})
